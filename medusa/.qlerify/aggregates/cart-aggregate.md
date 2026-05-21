# Cart Aggregate — Standalone DDD Model

**Source:** `packages/modules/cart/` in the Medusa codebase.
**Service entry point:** `CartModuleService` (`packages/modules/cart/src/services/cart-module.ts`).

The service layer in Medusa (core-flows workflows) orchestrates across Cart + Promotion + Tax + Pricing + Inventory. Those workflows are **outside** this aggregate. What follows is only what the Cart aggregate itself owns and decides.

---

## 1. Aggregate Hierarchy

```
Cart (aggregate root)
├── billing_address           : Address                         (Value Object)
├── shipping_address          : Address                         (Value Object)
├── items[]                   : LineItem                        (Related Entity)
│   ├── adjustments[]         : LineItemAdjustment              (Value Object — set-replaced)
│   └── tax_lines[]           : LineItemTaxLine                 (Value Object — set-replaced)
├── shipping_methods[]        : ShippingMethod                  (Related Entity)
│   ├── adjustments[]         : ShippingMethodAdjustment        (Value Object — set-replaced)
│   └── tax_lines[]           : ShippingMethodTaxLine           (Value Object — set-replaced)
└── credit_lines[]            : CreditLine                      (Related Entity)
```

**Why these classifications:**
- `LineItem` and `ShippingMethod` have independent add/update/remove commands and their own identity in the business vocabulary — they're **Related Entities**.
- Adjustments and tax lines are exposed through `set…` commands that replace the full collection atomically (tests confirm: passing `[]` removes all; not-listed items are soft-deleted). Their IDs are technical. They are **Value Objects**.
- `Address` (billing/shipping) exists at most once each on a cart and is replaced wholesale by `SetBillingAddress` / `SetShippingAddress` — **Value Object**, despite having a DB id.
- `CreditLine` has its own lifecycle (add / soft-delete) and references external transactions (refunds, store credit) — **Related Entity**.

---

## 2. Aggregate Root: Cart

A shopping cart owned by a customer (or anonymous), priced in a single currency, scoped to a region and a sales channel. It holds purchasable items, selected shipping methods, and pricing artefacts (adjustments, tax lines, credit lines) until it is either abandoned or converted to an order.

### Attributes (Cart)

| Attribute        | Type              | Req                    | Default | Notes                                                                                                                                  |
|------------------|-------------------|------------------------|---------|----------------------------------------------------------------------------------------------------------------------------------------|
| id               | string            | yes (system-generated) | —       | Prefix `cart_`. Create-only.                                                                                                           |
| currency_code    | string (ISO-4217) | yes                    | —       | Normalised to lower-case. **Create-only** (updateable in practice but business intent is that the cart currency is fixed at creation). |
| region_id        | string \| null    | no                     | null    | External reference → Region aggregate.                                                                                                 |
| customer_id      | string \| null    | no                     | null    | External reference → Customer aggregate.                                                                                               |
| sales_channel_id | string \| null    | no                     | null    | External reference → Sales Channel aggregate.                                                                                          |
| email            | string \| null    | no                     | null    | Email of the buyer.                                                                                                                    |
| locale           | string \| null    | no                     | null    | BCP-47 language tag (e.g. `en-US`).                                                                                                    |
| metadata         | json \| null      | no                     | null    | Free-form integration data.                                                                                                            |
| completed_at     | datetime \| null  | no                     | null    | Set externally when the cart becomes an order; internal to the aggregate it is a marker field.                                         |
| billing_address  | Address \| null   | no                     | null    | Value Object, see §3.                                                                                                                  |
| shipping_address | Address \| null   | no                     | null    | Value Object, see §3.                                                                                                                  |
| items            | LineItem[]        | no                     | []      | Owned collection, see §4.                                                                                                              |
| shipping_methods | ShippingMethod[]  | no                     | []      | Owned collection, see §5.                                                                                                              |
| credit_lines     | CreditLine[]      | no                     | []      | Owned collection, see §6.                                                                                                              |
| created_at       | datetime          | yes (system)           | now     | Audit.                                                                                                                                 |
| updated_at       | datetime          | yes (system)           | now     | Audit.                                                                                                                                 |
| deleted_at       | datetime \| null  | no                     | null    | Soft-delete marker.                                                                                                                    |

