# Promotion Aggregate — Standalone DDD Model

**Source:** `packages/modules/promotion/`
**Service entry point:** `PromotionModuleService` (`packages/modules/promotion/src/services/promotion-module.ts`).
**Bounded context:** `Promotions`

The promotion module exposes **two** aggregate roots — `Promotion` and `Campaign`. This artifact models the **Promotion** aggregate only. `Campaign` (with its `CampaignBudget` and `CampaignBudgetUsage` children) is a separate aggregate that a Promotion references by `campaign_id`; it is explicitly **out of scope** here. Also peeled away from the service layer: `computeActions` (a read-only discount calculation for a cart — a query, not a state change), the `complete-cart` workflow in core-flows that invokes usage registration, and the inline-campaign-creation path inside `createPromotions` (it mutates the Campaign aggregate). What follows is only what the Promotion aggregate itself owns and decides.

## 1. Aggregate Hierarchy

```
Promotion (aggregate root)
├── application_method      : Application Method      (Related Entity — one-to-one, cascade delete)
│   ├── target_rules[]      : Promotion Rule          (Related Entity — what the discount applies to)
│   │   └── values[]        : Promotion Rule Value    (Value Object — set-replaced)
│   └── buy_rules[]         : Promotion Rule          (Related Entity — buyget "buy" condition)
│       └── values[]        : Promotion Rule Value    (Value Object — set-replaced)
└── rules[]                 : Promotion Rule          (Related Entity — eligibility conditions)
    └── values[]            : Promotion Rule Value    (Value Object — set-replaced)
```

**Why these classifications:**

