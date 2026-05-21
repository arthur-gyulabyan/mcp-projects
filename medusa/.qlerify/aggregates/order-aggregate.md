# Order Aggregate — Standalone DDD Model

**Source:** `packages/modules/order/` (Medusa monorepo).
**Service entry point:** `OrderModuleService` (`packages/modules/order/src/services/order-module-service.ts`).
**Bounded context:** `Order Management`.

The Medusa Order module physically hosts four distinct aggregates: **Order**, **Order Change**, **Return**, **Claim**, and **Exchange**. They share infrastructure (transactions, shipping methods, the OrderChangeAction projection) but each has its own root, lifecycle, and command surface. This artifact covers **only the Order aggregate**: creation, mutation of items/shipping/transactions/credit lines, fulfillment tracking, and the place/complete/cancel/archive lifecycle. Cross-aggregate orchestration (place order, capture payment, allocate inventory, evaluate promotions, create returns) lives in `packages/core/core-flows/` and is out of scope. Order Change, Return, Claim, and Exchange are out of scope and modeled as separate aggregates in their own artifacts.

## 1. Aggregate Hierarchy

```
Order (aggregate root)
├── shippingAddress      : Address                       (Value Object — set-replaced)
├── billingAddress       : Address                       (Value Object — set-replaced)
├── items[]              : Order Item                    (Related Entity — add/update/remove)
│   └── item             : Order Line Item               (Value Object — snapshot, set-replaced)
│       ├── taxLines[]   : Line Item Tax Line            (Value Object — set-replaced)
│       └── adjustments[]: Line Item Adjustment          (Value Object — set-replaced)
├── shippingMethods[]    : Order Shipping                (Related Entity — add/remove)
│   └── shippingMethod   : Shipping Method               (Value Object — snapshot)
│       ├── taxLines[]   : Shipping Method Tax Line      (Value Object — set-replaced)
│       └── adjustments[]: Shipping Method Adjustment    (Value Object — set-replaced)
├── transactions[]       : Order Transaction             (Related Entity — add/remove)
├── creditLines[]        : Order Credit Line             (Related Entity — add only)
└── summary              : Order Summary                 (Value Object — computed, replaced on mutation)
```

**Why these classifications:**

- **Order Item** is a Related Entity. It owns the **mutable** state about an ordered line: customer-ordered quantity, fulfilled/shipped/delivered/returned tracking quantities. Each one has independent add/update lifecycle commands and its own identity in the business vocabulary.
- **Order Line Item** is a Value Object even though the implementation has an `id` column. It is a **frozen product snapshot** captured at order time: title, variant id, product handle, unit price, sku, etc. It cannot be mutated in place — when product details change, the line item is replaced wholesale.
- **Order Shipping** is a Related Entity (each shipping selection has independent add/remove). The **Shipping Method** it points to is a Value Object — an immutable snapshot of the rate at the moment of selection.
- **Order Transaction** is a Related Entity. Each transaction (capture, refund) has an independent identity, can be added and removed (e.g., to correct a payment record), and tracks an external reference id.
- **Order Credit Line** is a Related Entity (it can be added individually with its own id and amount).
- **Address** is a Value Object: it has at most one shipping address and one billing address; assigning a new address replaces the previous one wholesale. Despite a DB id, there is no in-place update.
- **Order Summary** is a Value Object: it holds only computed totals (`total`, `subtotal`, `tax_total`, etc.). On every mutation, a new summary is written for the new order version, superseding the previous one.
- **Tax Lines and Adjustments** (both on line items and on shipping methods) are exposed only as full set-replacements. They are Value Objects.

## 2. Aggregate Root: Order

A purchase placed by (or on behalf of) a customer at a sales channel, priced in a single currency, scoped to a region. The aggregate tracks the order from creation through fulfillment, completion or cancellation, and eventual archival. Returns, claims, exchanges, and structural edits go through the separate Order Change aggregate which mutates Order via change actions.

### Attributes (Order)