Monetary rollups on the cart (`total`, `subtotal`, `item_total`, `shipping_total`, `discount_total`, `tax_total`, `original_*`, `gift_card_total`, etc.) are **computed projections** — listed under Read Models (§9), not as stored attributes.

---

## 3. Value Object: Address (billing / shipping)

A postal/contact address attached to a cart. Replaced wholesale — there is no "patch a single field on the existing address" at the aggregate boundary (consumers pass a full address object when setting it).

| Attribute    | Type           | Req         | Default | Notes                                      |
|--------------|----------------|-------------|---------|--------------------------------------------|
| id           | string         | (technical) | —       | Prefix `caaddr_`. Implementation artefact. |
| first_name   | string \| null | no          | null    |                                            |
| last_name    | string \| null | no          | null    |                                            |
| company      | string \| null | no          | null    |                                            |
| address_1    | string \| null | no          | null    |                                            |
| address_2    | string \| null | no          | null    |                                            |
| city         | string \| null | no          | null    |                                            |
| province     | string \| null | no          | null    |                                            |
| postal_code  | string \| null | no          | null    |                                            |
| country_code | string \| null | no          | null    | ISO-3166 alpha-2.                          |
| phone        | string \| null | no          | null    |                                            |
| customer_id  | string \| null | no          | null    | External reference → Customer.             |
| metadata     | json \| null   | no          | null    |                                            |

---

## 4. Related Entity: LineItem

A purchasable item added to the cart. Carries a **snapshot** of product/variant attributes taken at add-time so that subsequent catalogue changes do not mutate the cart.

### Attributes (LineItem)

| Attribute             | Type                 | Req          | Default | Notes                                            |
|-----------------------|----------------------|--------------|---------|--------------------------------------------------|
| id                    | string               | yes (system) | —       | Prefix `cali_`.                                  |
| title                 | string               | yes          | —       | Display title of the item.                       |
| quantity              | number               | yes          | —       | Must be > 0.                                     |
| unit_price            | bigNumber            | yes          | —       | Price per unit at the moment of the operation.   |
| subtitle              | string \| null       | no           | null    |                                                  |
| thumbnail             | string \| null       | no           | null    |                                                  |
| variant_id            | string \| null       | no           | null    | Snapshot: external reference to Product variant. |
| product_id            | string \| null       | no           | null    | Snapshot: external reference to Product.         |
| product_title         | string \| null       | no           | null    | Snapshot from catalogue.                         |
| product_description   | string \| null       | no           | null    | Snapshot.                                        |
| product_subtitle      | string \| null       | no           | null    | Snapshot.                                        |
| product_type          | string \| null       | no           | null    | Snapshot.                                        |
| product_type_id       | string \| null       | no           | null    | Snapshot.                                        |
| product_collection    | string \| null       | no           | null    | Snapshot.                                        |
| product_handle        | string \| null       | no           | null    | Snapshot.                                        |
| variant_sku           | string \| null       | no           | null    | Snapshot.                                        |
| variant_barcode       | string \| null       | no           | null    | Snapshot.                                        |
| variant_title         | string \| null       | no           | null    | Snapshot.                                        |
| variant_option_values | json \| null         | no           | null    | Snapshot.                                        |
| requires_shipping     | boolean              | no           | true    | Whether shipping applies.                        |
| is_discountable       | boolean              | no           | true    | Eligible for promotions.                         |
| is_giftcard           | boolean              | no           | false   | Gift-card line.                                  |
| is_tax_inclusive      | boolean              | no           | false   | Whether `unit_price` already includes tax.       |
| is_custom_price       | boolean              | no           | false   | Price was set manually, not from catalogue.      |
| compare_at_unit_price | bigNumber \| null    | no           | null    | Original list price for strike-through.          |
| metadata              | json \| null         | no           | null    |                                                  |
| adjustments           | LineItemAdjustment[] | no           | []      | Owned VOs, see §4.1.                             |
| tax_lines             | LineItemTaxLine[]    | no           | []      | Owned VOs, see §4.2.                             |

