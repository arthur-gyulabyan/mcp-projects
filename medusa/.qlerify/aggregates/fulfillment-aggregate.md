# Fulfillment Aggregate — Standalone DDD Model

**Source:** `packages/modules/fulfillment/`
**Service entry point:** `FulfillmentModuleService` (`packages/modules/fulfillment/src/services/fulfillment-module-service.ts`).
**Bounded context:** `Fulfillment`

The fulfillment module holds **several** aggregates. This artifact models the **Fulfillment** aggregate — the actual *shipment* of items: its delivery lifecycle from creation through packing, shipping, and delivery (or cancellation), including returns. The configuration-side aggregates in the same module — **FulfillmentSet** (`FulfillmentSet → ServiceZone → GeoZone`), **ShippingOption** (+ rules / type), **ShippingProfile**, and the **FulfillmentProvider** registry — are **out of scope** here and are referenced only by id. Peeled away from the service layer: the order-level orchestration workflows (`createOrderFulfillmentWorkflow`, `markOrderFulfillmentAsDeliveredWorkflow`, `cancelOrderFulfillmentWorkflow`) that reserve/adjust inventory and then call into this aggregate, and the carrier/provider integration internals (register shipment, fetch labels, cancel with carrier) which run as side effects *inside* the aggregate's commands rather than as their own events.

## 1. Aggregate Hierarchy

```
Fulfillment (aggregate root)
├── items[]            : Fulfillment Item     (Related Entity — created with the fulfillment, cascade delete)
├── labels[]           : Fulfillment Label    (Related Entity — add/update/remove via Update, cascade delete)
└── delivery_address   : Fulfillment Address  (Value Object — one-to-one, cascade delete)
```

**Why these classifications:**