| Attribute        | Type                | Req | Default | Notes                                                                                  |
|------------------|---------------------|-----|---------|----------------------------------------------------------------------------------------|
| id               | string              | yes | gen     | Prefix `order_`. Create-only.                                                          |
| displayId        | number              | yes | auto    | Sequential human-readable id.                                                          |
| customDisplayId  | string \| null      | no  | null    | Merchant-defined alternative order number.                                             |
| version          | number              | yes | 1       | Optimistic lock; incremented on each mutation. Child entities snapshot this version.   |
| status           | OrderStatus         | yes | pending | One of: pending, completed, draft, archived, canceled, requires_action.                |
| isDraftOrder     | boolean             | yes | false   | Whether this is a pre-placement draft order.                                           |
| customerId       | string \| null      | no  | null    | External reference → Customer aggregate.                                               |
| regionId         | string \| null      | no  | null    | External reference → Region aggregate.                                                 |
| salesChannelId   | string \| null      | no  | null    | External reference → Sales Channel aggregate.                                          |
| email            | string \| null      | no  | null    | Buyer email.                                                                           |
| currencyCode     | string (ISO-4217)   | yes | —       | Lower-case. Create-only (cannot be changed once order exists).                         |
| locale           | string \| null      | no  | null    | e.g. `en_US`.                                                                          |
| noNotification   | boolean \| null     | no  | null    | Suppresses customer notifications for this order.                                      |
| metadata         | object \| null      | no  | null    | Merchant extension fields.                                                             |
| canceledAt       | timestamp \| null   | no  | null    | When the order was canceled; null while not canceled.                                  |
| shippingAddress  | Address \| null     | no  | null    | Replaces wholesale.                                                                    |
| billingAddress   | Address \| null     | no  | null    | Replaces wholesale.                                                                    |
| items            | Order Item[]        | no  | []      | Owned collection (§4).                                                                 |
| shippingMethods  | Order Shipping[]    | no  | []      | Owned collection (§5).                                                                 |
| transactions     | Order Transaction[] | no  | []      | Owned collection (§6).                                                                 |
| creditLines      | Order Credit Line[] | no  | []      | Owned collection (§7).                                                                 |
| summary          | Order Summary       | yes | gen     | Owned VO (§8). Recomputed on every mutation.                                           |

## 3. Value Object: Address (shipping / billing)

An immutable postal address attached to the order at order time. Replaced wholesale when the shipping or billing address changes; the previous record is disowned (kept for audit but unreferenced).

| Attribute    | Type              | Req | Default | Notes                                          |
|--------------|-------------------|-----|---------|------------------------------------------------|
| firstName    | string \| null    | no  | null    | Recipient first name.                          |
| lastName     | string \| null    | no  | null    | Recipient last name.                           |
| company      | string \| null    | no  | null    | Company name.                                  |
| address1     | string \| null    | no  | null    | Street line 1.                                 |
| address2     | string \| null    | no  | null    | Street line 2.                                 |
| city         | string \| null    | no  | null    | City.                                          |
| countryCode  | string \| null    | no  | null    | ISO 3166-1 alpha-2.                            |
| province     | string \| null    | no  | null    | State / province / region.                     |
| postalCode   | string \| null    | no  | null    | ZIP / postal code.                             |
| phone        | string \| null    | no  | null    | Contact phone.                                 |
| metadata     | object \| null    | no  | null    | Extension fields.                              |

## 4. Related Entity: Order Item

A single line in the order with its own identity. Tracks the **customer-ordered quantity** plus the fulfillment lifecycle quantities (fulfilled / shipped / delivered / returned / written off). Carries a Value Object snapshot of the purchased product (`item`).

### Attributes (Order Item)

| Attribute               | Type            | Req | Default | Notes                                                                     |
|-------------------------|-----------------|-----|---------|---------------------------------------------------------------------------|
| id                      | string          | yes | gen     | Prefix `orditem_`. Create-only.                                           |
| version                 | number          | yes | —       | Matches the Order version at creation.                                    |
| quantity                | number          | yes | —       | Customer-ordered quantity. Mutable until fulfilled.                       |
| unitPrice               | number \| null  | no  | null    | Per-unit price as captured on the order (may differ from item.unitPrice). |
| compareAtUnitPrice      | number \| null  | no  | null    | MSRP for display.                                                         |
| fulfilledQuantity       | number          | yes | 0       | Picked & packed quantity.                                                 |
| shippedQuantity         | number          | yes | 0       | In-transit quantity.                                                      |
| deliveredQuantity       | number          | yes | 0       | Delivered-to-customer quantity.                                           |
| returnRequestedQuantity | number          | yes | 0       | Quantity requested for return.                                            |
| returnReceivedQuantity  | number          | yes | 0       | Quantity received back in returns.                                        |
| returnDismissedQuantity | number          | yes | 0       | Quantity returned but rejected.                                           |
| writtenOffQuantity      | number          | yes | 0       | Lost / damaged / unrecoverable.                                           |
| metadata                | object \| null  | no  | null    | Extension fields.                                                         |
| item                    | Order Line Item | yes | —       | Owned product snapshot VO (§4.1).                                         |