### 4.1 Value Object: LineItemAdjustment

A discount applied to one line item (from a promotion or a manual override). **Always replaced as a set** — invariants forbid patching a single adjustment.

| Attribute        | Type           | Req         | Default | Notes                                         |
|------------------|----------------|-------------|---------|-----------------------------------------------|
| id               | string         | (technical) | —       | Prefix `caliadj_`.                            |
| amount           | bigNumber      | yes         | —       | Must be ≥ 0.                                  |
| code             | string \| null | no          | null    | Promotion code or label.                      |
| description      | string \| null | no          | null    |                                               |
| promotion_id     | string \| null | no          | null    | External reference → Promotion aggregate.     |
| provider_id      | string \| null | no          | null    | E.g. the system that computed the adjustment. |
| is_tax_inclusive | boolean        | no          | false   |                                               |
| metadata         | json \| null   | no          | null    |                                               |

### 4.2 Value Object: LineItemTaxLine

A tax charge applied to a line item. Replaced as a set.

| Attribute   | Type           | Req         | Default | Notes                               |
|-------------|----------------|-------------|---------|-------------------------------------|
| id          | string         | (technical) | —       | Prefix `calitxl_`.                  |
| code        | string         | yes         | —       | Tax code.                           |
| rate        | float          | yes         | —       | Rate, e.g. 20 for 20%.              |
| description | string \| null | no          | null    |                                     |
| provider_id | string \| null | no          | null    |                                     |
| tax_rate_id | string \| null | no          | null    | External reference → Tax aggregate. |
| metadata    | json \| null   | no          | null    |                                     |

---

## 5. Related Entity: ShippingMethod

A shipping option selected for the cart. Has its own amount, tax lines, and adjustments.

### Attributes (ShippingMethod)

| Attribute          | Type                       | Req          | Default | Notes                                              |
|--------------------|----------------------------|--------------|---------|----------------------------------------------------|
| id                 | string                     | yes (system) | —       | Prefix `casm_`.                                    |
| name               | string                     | yes          | —       | Display name.                                      |
| amount             | bigNumber                  | yes          | —       | Must be ≥ 0.                                       |
| description        | json \| null               | no           | null    |                                                    |
| shipping_option_id | string \| null             | no           | null    | External reference → Fulfillment shipping option.  |
| data               | json \| null               | no           | null    | Provider-specific metadata (e.g. carrier payload). |
| is_tax_inclusive   | boolean                    | no           | false   |                                                    |
| metadata           | json \| null               | no           | null    |                                                    |
| adjustments        | ShippingMethodAdjustment[] | no           | []      | Owned VOs, see §5.1.                               |
| tax_lines          | ShippingMethodTaxLine[]    | no           | []      | Owned VOs, see §5.2.                               |

### 5.1 Value Object: ShippingMethodAdjustment

A discount applied to a shipping method. Replaced as a set.

| Attribute    | Type           | Req         | Default | Notes                           |
|--------------|----------------|-------------|---------|---------------------------------|
| id           | string         | (technical) | —       | Prefix `casmadj_`.              |
| amount       | bigNumber      | yes         | —       | Must be ≥ 0.                    |
| code         | string \| null | no          | null    |                                 |
| description  | string \| null | no          | null    |                                 |
| promotion_id | string \| null | no          | null    | External reference → Promotion. |
| provider_id  | string \| null | no          | null    |                                 |
| metadata     | json \| null   | no          | null    |                                 |

### 5.2 Value Object: ShippingMethodTaxLine

A tax charge applied to a shipping method. Replaced as a set.

| Attribute   | Type           | Req         | Default | Notes                     |
|-------------|----------------|-------------|---------|---------------------------|
| id          | string         | (technical) | —       | Prefix `casmtxl_`.        |
| code        | string         | yes         | —       |                           |
| rate        | float          | yes         | —       |                           |
| description | string \| null | no          | null    |                           |
| provider_id | string \| null | no          | null    |                           |
| tax_rate_id | string \| null | no          | null    | External reference → Tax. |
| metadata    | json \| null   | no          | null    |                           |

