# Quote (Cart) Aggregate — Standalone DDD Model

**Source:** `app/code/Magento/Quote/` (aggregate root `Magento\Quote\Model\Quote`, exposed via `Magento\Quote\Api\Data\CartInterface`).
**Service entry points:** `CartManagementInterface`, `CartRepositoryInterface`, `CartItemRepositoryInterface`, `BillingAddressManagementInterface`, `ShippingAddressManagementInterface`, `ShippingMethodManagementInterface`, `PaymentMethodManagementInterface`, `CouponManagementInterface` (all under `app/code/Magento/Quote/Api` and `.../Model`).
**Bounded context:** `Cart & Checkout`.

Magento's Quote module is a thick service layer. The `*ManagementInterface` and
`*RepositoryInterface` classes orchestrate persistence, validation, totals
collection, and — in the case of `placeOrder` — creation of a **Sales Order**, which
is a *separate aggregate in a separate module* (`Magento\Sales`). This model peels
all of that orchestration away and keeps only what the Quote aggregate itself owns
and decides: the cart root, its line items, its addresses, its payment selection,
its coupon, and the currency it is priced in. Totals are computed projections, not
stored aggregate state, and live in the read-model section. Order creation, promotion
rule evaluation, inventory reservation, and customer-record mutation are explicitly
**out of scope** (see §11).

---

## 1. Aggregate Hierarchy

```
Quote / Cart (aggregate root)
├── items[]              : Cart Item        (Related Entity — add / update / remove)
│   └── productOption    : Product Option   (Value Object — set-replaced)
├── billingAddress       : Address          (Value Object — set-replaced)
├── shippingAddress      : Address          (Value Object — set-replaced)
├── payment              : Payment          (Value Object — set-replaced)
└── currency             : Currency         (Value Object — derived from store config)
```

**Why these classifications:**

- **Cart Item is a Related Entity.** It has its own identity (`itemId`) and a full
  add / update / remove lifecycle exposed through distinct commands
  (`CartItemRepository::save` for add+update, `deleteById` for remove). Items are
  referred to and manipulated individually in the business vocabulary. → **Entity**.
- **Address is a Value Object**, despite `AddressInterface` exposing an `id` getter.
  The aggregate never patches a single address field; `setBillingAddress` /
  `setShippingAddress` (and `BillingAddressManagement::assign`) **replace the whole
  address object** wholesale. There is at most one billing and one shipping address
  on the cart. The DB id is technical. Lifecycle semantics — set-replacement, no
  independent identity in the cart vocabulary — make it a **Value Object**. *(This is
  the call most worth challenging; flag if your team treats quote addresses as
  entities with their own update commands.)*
- **Payment is a Value Object.** `PaymentInterface` has no `id` getter; `setPayment`
  replaces the entire payment selection (method + PO number + provider data) as a
  unit. → **Value Object**, set-replaced.
- **Currency is a Value Object.** Pure bag of currency codes and exchange rates,
  derived from store/system configuration when the quote is created or re-priced. No
  identity. → **Value Object**.
- **Product Option is a Value Object** nested on a Cart Item. It captures the
  buy-request configuration (custom options, configurable selections) and is replaced
  as a whole when an item is added or updated. No identity. → **Value Object**.
- **Totals / TotalsItem / TotalSegment are NOT in the hierarchy.** They are computed
  projections (subtotal, tax, shipping, grand total, discount) recalculated by
  `collectTotals()` after every mutation. They are exposed through a dedicated totals
  query, not stored as authored aggregate state. → **Read model** (see §9).

---

## 2. Aggregate Root: Quote (Cart)

A shopping cart owned by a guest or a registered customer, scoped to a single store
and priced in a single currency. It accumulates purchasable line items, the buyer's
billing and shipping addresses, a selected shipping method, a payment method, and an
optional coupon, until it is either abandoned or converted into a Sales Order
(at which point it is deactivated).

### Attributes (Quote / Cart)