- **Fulfillment Item** has its own id (`fulit_`), captures `sku`/`barcode`/`quantity` and links to an order line item and an inventory item. It is created *with* the fulfillment and is never mutated individually (there is no add/update/remove-item command); it is cascade-deleted with the fulfillment. It has identity but **no independent lifecycle** — modeled as a **Related Entity** (a create-time snapshot of what's shipped). *(Debatable: because it is immutable after creation, it could equally be a Value Object — flag for review.)*
- **Fulfillment Label** has its own id (`fulla_`) and holds `tracking_number` / `tracking_url` / `label_url`. Labels are created when a shipment is made and can subsequently be individually added, updated, or removed through `Update Fulfillment`. That independent lifecycle makes it a **Related Entity**.
- **Fulfillment Address** (`delivery_address`) is one-to-one, holds postal-address fields, is set at creation, has no independent lifecycle, and is conceptually replaced as a whole. A classic address → **Value Object** (despite having a DB id `fuladdr_`).

## 2. Aggregate Root: Fulfillment

A fulfillment is the physical shipment of items from a stock location to a delivery address, fulfilling all or part of an order. It is handled by an external fulfillment provider and moves through a lifecycle recorded as timestamps: created → packed → shipped (with tracking labels) → delivered, or canceled. Returns are modeled as fulfillments too.

### Attributes (Fulfillment)

| Attribute          | Type                | Req                    | Default | Notes                                                                       |
|--------------------|---------------------|------------------------|---------|-----------------------------------------------------------------------------|
| id                 | string              | yes (system-generated) | —       | Prefix `ful_`.                                                              |
| location_id        | string              | yes                    | —       | Stock location shipped from. Ext ref → Stock Location.                      |
| provider_id        | string              | yes                    | —       | Fulfillment provider handling the shipment. Ext ref → Fulfillment Provider. |
| shipping_option_id | string \| null      | no                     | null    | Shipping option used. Ext ref → Shipping Option (separate aggregate).       |
| requires_shipping  | boolean             | no                     | true    | Whether the fulfillment needs physical shipping.                            |
| packed_at          | datetime \| null    | no                     | null    | When packed. Set via Update Fulfillment.                                    |
| shipped_at         | datetime \| null    | no                     | null    | When shipped. Set by Mark as Shipped.                                       |
| marked_shipped_by  | string \| null      | no                     | null    | User who marked it shipped. Ext ref → User.                                 |
| delivered_at       | datetime \| null    | no                     | null    | When delivered. Set by Mark as Delivered.                                   |
| canceled_at        | datetime \| null    | no                     | null    | When canceled. Set by Cancel Fulfillment.                                   |
| created_by         | string \| null      | no                     | null    | User who created it. Ext ref → User.                                        |
| data               | json \| null        | no                     | null    | Provider-specific data returned by the carrier.                             |
| metadata           | json \| null        | no                     | null    | Arbitrary custom data.                                                      |
| items              | Fulfillment Item[]  | yes                    | —       | Lines being shipped; see §3. Create-time.                                   |
| labels             | Fulfillment Label[] | no                     | []      | Tracking labels; see §4.                                                    |
| delivery_address   | Fulfillment Address | yes                    | —       | Where it ships to; see §5.                                                  |

## 3. Related Entity: Fulfillment Item

A single line in the shipment — what is being fulfilled and how much. Captured as a snapshot at creation and linked back to the order line item and the inventory item it draws from.

### Attributes (Fulfillment Item)

| Attribute         | Type           | Req                    | Default | Notes                              |
|-------------------|----------------|------------------------|---------|------------------------------------|
| id                | string         | yes (system-generated) | —       | Prefix `fulit_`.                   |
| title             | string         | yes                    | —       | Item title at time of fulfillment. |
| sku               | string         | yes                    | —       | Stock-keeping unit.                |
| barcode           | string         | yes                    | —       | Item barcode.                      |
| quantity          | number         | yes                    | —       | Quantity being fulfilled.          |
| line_item_id      | string \| null | no                     | null    | Ext ref → Order line item.         |
| inventory_item_id | string \| null | no                     | null    | Ext ref → Inventory Item.          |

## 4. Related Entity: Fulfillment Label

A carrier tracking label produced when a shipment is created. A fulfillment may carry several (e.g. multi-parcel).

### Attributes (Fulfillment Label)

| Attribute       | Type   | Req                    | Default | Notes                       |
|-----------------|--------|------------------------|---------|-----------------------------|
| id              | string | yes (system-generated) | —       | Prefix `fulla_`.            |
| tracking_number | string | yes                    | —       | Carrier tracking number.    |
| tracking_url    | string | yes                    | —       | URL to track the parcel.    |
| label_url       | string | yes                    | —       | URL of the printable label. |

## 5. Value Object: Fulfillment Address

The destination postal address for the shipment. Set at creation and replaced as a whole; no independent lifecycle.

### Attributes (Fulfillment Address)

| Attribute    | Type           | Req | Default | Notes                              |
|--------------|----------------|-----|---------|------------------------------------|
| company      | string \| null | no  | null    | Company name.                      |
| first_name   | string \| null | no  | null    | Recipient first name.              |
| last_name    | string \| null | no  | null    | Recipient last name.               |
| address_1    | string \| null | no  | null    | Address line 1.                    |
| address_2    | string \| null | no  | null    | Address line 2.                    |
| city         | string \| null | no  | null    | City.                              |
| country_code | string \| null | no  | null    | ISO-2 country code.                |
| province     | string \| null | no  | null    | ISO-3166-2 province.               |
| postal_code  | string \| null | no  | null    | Postal/ZIP code.                   |
| phone        | string \| null | no  | null    | Contact phone.                     |
| metadata     | json \| null   | no  | null    | Arbitrary custom data. No id (VO). |

## 7. Commands (Aggregate Boundary)

The Fulfillment aggregate exposes **7 commands**, each with a 1:1 domain event. All are driven by a fulfillment operator (Warehouse Worker lane); the order-level workflows that may invoke them, and the carrier provider calls each command triggers, are orchestration/side-effects and are not modeled as separate events.

| # | Command                       | Actor            | Payload (aggregate-facing)                                                                                                                 | Notes                                                                                                                                        |
|---|-------------------------------|------------------|--------------------------------------------------------------------------------------------------------------------------------------------|----------------------------------------------------------------------------------------------------------------------------------------------|
| 1 | Create Fulfillment            | Warehouse Worker | location_id, provider_id, shipping_option_id?, requires_shipping?, items[{…}], delivery_address{…}, labels?, data?, created_by?, metadata? | Creates fulfillment + items + delivery address; registers with the provider and stores returned data/labels. Rolls back on provider failure. |
| 2 | Create Return Fulfillment     | Warehouse Worker | location_id, provider_id, shipping_option_id?, items[{…}], delivery_address{…}, data?, metadata?                                           | Same shape, but registers a *return* with the provider (`createReturn`).                                                                     |
| 3 | Mark Fulfillment as Shipped   | Warehouse Worker | id, labels?[{…}]                                                                                                                           | Sets `shipped_at` (and `marked_shipped_by`); attaches tracking labels. (Create Shipment.)                                                    |
| 4 | Mark Fulfillment as Delivered | Warehouse Worker | id                                                                                                                                         | Sets `delivered_at`.                                                                                                                         |
| 5 | Update Fulfillment            | Warehouse Worker | id, packed_at?, data?, metadata?, labels?[{…}]                                                                                             | General edit; also how `packed_at` is recorded and labels are added/updated/removed.                                                         |
| 6 | Cancel Fulfillment            | Warehouse Worker | id                                                                                                                                         | Sets `canceled_at`; cancels with the provider. Idempotent.                                                                                   |
| 7 | Delete Fulfillment            | Warehouse Worker | id                                                                                                                                         | Hard-deletes; only allowed once canceled.                                                                                                    |

**Commands explicitly merged or omitted:**

- **Mark as Shipped / Mark as Delivered / record Packed** all reduce to `updateFulfillment` setting a timestamp at the module level. I model **Shipped** and **Delivered** as their own commands because they are distinct business state transitions with dedicated workflows, API routes, and validation guards. **Packed** has no dedicated workflow, so it stays folded into Update Fulfillment.
- **Per-item add/update/remove** — not exposed; items are set once at creation. No separate item commands.
- **Label add/update/remove** — not separate commands; handled through Update Fulfillment (and seeded by Mark as Shipped).
- **Provider/carrier integration** (`createFulfillment`, `createReturn`, `cancelFulfillment` on the provider) — side effects inside the commands above, not aggregate commands.
- **Order-level fulfillment orchestration** and **inventory reservation/adjustment** — live in cross-aggregate workflows; out of scope.

## 8. Domain Events

Spaced Title Case is what Qlerify renders; the compact form is the `$ref` key (e.g. `#/domainEvents/FulfillmentCreated`).

| # | Event                      | Emitted by                    | Lane             |
|---|----------------------------|-------------------------------|------------------|
| 1 | Fulfillment Created        | Create Fulfillment            | Warehouse Worker |
| 2 | Return Fulfillment Created | Create Return Fulfillment     | Warehouse Worker |
| 3 | Fulfillment Shipped        | Mark Fulfillment as Shipped   | Warehouse Worker |
| 4 | Fulfillment Delivered      | Mark Fulfillment as Delivered | Warehouse Worker |
| 5 | Fulfillment Updated        | Update Fulfillment            | Warehouse Worker |
| 6 | Fulfillment Canceled       | Cancel Fulfillment            | Warehouse Worker |
| 7 | Fulfillment Deleted        | Delete Fulfillment            | Warehouse Worker |

**Suggested chronology for the diagram:** Fulfillment Created → Fulfillment Updated (e.g. packed) → Fulfillment Shipped → Fulfillment Delivered, with Fulfillment Canceled → Fulfillment Deleted as the alternate/terminal branch and Return Fulfillment Created as a parallel entry point. (These are lifecycle stages of one shipment, not a strict single path.)

## 9. Read Models / Queries

### Query: Get Fulfillment

Inputs: `fulfillmentId`, optional relation/field selectors.

Returns the full fulfillment with `items`, `labels`, `delivery_address`, and the referenced `shipping_option` / `provider`.

### Secondary Queries

| Query                   | Purpose                                                                               |
|-------------------------|---------------------------------------------------------------------------------------|
| List Fulfillments       | Operational listing, filterable by `location_id` and other fields.                    |
| Get Fulfillment Options | Lists the fulfillment options a given provider supports (provider-backed, read-only). |

## 10. Invariants

1. **Create requires** `location_id`, `provider_id`, `items`, and `delivery_address`.
2. **Provider registration is part of creation** — if the provider call fails, the fulfillment is rolled back (deleted) and the error is surfaced.
3. **Cannot cancel a shipped fulfillment** — raises `INVALID_DATA` ("already shipped").
4. **Cannot cancel a delivered fulfillment** — raises `INVALID_DATA` ("already delivered").
5. **Cancel is idempotent** — re-canceling an already-canceled fulfillment is a no-op.
6. **Cannot deliver a canceled fulfillment** — raises `NOT_ALLOWED`.
7. **Cannot deliver an already-delivered fulfillment** — raises `NOT_ALLOWED`.
8. **Cannot delete unless canceled first** — deleting a non-canceled fulfillment is rejected.
9. **Shipping records provenance** — Mark as Shipped sets `shipped_at` and `marked_shipped_by`.
10. **Items are an immutable snapshot** — `title` / `sku` / `barcode` / `quantity` are captured at creation and not edited afterward.
11. **`requires_shipping` defaults to true.**

## 11. External References

| Field                              | Points to                                        |
|------------------------------------|--------------------------------------------------|
| Fulfillment.location_id            | Stock Location aggregate (stock-location module) |
| Fulfillment.provider_id            | Fulfillment Provider registry (same module)      |
| Fulfillment.shipping_option_id     | Shipping Option aggregate (same module)          |
| Fulfillment.created_by             | User aggregate (user module)                     |
| Fulfillment.marked_shipped_by      | User aggregate (user module)                     |
| Fulfillment Item.line_item_id      | Order line item (Order aggregate)                |
| Fulfillment Item.inventory_item_id | Inventory Item (Inventory aggregate)             |

**Out-of-scope orchestration that exists in the codebase:**

- **Order fulfillment workflows** (`core-flows/.../order/.../create-order-fulfillment`, `mark-order-fulfillment-as-delivered`, `cancel-order-fulfillment`) orchestrate at the order level — reserve/adjust inventory, update order state — and then call into this aggregate.
- **Inventory reservation/adjustment** on fulfillment creation/cancellation.
- **Shipping configuration** — FulfillmentSet, ServiceZone, GeoZone, ShippingOption (+ rules/type), ShippingProfile — separate aggregates in this module.
- **Carrier/provider integration internals** — registering the shipment, fetching labels, and canceling with the carrier.

## 12. Tests (at the aggregate boundary)

Extracted from `packages/modules/fulfillment/integration-tests/__tests__/fulfillment-module-service/fulfillment.spec.ts` (plus the shipped/delivered transitions in core-flows). Rephrased in business language.

### Create Fulfillment
- Given valid data, When the worker creates a fulfillment, Then a fulfillment is returned with its items and delivery address and an assigned id.

### Create Return Fulfillment
- Given valid data, When the worker creates a return fulfillment, Then a return fulfillment is returned (registered with the provider as a return).

### Update Fulfillment
- Given an existing fulfillment, When the worker updates it (including its labels), Then the changes are persisted.

### Mark Fulfillment as Shipped
- Given a fulfillment that has not shipped, When the worker creates a shipment with tracking labels, Then `shipped_at` is set and the labels are attached.

### Mark Fulfillment as Delivered
- Given a fulfillment that is neither canceled nor delivered, When the worker marks it delivered, Then `delivered_at` is set.
- Given a canceled fulfillment, When marking it delivered, Then the command is rejected with `NOT_ALLOWED`.
- Given an already-delivered fulfillment, When marking it delivered, Then the command is rejected with `NOT_ALLOWED`.

### Cancel Fulfillment
- Given an unshipped fulfillment, When the worker cancels it, Then `canceled_at` is set.
- Given a shipped fulfillment, When canceling, Then the command is rejected ("already shipped").
- Given a delivered fulfillment, When canceling, Then the command is rejected ("already delivered").

### Delete Fulfillment
- Given a canceled fulfillment, When the worker deletes it, Then it is removed.
- Given an uncanceled fulfillment, When deleting, Then the command is rejected (must be canceled first).