---

## 6. Related Entity: CreditLine

A monetary credit applied to the cart — typically a refund from a previous order or redeemed store credit. Each credit line points back to the source via `reference` + `reference_id`.

| Attribute    | Type           | Req          | Default | Notes                                                              |
|--------------|----------------|--------------|---------|--------------------------------------------------------------------|
| id           | string         | yes (system) | —       | Prefix `cacl_`.                                                    |
| amount       | bigNumber      | yes          | —       | Positive = credit toward cart; negative = surcharge.               |
| reference    | string \| null | no           | null    | Name of the referenced aggregate (e.g. `"refund"`, `"gift_card"`). |
| reference_id | string \| null | no           | null    | ID in the referenced aggregate.                                    |
| metadata     | json \| null   | no           | null    |                                                                    |

---

## 7. Commands (Aggregate Boundary)

The Cart aggregate exposes **17 commands**. Each has a 1:1 domain event. Workflow-level orchestration (promotion evaluation, tax calculation, order creation) is explicitly **not** an aggregate command — it happens outside, and each decision is translated into one of the commands below with already-resolved data.

| #  | Command                          | Payload (aggregate-facing)                                                                                                                                                                                    | Notes                                                                                                                                      |
|----|----------------------------------|---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|--------------------------------------------------------------------------------------------------------------------------------------------|
| 1  | **CreateCart**                   | `currency_code` (create-only, required), `region_id?`, `customer_id?`, `sales_channel_id?`, `email?`, `locale?`, `metadata?`, `items?: LineItem[]`, `billing_address?: Address`, `shipping_address?: Address` | Atomic: may seed line items and addresses.                                                                                                 |
| 2  | **UpdateCart**                   | `id`, `region_id?`, `customer_id?`, `sales_channel_id?`, `email?`, `locale?`, `metadata?`                                                                                                                     | Header fields only. `currency_code` is treated as create-only by convention.                                                               |
| 3  | **DeleteCart**                   | `id`                                                                                                                                                                                                          | Soft-delete; cascades to items, shipping methods, addresses.                                                                               |
| 4  | **SetShippingAddress**           | `cartId`, `address: Address` (full replacement)                                                                                                                                                               | VO replace-semantics.                                                                                                                      |
| 5  | **SetBillingAddress**            | `cartId`, `address: Address` (full replacement)                                                                                                                                                               | VO replace-semantics.                                                                                                                      |
| 6  | **AddLineItem**                  | `cartId`, `items: LineItem[]` (each with `title`, `quantity`, `unit_price` required; product/variant snapshot fields optional)                                                                                | Creates entities; cart existence is asserted first.                                                                                        |
| 7  | **UpdateLineItem**               | `lineItemId`, partial fields (`title?`, `quantity?`, `unit_price?`, `metadata?`, …)                                                                                                                           | Per-item update.                                                                                                                           |
| 8  | **RemoveLineItem**               | `lineItemIds`                                                                                                                                                                                                 | Soft-delete.                                                                                                                               |
| 9  | **AddShippingMethod**            | `cartId`, `methods: ShippingMethod[]` (each with `name`, `amount` required)                                                                                                                                   | Invariant: `amount >= 0`.                                                                                                                  |
| 10 | **RemoveShippingMethod**         | `shippingMethodIds`                                                                                                                                                                                           | Soft-delete.                                                                                                                               |
| 11 | **SetLineItemAdjustments**       | `cartId`, `adjustments: LineItemAdjustment[]` — items with an `id` are updated, items without `id` are created, adjustments not present in the list are removed                                               | **Set-replacement.** Passing `[]` clears all adjustments for the cart.                                                                     |
| 12 | **SetShippingMethodAdjustments** | `cartId`, `adjustments: ShippingMethodAdjustment[]`                                                                                                                                                           | Set-replacement.                                                                                                                           |
| 13 | **SetLineItemTaxLines**          | `cartId`, `taxLines: LineItemTaxLine[]`                                                                                                                                                                       | Set-replacement.                                                                                                                           |
| 14 | **SetShippingMethodTaxLines**    | `cartId`, `taxLines: ShippingMethodTaxLine[]`                                                                                                                                                                 | Set-replacement.                                                                                                                           |
| 15 | **AddCreditLine**                | `cartId`, `creditLines: CreditLine[]` (each with `amount`, optional `reference`, `reference_id`, `metadata`)                                                                                                  |                                                                                                                                            |
| 16 | **RemoveCreditLine**             | `creditLineIds`                                                                                                                                                                                               | Soft-delete.                                                                                                                               |
| 17 | **RestoreCart**                  | `id`                                                                                                                                                                                                          | Un-does a soft-delete (also available for line items, shipping methods). Merged at aggregate level as "restore whatever was soft-deleted". |