| Attribute          | Type           | Req                    | Default | Notes                                                    |
|--------------------|----------------|------------------------|---------|----------------------------------------------------------|
| id                 | number         | yes (system-generated) | —       | Quote id. Create-only.                                   |
| storeId            | number         | yes                    | —       | External ref → Store/sales channel. Create-only.         |
| isActive           | boolean        | no                     | true    | Set to false when the quote is converted to an order.    |
| isVirtual          | boolean        | no                     | false   | True when the cart holds only virtual products.          |
| customerId         | number \| null | no                     | null    | External ref → Customer aggregate. Null for guest carts. |
| customerIsGuest    | boolean        | no                     | true    | True for guests, false once a customer is assigned.      |
| customerEmail      | string \| null | no                     | null    | Buyer email; required before order placement.            |
| customerNote       | string \| null | no                     | null    | Customer note / special instructions.                    |
| customerNoteNotify | boolean        | no                     | —       | Whether to notify the customer of the note.              |
| customerTaxClassId | number \| null | no                     | null    | External ref → Tax configuration.                        |
| couponCode         | string \| null | no                     | null    | Applied coupon code (a scalar, not an entity).           |
| reservedOrderId    | string \| null | no                     | null    | Order increment id reserved at placement time.           |
| origOrderId        | number \| null | no                     | null    | Source order id (for reorders).                          |
| convertedAt        | string \| null | no                     | null    | Timestamp when the quote became an order.                |
| createdAt          | string         | system                 | —       | Creation timestamp.                                      |
| updatedAt          | string         | system                 | —       | Last-update timestamp.                                   |
| items              | Cart Item[]    | no                     | []      | Owned collection of line items, see §4.                  |
| billingAddress     | Address        | no                     | null    | Owned value object, see §3.1.                            |
| shippingAddress    | Address        | no                     | null    | Owned value object, see §3.1.                            |
| payment            | Payment        | no                     | null    | Owned value object, see §3.2.                            |
| currency           | Currency       | no                     | —       | Owned value object, see §3.3.                            |

> `itemsCount`, `itemsQty`, and all monetary totals are **projections** (see §9), not
> stored aggregate state, and are intentionally omitted from this table.

---

## 3. Value Objects on the Root

### 3.1 Address (billing & shipping)

A postal + contact address attached to the cart in one of two roles — `billingAddress`
or `shippingAddress`. Replaced wholesale by its `set…` command; never patched field by
field. The same structure fills both roles.

| Attribute         | Type           | Req | Notes                                                |
|-------------------|----------------|-----|------------------------------------------------------|
| firstname         | string         | yes |                                                      |
| lastname          | string         | yes |                                                      |
| middlename        | string         | no  |                                                      |
| prefix            | string         | no  | Name prefix (Mr., Ms.).                              |
| suffix            | string         | no  | Name suffix (Jr., Sr.).                              |
| company           | string         | no  |                                                      |
| street            | string[]       | yes | One or more street lines.                            |
| city              | string         | yes |                                                      |
| region            | string         | yes | Region/state name.                                   |
| regionId          | number         | yes | Region id.                                           |
| regionCode        | string         | yes | Region code (e.g. CA).                               |
| postcode          | string         | yes | Postal / ZIP code.                                   |
| countryId         | string         | yes | Country code.                                        |
| telephone         | string         | yes |                                                      |
| fax               | string         | no  |                                                      |
| email             | string         | yes | Contact email for this address.                      |
| vatId             | string         | no  | VAT id (EU).                                         |
| sameAsBilling     | boolean        | no  | Shipping mirrors billing.                            |
| saveInAddressBook | boolean        | no  | Persist to the customer's address book on placement. |
| customerAddressId | number \| null | no  | External ref → a saved Customer address book entry.  |
| customerId        | number \| null | no  | External ref → Customer aggregate.                   |

### 3.2 Payment

The payment method selected for the cart. Replaced as a whole by `Set Payment Method`.