### 4.1 Value Object: Order Line Item (product snapshot)

A frozen snapshot of the purchased product/variant at order time. Cannot be updated in place — when the underlying product changes, the line item is replaced wholesale.

| Attribute           | Type                   | Req | Default | Notes                               |
|---------------------|------------------------|-----|---------|-------------------------------------|
| title               | string                 | yes | —       | Product name at order time.         |
| subtitle            | string \| null         | no  | null    | Secondary product name.             |
| thumbnail           | string \| null         | no  | null    | Product image URL.                  |
| variantId           | string \| null         | no  | null    | External ref → Product Variant.     |
| productId           | string \| null         | no  | null    | External ref → Product.             |
| productTitle        | string \| null         | no  | null    | Snapshot.                           |
| productDescription  | string \| null         | no  | null    | Snapshot.                           |
| productSubtitle     | string \| null         | no  | null    | Snapshot.                           |
| productType         | string \| null         | no  | null    | Snapshot.                           |
| productTypeId       | string \| null         | no  | null    | External ref → Product Type.        |
| productCollection   | string \| null         | no  | null    | Snapshot.                           |
| productHandle       | string \| null         | no  | null    | Snapshot slug.                      |
| variantSku          | string \| null         | no  | null    | Snapshot.                           |
| variantBarcode      | string \| null         | no  | null    | Snapshot.                           |
| variantTitle        | string \| null         | no  | null    | Snapshot.                           |
| variantOptionValues | object \| null         | no  | null    | e.g. `{ color: "Red", size: "L" }`. |
| requiresShipping    | boolean                | yes | true    | Whether item is shippable.          |
| isGiftcard          | boolean                | yes | false   | Is this a gift card.                |
| isDiscountable      | boolean                | yes | true    | Can be discounted.                  |
| isTaxInclusive      | boolean                | yes | false   | Price includes tax.                 |
| isCustomPrice       | boolean                | yes | false   | Merchant overrode price.            |
| unitPrice           | number \| null         | no  | null    | Unit price at order time.           |
| compareAtUnitPrice  | number \| null         | no  | null    | MSRP at order time.                 |
| metadata            | object \| null         | no  | null    | Extension fields.                   |
| taxLines            | Line Item Tax Line[]   | no  | []      | Set-replaced (§4.2).                |
| adjustments         | Line Item Adjustment[] | no  | []      | Set-replaced (§4.3).                |

### 4.2 Value Object: Line Item Tax Line

Tax applied to a line item; set-replaced as a whole.

| Attribute   | Type            | Req | Default | Notes                                       |
|-------------|-----------------|-----|---------|---------------------------------------------|
| description | string \| null  | no  | null    | Tax label.                                  |
| taxRateId   | string \| null  | no  | null    | External ref → Tax Rate.                    |
| code        | string          | yes | —       | Tax code.                                   |
| rate        | number          | yes | —       | Decimal rate (e.g. `0.0725`).               |
| providerId  | string \| null  | no  | null    | Tax provider identifier.                    |

### 4.3 Value Object: Line Item Adjustment

Discount or surcharge on a line item; set-replaced as a whole.

| Attribute      | Type           | Req | Default | Notes                                          |
|----------------|----------------|-----|---------|------------------------------------------------|
| description    | string \| null | no  | null    | Adjustment reason.                             |
| code           | string \| null | no  | null    | Promotion code if applicable.                  |
| amount         | number         | yes | —       | Negative for discount, positive for surcharge. |
| promotionId    | string \| null | no  | null    | External ref → Promotion.                      |
| providerId     | string \| null | no  | null    | Discount provider.                             |
| isTaxInclusive | boolean        | yes | false   | Whether amount includes tax.                   |

## 5. Related Entity: Order Shipping

A shipping selection on the order. Owns a snapshot of the shipping method that was selected.