**Commands explicitly merged or omitted:**
- `addLineItemAdjustments` / `addShippingMethodAdjustments` — merged into the canonical `Set…` commands (per CLAUDE.md example, `setLineItemAdjustments` is the aggregate command; `add…` is orchestration sugar).
- `upsertLineItemTaxLines` / `upsertShippingMethodTaxLines` — merged into the canonical `Set…` commands.
- `addLineItemTaxLines` / `addShippingMethodTaxLines` — merged into the canonical `Set…` commands.
- Cart completion (create order) — **not** an aggregate command; lives in a cross-aggregate workflow.
- Promotion evaluation (compute which adjustments to apply) — **not** an aggregate command; lives in the promotion workflow which then calls `SetLineItemAdjustments`.
- Tax calculation — **not** an aggregate command; lives in the tax workflow which then calls `SetLineItemTaxLines` / `SetShippingMethodTaxLines`.

---

## 8. Domain Events

One event per command. Event payload is the shape of the new/changed state of the aggregate slice affected.

| #  | Event                        | Emitted by                   |
|----|------------------------------|------------------------------|
| 1  | CartCreated                  | CreateCart                   |
| 2  | CartUpdated                  | UpdateCart                   |
| 3  | CartDeleted                  | DeleteCart                   |
| 4  | ShippingAddressSet           | SetShippingAddress           |
| 5  | BillingAddressSet            | SetBillingAddress            |
| 6  | LineItemAdded                | AddLineItem                  |
| 7  | LineItemUpdated              | UpdateLineItem               |
| 8  | LineItemRemoved              | RemoveLineItem               |
| 9  | ShippingMethodAdded          | AddShippingMethod            |
| 10 | ShippingMethodRemoved        | RemoveShippingMethod         |
| 11 | LineItemAdjustmentsSet       | SetLineItemAdjustments       |
| 12 | ShippingMethodAdjustmentsSet | SetShippingMethodAdjustments |
| 13 | LineItemTaxLinesSet          | SetLineItemTaxLines          |
| 14 | ShippingMethodTaxLinesSet    | SetShippingMethodTaxLines    |
| 15 | CreditLineAdded              | AddCreditLine                |
| 16 | CreditLineRemoved            | RemoveCreditLine             |
| 17 | CartRestored                 | RestoreCart                  |

---

## 9. Read Models / Queries

The aggregate exposes one core query, **GetCart**, with heavy derived-field projection. Totals are computed on read and never stored.

### Query: GetCart

Inputs: `cartId`, optional relation selectors (`items.adjustments`, `items.tax_lines`, `shipping_methods.adjustments`, `shipping_methods.tax_lines`, `credit_lines`, `billing_address`, `shipping_address`).

Returns the full Cart with all related entities **plus** the following computed fields:

**Cart-level totals (all monetary, `bigNumber`):**