| Attribute      | Type     | Req | Notes                                                          |
|----------------|----------|-----|----------------------------------------------------------------|
| method         | string   | yes | Payment method code (e.g. `checkmo`, `braintree`, `paypal`).   |
| poNumber       | string   | no  | Purchase-order number.                                         |
| additionalData | string[] | no  | Provider-specific key/value data (e.g. tokenized card refs).   |

### 3.3 Currency

Currency codes and exchange rates the cart is priced in. Derived from store/system
configuration; carried on the cart as a unit.

| Attribute          | Type   | Req | Notes                                  |
|--------------------|--------|-----|----------------------------------------|
| globalCurrencyCode | string | no  | Global/primary currency code.          |
| baseCurrencyCode   | string | no  | Base store currency code.              |
| storeCurrencyCode  | string | no  | Store-level display currency code.     |
| quoteCurrencyCode  | string | no  | Quote (customer-facing) currency code. |
| storeToBaseRate    | number | no  | Exchange rate store → base.            |
| storeToQuoteRate   | number | no  | Exchange rate store → quote.           |
| baseToGlobalRate   | number | no  | Exchange rate base → global.           |
| baseToQuoteRate    | number | no  | Exchange rate base → quote.            |

---

## 4. Related Entity: Cart Item

A single line in the cart: a product (by SKU) at a chosen quantity, with optional
product configuration. Added, updated, and removed individually; identified by
`itemId` within the cart.

### Attributes (Cart Item)

| Attribute     | Type           | Req                    | Notes                                                |
|---------------|----------------|------------------------|------------------------------------------------------|
| itemId        | number         | yes (system-generated) | Line item id within the quote.                       |
| quoteId       | number         | yes                    | Parent quote id (back-reference).                    |
| sku           | string         | yes                    | External ref → Catalog Product aggregate.            |
| qty           | number         | yes                    | Quantity; must be positive.                          |
| name          | string         | no                     | Snapshotted product name at time of add.             |
| price         | number         | no                     | Snapshotted unit price at time of add.               |
| productType   | string         | no                     | Product type code (simple, configurable, bundle, …). |
| productOption | Product Option | no                     | Buy-request configuration, see §4.1.                 |

### 4.1 Value Object nested under Cart Item: Product Option

Captures the buy-request configuration for a configured product (custom options,
configurable attribute selections, bundle selections). Modeled in the public API as
an extension-attribute container; replaced wholesale when the item is added or updated.

| Attribute            | Type   | Req | Notes                                                       |
|----------------------|--------|-----|-------------------------------------------------------------|
| extensionAttributes  | object | no  | Product-type-specific option payload (custom/configurable). |

> Product Option carries no fixed concrete attributes in the core API — it is an
> extension point. Flag if you want it dropped from the model or expanded with the
> specific option types your install uses.

---

## 7. Commands (Aggregate Boundary)