| Attribute       | Type            | Req | Default | Notes                                            |
|-----------------|-----------------|-----|---------|--------------------------------------------------|
| id              | string          | yes | gen     | Prefix `ordspmv_`. Create-only.                  |
| version         | number          | yes | —       | Matches the Order version at creation.           |
| shippingMethod  | Shipping Method | yes | —       | Owned snapshot VO (§5.1).                        |

### 5.1 Value Object: Shipping Method (snapshot)

| Attribute        | Type                         | Req | Default | Notes                                          |
|------------------|------------------------------|-----|---------|------------------------------------------------|
| name             | string                       | yes | —       | e.g. "UPS Ground".                             |
| description      | object \| null               | no  | null    | e.g. `{ estimatedDays: 5 }`.                   |
| amount           | number                       | yes | —       | Shipping cost at selection time.               |
| isTaxInclusive   | boolean                      | yes | false   | Whether amount includes tax.                   |
| isCustomAmount   | boolean                      | yes | false   | Merchant overrode the rate.                    |
| shippingOptionId | string \| null               | no  | null    | External ref → Shipping Option.                |
| data             | object \| null               | no  | null    | Provider-specific payload (e.g. carrier data). |
| metadata         | object \| null               | no  | null    | Extension fields.                              |
| taxLines         | Shipping Method Tax Line[]   | no  | []      | Set-replaced (§5.2).                           |
| adjustments      | Shipping Method Adjustment[] | no  | []      | Set-replaced (§5.3).                           |

### 5.2 Value Object: Shipping Method Tax Line

| Attribute   | Type            | Req | Default | Notes                                       |
|-------------|-----------------|-----|---------|---------------------------------------------|
| description | string \| null  | no  | null    | Tax label.                                  |
| taxRateId   | string \| null  | no  | null    | External ref → Tax Rate.                    |
| code        | string          | yes | —       | Tax code.                                   |
| rate        | number          | yes | —       | Decimal rate.                               |
| providerId  | string \| null  | no  | null    | Tax provider.                               |

### 5.3 Value Object: Shipping Method Adjustment

| Attribute       | Type           | Req | Default | Notes                                       |
|-----------------|----------------|-----|---------|---------------------------------------------|
| description     | string \| null | no  | null    | Adjustment reason.                          |
| code            | string \| null | no  | null    | Promotion code.                             |
| amount          | number         | yes | —       | Adjustment amount.                          |
| promotionId     | string \| null | no  | null    | External ref → Promotion.                   |
| providerId      | string \| null | no  | null    | Provider.                                   |

## 6. Related Entity: Order Transaction

A payment-related transaction record (capture or refund) attached to the order. Each has its own identity and can be added or removed (e.g., to correct a misposted transaction).

| Attribute      | Type            | Req | Default | Notes                                                                |
|----------------|-----------------|-----|---------|----------------------------------------------------------------------|
| id             | string          | yes | gen     | Prefix `ordtrx_`. Create-only.                                       |
| version        | number          | yes | —       | Matches the Order version at creation.                               |
| amount         | number          | yes | —       | Transaction amount. Positive for capture, negative for refund.       |
| currencyCode   | string          | yes | —       | ISO 4217.                                                            |
| reference      | string \| null  | no  | null    | Transaction kind (e.g. `capture`, `refund`).                         |
| referenceId    | string \| null  | no  | null    | External processor transaction id.                                   |

## 7. Related Entity: Order Credit Line

An issued credit against the order (e.g., for refunds, goodwill, or adjustments).

| Attribute     | Type            | Req | Default | Notes                                                  |
|---------------|-----------------|-----|---------|--------------------------------------------------------|
| id            | string          | yes | gen     | Prefix `ordcl_`. Create-only.                          |
| version       | number          | yes | —       | Matches the Order version at creation.                 |
| amount        | number          | yes | —       | Credit amount.                                         |
| reference     | string \| null  | no  | null    | Credit reason / type (e.g. `refund`, `adjustment`).    |
| referenceId   | string \| null  | no  | null    | External reference id.                                 |
| metadata      | object \| null  | no  | null    | Extension fields.                                      |

## 8. Value Object: Order Summary (computed totals)

A snapshot of the order's computed monetary state at a given version. Recomputed and rewritten as a new summary for the new version every time the order mutates in any way that affects totals.