| Field                       | Description                                                               |
|-----------------------------|---------------------------------------------------------------------------|
| item_total                  | Sum of line-item totals **after** discounts.                              |
| item_subtotal               | Sum of line-item subtotals **after** discounts (pre-tax).                 |
| item_tax_total              | Sum of line-item tax totals.                                              |
| original_item_total         | Sum of line-item totals **before** any discounts.                         |
| original_item_subtotal      | Sum of line-item subtotals before discounts.                              |
| original_item_tax_total     | Sum of line-item tax totals before discounts.                             |
| shipping_total              | Sum of shipping method totals after discounts.                            |
| shipping_subtotal           | Shipping subtotal after discounts (pre-tax).                              |
| shipping_tax_total          | Shipping tax total.                                                       |
| original_shipping_total     | Shipping total before discounts.                                          |
| original_shipping_subtotal  | Shipping subtotal before discounts.                                       |
| original_shipping_tax_total | Shipping tax total before discounts.                                      |
| discount_total              | Sum of all adjustment amounts (item + shipping).                          |
| discount_tax_total          | Tax portion of discounts.                                                 |
| tax_total                   | Overall tax total (items + shipping).                                     |
| subtotal                    | `item_subtotal + shipping_subtotal` (pre-tax, after discounts).           |
| total                       | Final payable amount (items + shipping + tax − discounts − credit lines). |
| original_total              | Total before any discounts.                                               |
| original_subtotal           | Subtotal before discounts.                                                |
| original_tax_total          | Tax total before discounts.                                               |
| gift_card_total             | Sum of gift-card credits applied.                                         |
| gift_card_tax_total         | Tax portion of gift-card credits.                                         |
| credit_line_total           | Sum of all credit line amounts (projection-only).                         |
| credit_line_subtotal        | Subtotal of credit-line-affecting amount (projection-only).               |
| credit_line_tax_total       | Tax portion of credit lines (projection-only).                            |

**LineItem-level projections (per item):** `subtotal`, `total`, `tax_total`, `discount_total`, `discount_tax_total`, `original_total`, `original_subtotal`, `original_tax_total`, `item_total`, `item_subtotal`, `item_tax_total`.

**ShippingMethod-level projections (per method):** `subtotal`, `total`, `tax_total`, `discount_total`, `discount_tax_total`, `original_total`, `original_subtotal`, `original_tax_total`.

### Secondary Queries (lightweight list/lookup)

| Query                                 | Purpose                                                   |
|---------------------------------------|-----------------------------------------------------------|
| ListCarts(filter, pagination)         | Admin listing / customer cart history.                    |
| ListLineItems(filter)                 | Rarely used at aggregate level; mostly admin diagnostics. |
| ListShippingMethods(filter)           | Admin diagnostics.                                        |
| ListLineItemAdjustments(filter)       | Diagnostic read.                                          |
| ListShippingMethodAdjustments(filter) | Diagnostic read.                                          |
| ListLineItemTaxLines(filter)          | Diagnostic read.                                          |
| ListShippingMethodTaxLines(filter)    | Diagnostic read.                                          |

---

## 10. Invariants

1. **Currency is fixed at creation** — `currency_code` is required on `CreateCart`; treated as create-only thereafter.
2. **Currency code normalisation** — stored lower-case (the aggregate normalises input automatically).
3. **LineItem requires `title`, `quantity`, `unit_price`** — missing any of these raises `INVALID_DATA`.
4. **ShippingMethod requires `name`, `amount`** — `amount >= 0` enforced; negative amounts are rejected.
5. **LineItemAdjustment.amount >= 0** — enforced at the aggregate boundary.
6. **Set-replacement for adjustments and tax lines** — `SetLineItemAdjustments`, `SetShippingMethodAdjustments`, `SetLineItemTaxLines`, `SetShippingMethodTaxLines` always replace the entire collection for the cart. Items with an `id` are updated, items without an `id` are created, and anything not in the input is soft-deleted. You cannot patch a single adjustment.
7. **Adjustments target owned children only** — adding an adjustment whose `item_id` does not belong to a line item of the target cart, or whose `shipping_method_id` does not belong to a shipping method of the target cart, is rejected with `INVALID_DATA`.
8. **Cart must exist for any child mutation** — all child commands (`AddLineItem`, `AddShippingMethod`, `Set*`) verify the cart exists before applying; missing carts raise `NOT_FOUND`.
9. **Product/variant data is snapshotted at add-time** — once a line item is in the cart, later changes to the source catalogue do not mutate it.
10. **Totals are projection-only** — every `*_total`, `*_subtotal`, `discount_total`, `tax_total`, `original_*`, `gift_card_*`, `credit_line_*` field is computed on read, never stored or asserted on write.
11. **Deletion is soft** — `DeleteCart`, `RemoveLineItem`, `RemoveShippingMethod`, `RemoveCreditLine`, and the implicit removes in `Set*` are soft-deletes; a `CartRestored` command can undo them.
12. **Cart completion is outside the aggregate** — the aggregate only holds `completed_at` as a marker; transitioning it is done by the external order-creation workflow.