The Quote aggregate exposes **12 commands**, each with a 1:1 domain event.
Payloads are aggregate-facing (they mirror the aggregate's internal structure).
`cartId` is the aggregate-root identity for every command except `Create Cart`.

| #  | Command                     | Payload (aggregate-facing)                                      | Notes                                                                                                |
|----|-----------------------------|-----------------------------------------------------------------|------------------------------------------------------------------------------------------------------|
| 1  | **Create Cart**             | `storeId`, `customerId?`                                        | Merges `createEmptyCart` + `createEmptyCartForCustomer`. Guest if no customer.                       |
| 2  | **Add Item To Cart**        | `cartId`, `items[{ sku, qty, productOption? }]`                 | `CartItemRepository::save` / `Quote::addProduct`. Merges with matching line.                         |
| 3  | **Update Cart Item**        | `cartId`, `items[{ itemId, qty, productOption? }]`              | `Quote::updateItem`. Reconfigure qty/options of an existing line.                                    |
| 4  | **Remove Cart Item**        | `cartId`, `itemId`                                              | `CartItemRepository::deleteById` / `Quote::removeItem`.                                              |
| 5  | **Set Billing Address**     | `cartId`, `billingAddress{ …full address… }`, `useForShipping?` | `BillingAddressManagement::assign`. Replaces billing wholesale.                                      |
| 6  | **Set Shipping Address**    | `cartId`, `shippingAddress{ …full address… }`                   | `ShippingAddressManagement::assign`. Replaces shipping wholesale.                                    |
| 7  | **Set Shipping Method**     | `cartId`, `carrierCode`, `methodCode`                           | `ShippingMethodManagement::set`. Non-virtual carts only.                                             |
| 8  | **Set Payment Method**      | `cartId`, `payment{ method, poNumber?, additionalData? }`       | `PaymentMethodManagement::set` / `Quote::setPayment`.                                                |
| 9  | **Apply Coupon**            | `cartId`, `couponCode`                                          | `CouponManagement::set`. Sets the scalar `couponCode`; re-prices.                                    |
| 10 | **Remove Coupon**           | `cartId`                                                        | `CouponManagement::remove`. Clears `couponCode`; re-prices.                                          |
| 11 | **Assign Customer To Cart** | `cartId`, `customerId`, `storeId`                               | `CartManagement::assignCustomer`. Guest→customer; merges existing cart.                              |
| 12 | **Place Order**             | `cartId`, `payment{ method, … }?`                               | `CartManagement::placeOrder`. Deactivates quote; **creates Sales Order (cross-aggregate, see §11)**. |

**Commands explicitly merged or omitted:**

- `createEmptyCart` + `createEmptyCartForCustomer` → **merged** into `Create Cart`
  (the customer variant is the same operation with a `customerId`).
- `assignCustomerWithAddressChange` → **merged** into `Assign Customer To Cart`
  (an internal variant of the same assignment).
- **Quote merge** (`Quote::merge`) → **not a standalone command**; it always fires
  inside `Assign Customer To Cart` when the customer already has an active cart.
- **Collect Totals** (`Quote::collectTotals`) → **not a command**; it is an automatic
  recalculation side-effect after every mutation, captured as Invariant #9.
- **Reserve Order Id** (`Quote::reserveOrderId`) → **not a command**; folded into
  `Place Order`.
- **Save / Delete cart** (`CartRepository::save` / `delete`) → infrastructure
  persistence, not business commands. (`delete` could be surfaced as a "Delete Cart"
  command if your team wants cart deletion modeled — flag it.)
- **Remove All Items** (`Quote::removeAllItems`) → omitted from the core flow; it is
  a bulk variant of `Remove Cart Item`. Flag if you want a distinct "Clear Cart".
- **Place Order's order creation** → the Sales Order is a separate aggregate; only the
  quote-side state change (deactivation) is owned here. See §11.

---

## 8. Domain Events

| #  | Event                      | Emitted by              | Lane       |
|----|----------------------------|-------------------------|------------|
| 1  | Cart Created               | Create Cart             | Customer   |
| 2  | Item Added To Cart         | Add Item To Cart        | Customer   |
| 3  | Cart Item Updated          | Update Cart Item        | Customer   |
| 4  | Cart Item Removed          | Remove Cart Item        | Customer   |
| 5  | Customer Assigned To Cart  | Assign Customer To Cart | Automation |
| 6  | Billing Address Set        | Set Billing Address     | Customer   |
| 7  | Shipping Address Set       | Set Shipping Address    | Customer   |
| 8  | Shipping Method Set        | Set Shipping Method     | Customer   |
| 9  | Coupon Applied             | Apply Coupon            | Customer   |
| 10 | Coupon Removed             | Remove Coupon           | Customer   |
| 11 | Payment Method Set         | Set Payment Method      | Customer   |
| 12 | Order Placed               | Place Order             | Customer   |

Timeline (left-to-right happy path): Cart Created → Item Added → Cart Item Updated →
Cart Item Removed → Customer Assigned → Billing Address Set → Shipping Address Set →
Shipping Method Set → Coupon Applied → Coupon Removed → Payment Method Set →
Order Placed.

---

## 9. Read Models / Queries

### Query: Get Cart

Inputs: `cartId` (or `customerId` for the active customer cart).
Returns the full Cart (root + items + addresses + payment + currency).

### Query: Get Cart Totals

Inputs: `cartId`. Returns the computed pricing projection — **none of these are stored
aggregate state**:

| Field                  | Description                                                                                  |
|------------------------|----------------------------------------------------------------------------------------------|
| grandTotal             | Final payable amount (items + shipping + tax − discounts).                                   |
| subtotal               | Items subtotal before tax/shipping.                                                          |
| subtotalWithDiscount   | Subtotal after discounts.                                                                    |
| discountAmount         | Total discount applied.                                                                      |
| shippingAmount         | Shipping cost.                                                                               |
| shippingDiscountAmount | Shipping discount.                                                                           |
| taxAmount              | Total tax.                                                                                   |
| shippingInclTax        | Shipping including tax.                                                                      |
| subtotalInclTax        | Subtotal including tax.                                                                      |
| baseGrandTotal / base* | Same figures in base store currency.                                                         |
| couponCode             | Coupon reflected in totals.                                                                  |
| itemsQty               | Total quantity across items.                                                                 |
| items[]                | Per-item totals breakdown (TotalsItem): rowTotal, taxAmount, discountAmount, priceInclTax, … |
| totalSegments[]        | Ordered display breakdown (TotalSegment): `code`, `title`, `value`, `area`.                  |

### Secondary Queries

| Query                           | Purpose                                                                               |
|---------------------------------|---------------------------------------------------------------------------------------|
| List Available Shipping Methods | Methods/rates applicable to the cart's shipping address (before Set Shipping Method). |
| List Available Payment Methods  | Payment methods available for the cart (before Set Payment Method).                   |
| List Carts                      | Admin search over carts (`CartRepository::getList`).                                  |

---

## 10. Invariants

1. **Store and currency fixed at creation** — `storeId` is required on `Create Cart`;
   currency is derived from the store and treated as create-time state.
2. **Cart Item requires `sku` and a positive `qty`** — zero/negative quantity is rejected.
3. **Address is set-replacement** — `Set Billing Address` / `Set Shipping Address`
   replace the entire address; you cannot patch a single field.
4. **`useForShipping` copies billing to shipping** — when set on `Set Billing Address`,
   the billing address is also applied as the shipping address.
5. **Empty-cart guard** — applying a coupon, setting a shipping method, or placing an
   order is rejected when the cart has no items.
6. **Shipping requires a shipping address** — `Set Shipping Method` is rejected with no
   shipping address, and rejected entirely for virtual-only carts.
7. **Virtual-only carts skip shipping** — a cart of only virtual products requires no
   shipping address or method; only a billing address is needed to place the order.
8. **Coupon validity** — the coupon code must be valid/applicable; after apply, the
   persisted coupon must equal the requested code or the operation fails.
9. **Totals recalculation** — any change to items, addresses, shipping method, or
   coupon triggers automatic totals collection (`collectTotals`).
10. **Customer assignment is guest-only and one-way** — a customer can be assigned only
    to an anonymous cart; an already-customer cart cannot be reassigned, and the
    customer/store must match. Assigning merges any existing active customer cart.
11. **Order placement preconditions** — billing address (always), shipping address +
    shipping method (non-virtual), payment method, and a valid customer email must all
    be present; minimum-order-amount and item stock are validated.
12. **Quote deactivated on placement** — after a successful `Place Order`, `isActive`
    becomes false and the cart cannot be reused; a reserved order id is assigned.

---

## 11. External References

| Field                          | Points to                                  |
|--------------------------------|--------------------------------------------|
| Quote.customerId               | Customer aggregate (separate BC)           |
| Quote.storeId                  | Store / sales channel                      |
| Quote.customerTaxClassId       | Tax configuration                          |
| Cart Item.sku                  | Catalog Product aggregate (snapshotted)    |
| Address.customerAddressId      | Customer address-book entry                |
| Address.customerId             | Customer aggregate                         |

Cross-aggregate orchestration that exists in the codebase but is **out of scope** here:

- **Place Order → Sales Order** — `CartManagement::placeOrder` validates the quote,
  reserves an order id, deactivates the quote, and **creates a `Magento\Sales` Order
  aggregate**. Only the quote-side deactivation is owned by this aggregate; the Order
  is modeled separately.
- **Promotion / discount rule evaluation** — sales rules compute discounts during
  totals collection; the rule engine is a separate concern that feeds `couponCode`
  and discount totals.
- **Inventory reservation / stock checks** — performed against the Inventory module at
  placement time.
- **Customer record + address-book mutation** — saving an address to the customer's
  address book touches the Customer aggregate.

---

## 12. Tests (at the aggregate boundary)

Extracted from `app/code/Magento/Quote/Test/Unit/Model/*`,
`dev/tests/integration/testsuite/Magento/Quote/Model/*`, and
`dev/tests/api-functional/testsuite/Magento/Quote/Api/*`. Rephrased in business language.

### Create Cart
- Given no customer is logged in, When an empty cart is created, Then a new quote is returned with a store id and is retrievable by id.
- Given a logged-in customer with no active cart, When a cart is created for the customer, Then the quote is marked non-guest and assigned to the customer.
- Given a customer who already has an active cart, When a cart is created for the customer, Then the existing active cart is returned instead of a new one.

### Add Item To Cart
- Given a cart and an available product, When an item with a quantity is added, Then the item appears in the cart with that quantity.
- Given a cart already containing a line for the same product/config, When the same product is added again, Then the quantities are merged into the existing line.

### Update Cart Item
- Given a cart containing an item, When the item quantity is updated, Then the cart reflects the new quantity.

### Remove Cart Item
- Given a cart containing one or more items, When an item is deleted, Then it no longer appears in the cart.

### Set Billing Address
- Given a cart, When a valid billing address is assigned, Then it is stored on the quote.
- Given a cart, When a billing address is assigned with use-for-shipping, Then the same address is also applied as the shipping address.

### Set Shipping Address
- Given a cart with non-virtual products, When a valid shipping address is assigned, Then it is stored and shipping rates are collected.
- Given a virtual-only cart, When a shipping address is assigned, Then the command is rejected (virtual products only).

### Set Shipping Method
- Given a cart with items and a shipping address, When a valid shipping method is set, Then it is stored and totals are recalculated.
- Given an empty cart, When a shipping method is set, Then the command is rejected (empty cart).
- Given a cart with items but no shipping address, When a shipping method is set, Then the command is rejected (shipping address missing).

### Set Payment Method
- Given a cart with a billing address (virtual) or shipping address+method (physical), When a valid payment method is set, Then it is stored on the quote.
- Given a cart, When an unavailable payment method is set, Then the command is rejected (method not available).

### Apply Coupon / Remove Coupon
- Given a cart with items and a valid coupon, When the coupon is applied, Then it is stored and totals reflect the discount.
- Given an empty cart, When a coupon is applied, Then the command is rejected (cart contains no products).
- Given a cart with items, When an invalid coupon is applied, Then the command is rejected (coupon not valid).
- Given a cart with a coupon, When the coupon is removed, Then the code is cleared and totals are recalculated.

### Assign Customer To Cart
- Given a guest cart and an existing customer, When the customer is assigned, Then the cart becomes a customer cart with the customer's id and email.
- Given a cart that already has a customer, When another customer is assigned, Then the command is rejected (cart is not anonymous).
- Given a guest cart in store A and a customer of store B, When the customer is assigned, Then the command is rejected (different store).
- Given a guest cart and a customer who already has an active cart with items, When the customer is assigned, Then the carts are merged and the old cart is deactivated.

### Place Order
- Given a cart with items, addresses, shipping method, and payment method, When the order is placed, Then an order id is returned and the quote is deactivated.
- Given a cart with no items, When an order is placed, Then the command is rejected.
- Given a non-virtual cart missing a shipping address or method, When an order is placed, Then the command is rejected (shipping information missing).
- Given a cart missing a payment method, When an order is placed, Then the command is rejected (valid payment method required).
- Given a cart subtotal below the configured minimum order amount, When an order is placed, Then the command is rejected.