- **Application Method** has its own id (`proappmet_`), exists at most once per promotion, owns the `target_rules` and `buy_rules` collections, and is updated *in place* (by id) through `Update Promotion` rather than replaced wholesale. It is cascade-deleted with the promotion. → **Related Entity**.
- **Promotion Rule** has its own id (`prorul_`), its own `attribute`/`operator`/`values`, and an independent add/update/remove lifecycle exposed through the batch rule endpoints. Stored as many-to-many in the schema, but in practice each rule is created for and owned by a single promotion. → **Related Entity**.
- **Promotion Rule Value** has a technical id (`prorulval_`) and its own table, but it holds only a `value` string and is **replaced wholesale**: updating a rule deletes every existing value record and recreates the set. It has no independent lifecycle. → **Value Object (set-replaced)**. *(This is the most debatable call — see if you'd rather keep it an entity, or even fold rule values into a `string[]` attribute on Promotion Rule.)*

## 2. Aggregate Root: Promotion

A promotion defines a discount applicable to a cart/order — either a `standard` conditional discount or a `buyget` ("buy X get Y") deal. It carries a unique `code`, a lifecycle `status` (draft → active → inactive), optional usage limits, and links to a single application method (how/what to discount), a set of eligibility rules, and optionally a campaign that scopes budget and dates.

### Attributes (Promotion)

| Attribute          | Type                              | Req                    | Default | Notes                                                                   |
|--------------------|-----------------------------------|------------------------|---------|-------------------------------------------------------------------------|
| id                 | string                            | yes (system-generated) | —       | Prefix `promo_`. Create-only.                                           |
| code               | string                            | yes                    | —       | Unique among non-deleted promotions. Searchable; the code buyers enter. |
| type               | enum: standard \| buyget          | yes                    | —       | Drives rule requirements. Create-only in practice.                      |
| status             | enum: draft \| active \| inactive | no                     | draft   | Lifecycle; changed via Change Promotion Status (cmd 3).                 |
| is_automatic       | boolean                           | no                     | false   | If true, applied without entering a code.                               |
| is_tax_inclusive   | boolean                           | no                     | false   | Whether the discount value is tax-inclusive.                            |
| limit              | number \| null                    | no                     | null    | Max total uses across all orders; null = unlimited. (since 2.12.0)      |
| used               | number                            | no                     | 0       | Times applied in completed orders; system-maintained. (since 2.12.0)    |
| metadata           | json \| null                      | no                     | null    | Arbitrary custom data. (since 2.12.0)                                   |
| application_method | Application Method                | conditional            | —       | One-to-one owned child; see §3. Required for a usable promo.            |
| rules              | Promotion Rule[]                  | no                     | []      | Eligibility conditions; see §4.                                         |
| campaign_id        | string \| null                    | no                     | null    | External reference → Campaign aggregate; see §11.                       |

## 3. Related Entity: Application Method

Defines **how** a promotion discounts and **what** it targets: the discount amount/percentage (`value` + `type`), the target (`order` / `items` / `shipping_methods`), the allocation strategy, and — for buyget — the buy/get quantities. It owns two rule collections: `target_rules` (what gets discounted) and `buy_rules` (what must be bought).

### Attributes (Application Method)

| Attribute              | Type                                     | Req                    | Default | Notes                                                        |
|------------------------|------------------------------------------|------------------------|---------|--------------------------------------------------------------|
| id                     | string                                   | yes (system-generated) | —       | Prefix `proappmet_`.                                         |
| type                   | enum: fixed \| percentage                | yes                    | —       | Fixed amount vs percentage discount.                         |
| target_type            | enum: order \| items \| shipping_methods | yes                    | —       | What the discount applies to.                                |
| allocation             | enum: each \| across \| once \| null     | no                     | null    | How the discount spreads across targets.                     |
| value                  | number                                   | conditional            | —       | Discount amount/percentage. Percentage must be ≤ 100.        |
| currency_code          | string \| null                           | no                     | null    | ISO currency; required for fixed/spend. Ext ref → Currency.  |
| max_quantity           | number \| null                           | no                     | null    | Max cart quantity the promo applies to. Required for `each`. |
| buy_rules_min_quantity | number \| null                           | no                     | null    | Buyget: min quantity that must be bought.                    |
| apply_to_quantity      | number \| null                           | no                     | null    | Buyget: quantity that receives the discount.                 |
| target_rules           | Promotion Rule[]                         | no                     | []      | What the discount targets; see §4.                           |
| buy_rules              | Promotion Rule[]                         | no                     | []      | Buyget "buy" condition; see §4.                              |

## 4. Related Entity: Promotion Rule

A single condition expressed as `attribute operator values` — e.g. `customer_group_id IN [grp_1, grp_2]` or `amount GTE 100`. A promotion uses rules in three roles: eligibility (`rules` on the promotion), discount target (`target_rules` on the method), and buyget buy-condition (`buy_rules` on the method).

### Attributes (Promotion Rule)

| Attribute   | Type                                           | Req                    | Default | Notes                                                                      |
|-------------|------------------------------------------------|------------------------|---------|----------------------------------------------------------------------------|
| id          | string                                         | yes (system-generated) | —       | Prefix `prorul_`.                                                          |
| description | string \| null                                 | no                     | null    | Human-friendly label.                                                      |
| attribute   | string                                         | yes                    | —       | Field evaluated, e.g. `customer_group_id`. Must be a valid rule attribute. |
| operator    | enum: gt \| lt \| gte \| lte \| eq \| ne \| in | yes                    | —       | Comparison operator.                                                       |
| values      | Promotion Rule Value[]                         | yes                    | —       | One or more values; see §4.1. Set-replaced on update.                      |

### 4.1 Value Object: Promotion Rule Value

A single value within a rule's value set (a customer-group id, a region id, a numeric threshold, etc.). Holds only the string value and is **set-replaced**: updating the parent rule deletes and recreates all of its values.

### Attributes (Promotion Rule Value)

| Attribute | Type   | Req | Default | Notes                                                                 |
|-----------|--------|-----|---------|-----------------------------------------------------------------------|
| value     | string | yes | —       | The value; interpreted per the parent rule's `attribute`. No id (VO). |

## 7. Commands (Aggregate Boundary)

The Promotion aggregate exposes **9 commands**. Each has a 1:1 domain event. Workflow-level orchestration (cart promotion evaluation, order completion, campaign management) is **not** an aggregate command.

| # | Command                       | Actor      | Payload (aggregate-facing)                                                                                  | Notes                                                                                       |
|---|-------------------------------|------------|-------------------------------------------------------------------------------------------------------------|---------------------------------------------------------------------------------------------|
| 1 | Create Promotion              | Merchant   | code, type, status?, is_automatic?, is_tax_inclusive?, limit?, application_method{…}, rules[], campaign_id? | Atomic: creates promotion + application method + rules. May reference an existing campaign. |
| 2 | Update Promotion              | Merchant   | id, code?, is_automatic?, is_tax_inclusive?, limit?, application_method{…}?, campaign_id?                   | Updates root + application method in place. Status is excluded (cmd 3).                     |
| 3 | Change Promotion Status       | Merchant   | id, status                                                                                                  | draft / active / inactive. Dedicated validated workflow.                                    |
| 4 | Delete Promotion              | Merchant   | id                                                                                                          | Soft delete; cascades to application_method.                                                |
| 5 | Update Promotion Rules        | Merchant   | id, create[], update[], delete[]                                                                            | Batch upsert of eligibility `rules`.                                                        |
| 6 | Update Promotion Target Rules | Merchant   | id, create[], update[], delete[]                                                                            | Batch upsert of the method's `target_rules`.                                                |
| 7 | Update Promotion Buy Rules    | Merchant   | id, create[], update[], delete[]                                                                            | Batch upsert of the method's `buy_rules` (buyget only).                                     |
| 8 | Register Promotion Usage      | Automation | computedActions[], registrationContext                                                                      | On cart completion: increments `used`, enforces `limit`, updates campaign budget.           |
| 9 | Revert Promotion Usage        | Automation | computedActions[], registrationContext                                                                      | On cancel/refund: decrements usage and campaign budget.                                     |

**Commands explicitly merged or omitted:**

- **Application method create/update** — NOT separate commands; merged into Create/Update Promotion (the method is created with the promotion and updated via the `application_method` sub-object).
- **The three batch rule endpoints** (rules / target-rules / buy-rules) each perform create + update + delete in one atomic call. Modeled as **one "Update … Rules" command per rule type** rather than 9 add/update/remove commands. The service methods `addPromotionRules`, `addPromotionTargetRules`, `addPromotionBuyRules`, `removePromotionRules`, `removePromotionTargetRules`, `removePromotionBuyRules`, and `updatePromotionRules` are sub-operations the batch workflow calls — not separate aggregate commands.
- **`computeActions`** — read-only; computes discount adjustments for a cart. Modeled as a read model (§9), not a command.
- **Inline campaign creation during Create Promotion** — orchestration that mutates the Campaign aggregate; out of scope.
- **`createCampaigns`, `updateCampaigns`, `addPromotionsToCampaign`, `removePromotionsFromCampaign`** — belong to the Campaign aggregate; out of scope.

## 8. Domain Events

Spaced Title Case is what Qlerify renders to users; the compact form is the `$ref` key (e.g. `#/domainEvents/PromotionCreated`).

| # | Event                          | Emitted by                    | Lane       |
|---|--------------------------------|-------------------------------|------------|
| 1 | Promotion Created              | Create Promotion              | Merchant   |
| 2 | Promotion Updated              | Update Promotion              | Merchant   |
| 3 | Promotion Status Changed       | Change Promotion Status       | Merchant   |
| 4 | Promotion Rules Updated        | Update Promotion Rules        | Merchant   |
| 5 | Promotion Target Rules Updated | Update Promotion Target Rules | Merchant   |
| 6 | Promotion Buy Rules Updated    | Update Promotion Buy Rules    | Merchant   |
| 7 | Promotion Deleted              | Delete Promotion              | Merchant   |
| 8 | Promotion Usage Registered     | Register Promotion Usage      | Automation |
| 9 | Promotion Usage Reverted       | Revert Promotion Usage        | Automation |

**Suggested chronology for the diagram:** Promotion Created → Promotion Rules Updated → Promotion Target Rules Updated → Promotion Buy Rules Updated → Promotion Status Changed → Promotion Usage Registered → Promotion Usage Reverted → Promotion Updated → Promotion Deleted. (These are lifecycle stages of one promotion, not a strict sequence — most editing events can recur.)

## 9. Read Models / Queries

### Query: Get Promotion

Inputs: `promotionId`, optional relation/field selectors.

Returns the full promotion with `application_method` (+ its `target_rules`/`buy_rules` and their values), `rules` (+ values), and `campaign` (+ budget).

### Query: Compute Promotion Actions

Input: a cart context (items, shipping methods, customer, totals). Read-only. Computes the discount adjustments the promotion would produce before it is applied:

| Field                  | Description                                                                                                          |
|------------------------|----------------------------------------------------------------------------------------------------------------------|
| code                   | Promotion code the action belongs to.                                                                                |
| action                 | One of `addItemAdjustment`, `addShippingMethodAdjustment`, `removeItemAdjustment`, `removeShippingMethodAdjustment`. |
| amount                 | Computed discount amount for the target.                                                                             |
| campaignBudgetExceeded | Flag: the campaign budget would be exceeded.                                                                         |
| promotionLimitExceeded | Flag: the promotion usage limit would be exceeded.                                                                   |

### Secondary Queries

| Query                       | Purpose                                                                                                         |
|-----------------------------|-----------------------------------------------------------------------------------------------------------------|
| List Promotions             | Admin listing with filters (q, code, type, status, campaign_id, application_method.currency_code) + pagination. |
| List Rule Attribute Options | Rule-builder support: valid attributes for a given rule_type.                                                   |
| List Rule Value Options     | Rule-builder support: valid values for a given rule attribute.                                                  |

## 10. Invariants

1. **Unique code** — `code` must be unique among non-deleted promotions.
2. **Code & type required on create** — missing either raises `INVALID_DATA`.
3. **Percentage ≤ 100** — a `percentage` application method with `value > 100` is rejected.
4. **Order target forbids target rules** — `target_type = order` combined with target rules raises `INVALID_DATA`.
5. **Buyget requires buy rules and target rules** — plus `apply_to_quantity` and `buy_rules_min_quantity`.
6. **Buy rules only on buyget** — adding buy rules to a `standard` promotion is rejected.
7. **Item method needs allocation; `each` needs max_quantity** — an item application method without allocation, or `each` allocation without `max_quantity`, is rejected.
8. **`campaign` and `campaign_id` are mutually exclusive** on Create Promotion.
9. **Currency must match campaign** — for a `spend` budget campaign, the application method's `currency_code` must equal the campaign budget currency.
10. **`limit` cannot drop below `used`** — Update Promotion rejects a `limit` less than current usage.
11. **Usage cannot exceed limit** — Register Usage throws when `used + 1 > limit`.
12. **Usage cannot exceed campaign budget** — Register Usage throws when the spend/usage total would exceed the budget limit.
13. **Status enumerated** — status must be one of draft / active / inactive.
14. **Rule values are set-replaced** — updating a rule replaces its entire value set; passing a new set clears the old.
15. **Valid rule attribute/operator** — an invalid `attribute` or `operator` is rejected.

## 11. External References

| Field                                       | Points to                                                                                           |
|---------------------------------------------|-----------------------------------------------------------------------------------------------------|
| Promotion.campaign_id                       | Campaign aggregate (same module, separate aggregate)                                                |
| ApplicationMethod.currency_code             | Currency module                                                                                     |
| Promotion Rule values (attribute-dependent) | Customer Group / Region / Product Collection / etc. — opaque string ids resolved at evaluation time |

**Out-of-scope orchestration that exists in the codebase:**

- **Cart completion** (`core-flows/src/cart/workflows/complete-cart.ts`) invokes `registerUsage` → modeled here as the Register Promotion Usage command (Automation lane); the cart-side orchestration itself is out of scope.
- **`computeActions`** is consumed by the cart's promotion-application workflows.
- **Campaign lifecycle** (create/update, add/remove promotions, budget usage by attribute) — belongs to the Campaign aggregate.

## 12. Tests (at the aggregate boundary)

Extracted from `packages/modules/promotion/integration-tests/__tests__/services/promotion-module/` (`promotion.spec.ts`, `register-usage.spec.ts`, `revert-usage.spec.ts`). Rephrased in business language.

### Create Promotion
- Given valid data, When the merchant creates a standard promotion with a code, type and percentage application method, Then a promotion is returned with an assigned id and draft status.
- Given a percentage application method, When the merchant sets `value` greater than 100, Then the command is rejected with `INVALID_DATA`.
- When required params (code/type) are not passed, Then the command is rejected.
- Given both `campaign` and `campaign_id` are provided, When the merchant creates the promotion, Then the command is rejected.
- Given an existing campaign id, When the merchant creates a promotion referencing it, Then the promotion is linked to that campaign.
- Given target_type `order` with target rules, When the merchant creates the promotion, Then the command is rejected.
- Given a buyget promotion, When buy rules / target rules / apply_to_quantity / buy_rules_min_quantity are missing, Then the command is rejected with the corresponding error.
- Given an item application method without allocation (or `each` allocation without max_quantity), When created, Then the command is rejected.
- Given valid rules, When the merchant creates a promotion with rules (single or multiple values), Then the rules and their values are persisted.
- Given an invalid rule attribute or operator, When the merchant creates the promotion, Then the command is rejected.

### Update Promotion
- Given an existing promotion, When the merchant updates root attributes, Then the changes are persisted.
- Given an existing promotion with an application method, When the merchant updates application-method attributes, Then the method is updated in place.
- Given an application method whose target_type changes to `order`, When updated, Then `max_quantity` is forced to 0.
- Given a promotion, When the merchant changes its campaign, Then the campaign link is updated.
- When required params are not passed, Then the command is rejected.

### Delete / Restore Promotion
- Given a promotion id, When the merchant deletes it, Then it is soft-deleted.
- Given a soft-deleted promotion, When restored, Then it becomes active again.

### Update Promotion Rules / Target Rules / Buy Rules
- Given a non-existent promotion id, When adding rules, Then the command is rejected with not-found.
- Given an id is not provided, When adding rules, Then the command is rejected.
- Given a promotion, When the merchant adds eligibility/target/buy rules, Then the rules are added to the correct collection.

### Register Promotion Usage
- Given a promotion on a `spend` budget campaign, When usage is registered, Then the budget `used` increases by the spent amount.
- Given a promotion on a `usage` budget campaign, When usage is registered, Then the budget usage count increases by 1.
- Given a computed action whose code does not match any promotion, When usage is registered, Then no error is thrown.
- Given a `usage` or `spend` budget at its limit, When usage is registered beyond it, Then the command is rejected with "exceeds the budget limit".
- Given the spent amount exactly matches the limit, When usage is registered, Then no error is thrown.
- Given an attribute (use-by-attribute) budget, When usage is registered, Then a per-attribute usage record is created (and can be reverted).

### Revert Promotion Usage
- Given previously registered `spend`/`usage` usage, When reverted, Then the budget `used` is decremented accordingly.
- Given a computed action whose code does not match any promotion, When reverted, Then no error is thrown.