---

## 11. External References

The following fields carry IDs of other aggregates. Only the ID is modelled; the external aggregate's internals are not.

| Field                                                                  | Points to                                              |
|------------------------------------------------------------------------|--------------------------------------------------------|
| Cart.region_id                                                         | Region aggregate                                       |
| Cart.customer_id                                                       | Customer aggregate                                     |
| Cart.sales_channel_id                                                  | Sales Channel aggregate                                |
| Address.customer_id                                                    | Customer aggregate                                     |
| LineItem.variant_id, product_id, product_type_id                       | Product aggregate (snapshotted)                        |
| ShippingMethod.shipping_option_id                                      | Fulfillment / Shipping Option aggregate                |
| LineItemAdjustment.promotion_id, ShippingMethodAdjustment.promotion_id | Promotion aggregate                                    |
| LineItemTaxLine.tax_rate_id, ShippingMethodTaxLine.tax_rate_id         | Tax aggregate                                          |
| CreditLine.reference + reference_id                                    | Arbitrary external aggregate (refund, gift card, etc.) |

Cross-aggregate orchestration that is out of scope but exists in the codebase:
- **Cart completion** → Order aggregate (workflow in `packages/core/core-flows/src/cart/workflows/complete-cart.ts`).
- **Promotion evaluation** → Promotion aggregate computes adjustments, then calls `SetLineItemAdjustments` / `SetShippingMethodAdjustments`.
- **Tax calculation** → Tax aggregate computes tax lines, then calls `SetLineItemTaxLines` / `SetShippingMethodTaxLines`.
- **Inventory reservation** → Inventory aggregate, triggered around completion.
- **Pricing** → Pricing aggregate resolves `unit_price` before `AddLineItem`.

---

## 12. Tests (at the aggregate boundary)

Extracted from `packages/modules/cart/integration-tests/__tests__/services/cart-module/index.spec.ts`. Rephrased in business language.

### CreateCart
- Given no cart exists, When the caller creates a cart with currency code EUR, Then a cart is returned with an assigned id and currency code EUR.
- Given no cart exists, When the caller creates a cart without a currency code, Then the command is rejected with a required-field error on currency_code.
- Given no cart exists, When the caller creates a cart with an inline billing address and shipping address, Then the cart is returned with both addresses attached.
- Given an address already exists, When the caller creates a cart referencing that address id as both billing and shipping, Then the cart is returned with both addresses pointing to the referenced address.
- Given no cart exists, When the caller creates a cart with an inline line item (title, quantity, unit_price), Then the cart is returned with that line item in its items collection.
- Given no carts exist, When the caller creates two carts in one call (one EUR with item A, one USD with item B), Then both carts are created with their respective items.

### UpdateCart
- Given a cart exists, When the caller updates the cart's email, Then the cart is returned with the new email.
- Given a cart exists, When the caller updates the cart via a selector that matches it, Then the cart is updated.
- Given no cart with a given id exists, When the caller updates that id, Then the command is rejected with a not-found error.

### DeleteCart
- Given a cart exists, When the caller deletes it, Then it is no longer listed for that id.

### SetShippingAddress / SetBillingAddress (via createAddresses + updateCarts)
- Given a cart exists and an address is created, When the caller attaches the address id as the cart's shipping address, Then the cart reflects that shipping address.
- Given an address is attached to a cart, When the caller updates first_name on that address, Then the cart's shipping address reflects the new first name.
- Given an address exists, When the caller deletes it, Then it is no longer listed.