| Attribute | Type   | Req | Default | Notes                                                                                                             |
|-----------|--------|-----|---------|-------------------------------------------------------------------------------------------------------------------|
| version   | number | yes | —       | Matches the Order version this summary was computed for.                                                          |
| totals    | object | yes | —       | `{ total, subtotal, taxTotal, shippingTotal, discountTotal, refundedTotal, paidTotal, ... }` (see §9 read model). |

## 9. Commands (Aggregate Boundary)

The Order aggregate exposes **16 commands**. Each has a 1:1 domain event. Cross-aggregate orchestration (place cart, capture payment, allocate inventory, evaluate promotions, create returns, exchanges, claims) lives outside.

| #  | Command                    | Payload (aggregate-facing)                                                                                                                                                                          | Notes                                                                                       |
|----|----------------------------|-----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|---------------------------------------------------------------------------------------------|
| 1  | **Create Order**           | `currencyCode`, `customerId?`, `regionId?`, `salesChannelId?`, `email?`, `customDisplayId?`, `metadata?`, `shippingAddress?`, `billingAddress?`, `items?[]`, `shippingMethods?[]`, `creditLines?[]` | Atomic. May seed items, shipping methods, addresses, credit lines.                          |
| 2  | **Update Order**           | `id`, `customerId?`, `regionId?`, `salesChannelId?`, `email?`, `metadata?`, `noNotification?`                                                                                                       | Cannot change `currencyCode`. Cannot change `status` directly — use the lifecycle commands. |
| 3  | **Add Line Items**         | `id`, `items[]` of `{ quantity, unitPrice?, compareAtUnitPrice?, item: { ...product snapshot, taxLines?, adjustments? } }`                                                                          | Creates new Order Item + Order Line Item snapshots.                                         |
| 4  | **Update Line Items**      | `id`, `items[]` of `{ id, quantity?, unitPrice?, compareAtUnitPrice?, metadata? }`                                                                                                                  | Mutates customer-ordered quantity / price. Does NOT touch fulfillment-tracking quantities.  |
| 5  | **Add Shipping Methods**   | `id`, `shippingMethods[]` of `{ shippingMethod: { name, amount, ...snapshot, taxLines?, adjustments? } }`                                                                                           | Creates new Order Shipping + Shipping Method snapshots.                                     |
| 6  | **Remove Shipping Method** | `id`, `shippingMethods[]` of `{ id }`                                                                                                                                                               | Soft-deletes the selected shipping selection(s).                                            |
| 7  | **Add Transactions**       | `id`, `transactions[]` of `{ amount, currencyCode, reference?, referenceId? }`                                                                                                                      | Records capture or refund transactions.                                                     |
| 8  | **Remove Transactions**    | `id`, `transactions[]` of `{ id }`                                                                                                                                                                  | Soft-deletes the transaction record(s).                                                     |
| 9  | **Add Credit Lines**       | `id`, `creditLines[]` of `{ amount, reference?, referenceId?, metadata? }`                                                                                                                          | Issues credits against the order.                                                           |
| 10 | **Register Fulfillment**   | `id`, `items[]` of `{ id, fulfilledQuantity }`                                                                                                                                                      | Increments `fulfilledQuantity` on each Order Item.                                          |
| 11 | **Cancel Fulfillment**     | `id`, `items[]` of `{ id, fulfilledQuantity }`                                                                                                                                                      | Decrements `fulfilledQuantity` (reverses an earlier fulfillment).                           |
| 12 | **Register Shipment**      | `id`, `items[]` of `{ id, shippedQuantity }`                                                                                                                                                        | Increments `shippedQuantity`.                                                               |
| 13 | **Register Delivery**      | `id`, `items[]` of `{ id, deliveredQuantity }`                                                                                                                                                      | Increments `deliveredQuantity`.                                                             |
| 14 | **Complete Order**         | `id`                                                                                                                                                                                                | `pending` / `requires_action` → `completed`. Rejects if `canceled`.                         |
| 15 | **Cancel Order**           | `id`                                                                                                                                                                                                | Sets `canceled_at`, status → `canceled`. Rejects if `completed`.                            |
| 16 | **Archive Order**          | `id`                                                                                                                                                                                                | `completed` / `canceled` / `draft` → `archived`. Rejects all other source statuses.         |

**Commands explicitly merged or omitted:**

- `updateOrderLineItem` + `updateOrderLineItems` — **merged** into `Update Line Items` with `items[]` cardinality one-to-many.
- `updateOrderItem` — **merged** into the four fulfillment-tracking commands (`Register Fulfillment`, `Cancel Fulfillment`, `Register Shipment`, `Register Delivery`). The standalone updater is a low-level mutation surface that doesn't represent a business event on its own.
- **Return / receive return / claim / exchange creation** — NOT aggregate commands of Order. They are commands of separate aggregates (Return, Claim, Exchange) that reference Order by id.
- **Order Change request / confirm / decline / register / apply** — NOT aggregate commands of Order. The Order Change aggregate has its own state machine and command surface; once an Order Change is confirmed and applied, it invokes Order aggregate commands (e.g., `Add Line Items`, `Add Credit Lines`) to effect the change.
- **Order placement / cart conversion** — NOT an aggregate command. The cross-aggregate workflow at `core-flows/.../complete-cart.ts` reads from the Cart aggregate and calls `Create Order`.
- **Soft-delete order** — Omitted: deleting a placed order is a destructive operation handled at the persistence layer, not a domain command. Order cancellation (`Cancel Order`) is the in-domain way to invalidate an order.

## 10. Domain Events

| #  | Event                   | Emitted by             |
|----|-------------------------|------------------------|
| 1  | Order Created           | Create Order           |
| 2  | Order Updated           | Update Order           |
| 3  | Order Items Added       | Add Line Items         |
| 4  | Order Items Updated     | Update Line Items      |
| 5  | Shipping Methods Added  | Add Shipping Methods   |
| 6  | Shipping Method Removed | Remove Shipping Method |
| 7  | Transactions Added      | Add Transactions       |
| 8  | Transactions Removed    | Remove Transactions    |
| 9  | Credit Lines Added      | Add Credit Lines       |
| 10 | Fulfillment Registered  | Register Fulfillment   |
| 11 | Fulfillment Canceled    | Cancel Fulfillment     |
| 12 | Shipment Registered     | Register Shipment      |
| 13 | Delivery Registered     | Register Delivery      |
| 14 | Order Completed         | Complete Order         |
| 15 | Order Canceled          | Cancel Order           |
| 16 | Order Archived          | Archive Order          |

## 11. Read Models / Queries

### Query: Get Order

Inputs: `id`, optional relation/field selectors.

Returns the full Order plus computed projection fields (none of which are stored attributes on Order itself):

| Field             | Description                                                                                              |
|-------------------|----------------------------------------------------------------------------------------------------------|
| total             | Final payable amount (subtotal + shipping + tax − discounts).                                            |
| subtotal          | Items + shipping pre-tax, after discounts.                                                               |
| itemTotal         | Sum across items of `quantity × unitPrice` (after item-level adjustments and taxes).                     |
| itemSubtotal      | Sum across items of `quantity × unitPrice` (pre-tax, after item-level adjustments).                      |
| shippingTotal     | Sum of selected shipping methods (after shipping-level adjustments and taxes).                           |
| shippingSubtotal  | Sum of selected shipping methods (pre-tax, after shipping-level adjustments).                            |
| taxTotal          | Sum of tax lines on items + shipping.                                                                    |
| discountTotal     | Sum of all adjustment amounts (negative for discounts).                                                  |
| paidTotal         | Sum of capture transactions.                                                                             |
| refundedTotal     | Sum of refund transactions (always ≤ 0).                                                                 |
| creditTotal       | Sum of credit-line amounts.                                                                              |
| balance           | `total − paidTotal − creditTotal`.                                                                       |

### Query: List Orders

Filterable by:

| Filter             | Type        | Notes                                            |
|--------------------|-------------|--------------------------------------------------|
| ids                | string[]    | By order id.                                     |
| customerId         | string[]    | Orders for given customers.                      |
| salesChannelId     | string[]    | Orders for given sales channels.                 |
| regionId           | string[]    | Orders for given regions.                        |
| status             | string[]    | Filter by lifecycle status.                      |
| currencyCode       | string[]    | Filter by currency.                              |
| createdAt          | range       | Date range filter.                               |
| canceledAt         | range       | Date range filter.                               |

Returns Order summaries (subset of Get Order projection fields).

## 12. Invariants