### AddLineItem
- Given a cart exists, When the caller adds a line item with title, quantity 1 and unit price 100, Then the cart contains exactly one line item with those values.
- Given a cart exists, When the caller adds several line items in one call, Then all items are present on the cart.
- Given two carts exist, When the caller adds line items for both carts in one call, Then each cart receives its respective items.
- Given a cart id that does not exist, When the caller adds a line item, Then the command is rejected with a not-found error.
- Given a cart exists, When the caller adds a line item missing `quantity`, Then the command is rejected with a required-field error on quantity.

### UpdateLineItem
- Given a line item exists, When the caller updates its title via id, Then the new title is returned.
- Given a line item exists, When the caller updates its title via a cart_id selector, Then the matching line item's title is updated.
- Given several line items exist across carts, When the caller updates via multiple selectors in one call, Then every matching line item is updated.

### RemoveLineItem
- Given a line item exists on a cart, When the caller removes it, Then the cart's items collection is empty.
- Given multiple line items exist on a cart, When the caller removes them all, Then the cart's items collection is empty.

### AddShippingMethod
- Given a cart exists, When the caller adds a shipping method with name and amount 100, Then the method appears on the cart.
- Given a cart exists, When the caller adds a shipping method with a negative amount, Then the command is rejected (check-constraint violation).
- Given two carts exist, When the caller adds a shipping method to each in one call, Then each cart receives its method.

### RemoveShippingMethod
- Given a cart has a shipping method, When the caller removes it, Then the cart has no shipping methods.

### SetLineItemAdjustments
- Given a cart has line items, When the caller sets adjustments for each line item, Then those adjustments are present.
- Given a cart already has a line-item adjustment, When the caller sets a different adjustment for the same line item, Then only the new adjustment remains.
- Given a cart has line-item adjustments, When the caller sets the adjustments to an empty list, Then all adjustments on all line items are removed.
- Given a cart has a line-item adjustment with id A, When the caller sets adjustments containing id A with changed fields, Then the adjustment with id A is updated in place.

### SetShippingMethodAdjustments
- Given a cart has shipping methods, When the caller sets adjustments for each shipping method, Then those adjustments are present.
- Given a cart has a shipping-method adjustment, When the caller sets a different adjustment for the same shipping method, Then only the new one remains.
- Given a cart has shipping-method adjustments, When the caller sets them to empty, Then all are removed.
- Given a shipping method belongs to cart A, When the caller tries to add an adjustment for that method against cart B, Then the command is rejected because the shipping method does not belong to cart B.

### SetLineItemTaxLines
- Given a cart has line items, When the caller sets tax lines per item (code, rate), Then those tax lines are present.
- Given a cart has a line-item tax line, When the caller sets a different tax line for the same item, Then only the new one remains.
- Given a cart has line-item tax lines, When the caller sets them to empty, Then all are removed.
- Given a cart has two tax lines on one item, When the caller sets a list containing one updated existing id and one brand-new tax line, Then the updated line is updated, the new line is created, and the omitted line is removed.

### SetShippingMethodTaxLines
- Given a cart has shipping methods, When the caller sets tax lines per method, Then those tax lines are present.
- Given a cart has a shipping tax line, When the caller sets a different tax line for the same method, Then only the new one remains.
- Given a cart has shipping tax lines, When the caller sets them to empty, Then all are removed.
- Given a cart has two shipping tax lines on one method, When the caller sets a list with one updated existing id and one new line, Then the updated line is updated, the new line is created, and the omitted line is removed.

### GetCart (totals projection)
- Given a cart has two line items (qty 1 × 100, qty 2 × 200), each with a matching adjustment (100 and 200), and a shipping method of 10, When the caller retrieves the cart with totals, Then the cart projects `item_total = 200`, `original_item_total = 500`, `shipping_total = 10`, `discount_total = 300`, `total = 210`, `subtotal = 510`, `tax_total = 0`.