1. **Currency is create-only.** `currencyCode` is required on `Create Order` and may not be changed thereafter. Mismatch between `Order.currencyCode` and `Transaction.currencyCode` is rejected by `Add Transactions`.
2. **Status state machine.** Valid transitions:
   - `pending` → `completed | canceled | requires_action`
   - `requires_action` → `completed | canceled`
   - `draft` → `pending | archived`
   - `pending | requires_action` → `archived` is rejected.
   - `completed | canceled | draft` → `archived` only.
   - `canceled` → terminal (cannot complete or transition further).
   - `archived` → terminal.
3. **Cannot complete a canceled order.** `Complete Order` rejects with `NOT_ALLOWED` if status is `canceled`.
4. **Cannot cancel a completed order.** `Cancel Order` rejects with `NOT_ALLOWED` if status is `completed`.
5. **Cannot archive non-terminal orders.** `Archive Order` rejects if status is not in `{ completed, canceled, draft }`.
6. **Fulfillment quantities are monotonically constrained.**
   - `fulfilledQuantity ≤ quantity`
   - `shippedQuantity ≤ fulfilledQuantity`
   - `deliveredQuantity ≤ shippedQuantity`
   - `returnRequestedQuantity ≤ quantity`
   - `returnReceivedQuantity ≤ returnRequestedQuantity`
   Violations raise `INVALID_DATA`.
7. **Cancel Fulfillment is bounded.** `Cancel Fulfillment` cannot reduce `fulfilledQuantity` below `shippedQuantity`.
8. **Order Line Item is a snapshot.** Once created, its product/variant/price fields cannot be patched. Changing them requires removing the parent Order Item and adding a new one.
9. **Address is set-replaced.** Setting `shippingAddress` or `billingAddress` replaces the previous address wholesale; no in-place update.
10. **Order Summary is recomputed.** Any mutation to items, shipping, transactions, credit lines, taxes, or adjustments triggers a new Order Summary at the new Order version. Reads always return the latest version's summary.
11. **Optimistic concurrency.** Every mutation increments `Order.version`; child entities created during a mutation carry that version. Concurrent mutations against a stale version are rejected.
12. **Set-replacement collections.** Tax lines and adjustments (on both line items and shipping methods) are always replaced as a whole — there is no `addTaxLine` / `removeAdjustment`. Passing `[]` clears them.
13. **`customDisplayId` uniqueness.** When provided, it must be unique across all orders.
14. **External-aggregate ids are opaque.** `customerId`, `regionId`, `salesChannelId`, `productId`, `variantId`, `promotionId`, `taxRateId`, `shippingOptionId` are passed in and stored without enforcement at the aggregate boundary; validity is the caller's responsibility.

## 13. External References

| Field                                       | Points to                       |
|---------------------------------------------|---------------------------------|
| Order.customerId                            | Customer aggregate              |
| Order.regionId                              | Region aggregate                |
| Order.salesChannelId                        | Sales Channel aggregate         |
| Order.currencyCode                          | Currency (by ISO code)          |
| OrderLineItem.productId                     | Product aggregate (snapshotted) |
| OrderLineItem.variantId                     | Product Variant (snapshotted)   |
| OrderLineItem.productTypeId                 | Product Type                    |
| LineItemTaxLine.taxRateId                   | Tax Rate                        |
| LineItemAdjustment.promotionId              | Promotion aggregate             |
| ShippingMethod.shippingOptionId             | Shipping Option                 |
| ShippingMethodTaxLine.taxRateId             | Tax Rate                        |
| ShippingMethodAdjustment.promotionId        | Promotion aggregate             |
| OrderTransaction.referenceId                | External payment processor txn  |

Cross-aggregate orchestration that exists in the codebase but is **out of scope** for this aggregate:

- **Cart → Order conversion** in `core-flows/.../complete-cart.ts` and related — reads from the Cart aggregate and calls `Create Order`.
- **Payment capture / refund flows** — Payment Module is authoritative; `Add Transactions` is invoked by orchestration to record processor outcomes on the order.
- **Inventory allocation / release** — Inventory Module handles reservations; the Order aggregate only sees the resulting fulfillment progress.
- **Promotion evaluation** — Promotion Module computes adjustments and passes them in via `Add Line Items` / `Add Shipping Methods` / `Update Line Items`.
- **Returns, Claims, Exchanges** — separate aggregates in the same module that reference Order by id and ultimately drive Order mutations via the Order Change aggregate.
- **Order Change** — separate aggregate whose `Apply` action invokes Order aggregate commands.
- **Order notifications** — emitted by an event subscriber on the Order Created / Order Completed / Order Canceled events.

## 14. Tests (at the aggregate boundary)

Extracted from `packages/modules/order/integration-tests/__tests__/`. Rephrased in business language as Given/When/Then.

### Create Order
- Given no order exists, When the caller creates an order with currency code USD, a customer id, an item, and shipping/billing addresses, Then an Order is returned with an assigned id, `displayId` auto-incremented, status `pending`, version 1, and the nested items, shipping methods, and addresses persisted.
- Given the Order module is configured with a custom display id generator, When the caller creates an order, Then `customDisplayId` is generated by the configured hook.
- Given items carry `taxLines` and `adjustments`, When the caller creates an order, Then the line item snapshots persist the tax lines and adjustments as nested value objects.

### Update Order
- Given an order exists with status `pending`, When the caller updates the order's email and metadata, Then those fields are updated, `version` is incremented, and a new Order Summary at the new version is written.

### Add Line Items
- Given an order exists with status `pending`, When the caller adds a line item with quantity 2, Then a new Order Item plus its Order Line Item snapshot are persisted, and the order summary is recomputed to include the new item.

### Update Line Items
- Given an Order Item exists with quantity 5, When the caller updates its quantity to 3, Then the Order Item's quantity becomes 3 and the order summary totals are recomputed.

### Add Shipping Methods
- Given an order exists, When the caller adds a shipping method with name "UPS Ground" and amount 10, Then an Order Shipping plus a Shipping Method snapshot are persisted and the shipping totals are included in the next summary.

### Add Transactions
- Given an order exists with currency USD, When the caller adds a capture transaction of 100 USD, Then an Order Transaction is persisted and the read-model `paidTotal` increases by 100.
- Given an order exists with currency USD, When the caller adds a transaction with currency EUR, Then the command is rejected with a currency-mismatch error.

### Remove Transactions
- Given a capture transaction exists, When the caller removes it, Then it is soft-deleted and `paidTotal` recomputes without it.

### Add Credit Lines
- Given an order exists, When the caller adds a credit line of 25, Then an Order Credit Line is persisted and `creditTotal` reflects the credit.

### Register Fulfillment / Shipment / Delivery
- Given an Order Item has quantity 5 and `fulfilledQuantity` 0, When the caller registers fulfillment of 2 for that item, Then `fulfilledQuantity` becomes 2.
- Given an Order Item has `fulfilledQuantity` 2 and `shippedQuantity` 0, When the caller registers shipment of 2, Then `shippedQuantity` becomes 2.
- Given an Order Item has `shippedQuantity` 2 and `deliveredQuantity` 0, When the caller registers delivery of 2, Then `deliveredQuantity` becomes 2.
- Given an Order Item has `quantity` 5 and `fulfilledQuantity` 0, When the caller registers fulfillment of 6, Then the command is rejected as exceeding ordered quantity.

### Cancel Fulfillment
- Given an Order Item has `fulfilledQuantity` 2 and `shippedQuantity` 0, When the caller cancels fulfillment of 2, Then `fulfilledQuantity` becomes 0.
- Given an Order Item has `fulfilledQuantity` 2 and `shippedQuantity` 2, When the caller cancels fulfillment of 1, Then the command is rejected (cannot reduce below shipped).

### Complete Order
- Given an order has status `pending`, When the caller completes the order, Then the order status becomes `completed` and `Order Completed` is emitted.
- Given an order has status `canceled`, When the caller completes the order, Then the command is rejected with `NOT_ALLOWED`.

### Cancel Order
- Given an order has status `pending`, When the caller cancels the order, Then the order status becomes `canceled`, `canceledAt` is set to the current timestamp, and `Order Canceled` is emitted.
- Given an order has status `completed`, When the caller cancels the order, Then the command is rejected with `NOT_ALLOWED`.

### Archive Order
- Given an order has status `completed`, When the caller archives the order, Then the order status becomes `archived` and `Order Archived` is emitted.
- Given an order has status `pending`, When the caller archives the order, Then the command is rejected.
