# Inventory Aggregate — Standalone DDD Model

**Source:** `packages/modules/inventory/` (Medusa monorepo).
**Service entry point:** `InventoryModuleService` (`packages/modules/inventory/src/services/inventory-module.ts`).
**Bounded context:** `Inventory Management`.

This artifact covers the entire Inventory aggregate as a single consistency boundary. The aggregate root is the **Inventory Item** (a stock-trackable SKU); its location-level stock counts are owned by **Inventory Level** records, one per (item, location), and each level's `reservedQuantity` is the live sum of active **Reservation Item** records for that same (item, location). The cascade-delete semantics of the code (deleting an Inventory Item removes all its levels and reservations) define this boundary. Cross-aggregate workflows — checkout reservation, fulfillment release, replenishment receipts, cross-location transfers — live in `packages/core/core-flows/` and call into this aggregate; they are out of scope. The **Stock Location** aggregate (where stock physically resides) is external; this aggregate stores location ids opaquely.

## 1. Aggregate Hierarchy

```
Inventory Item (aggregate root)
├── levels[]       : Inventory Level    (Related Entity — add / update / remove; one per location)
└── reservations[] : Reservation Item   (Related Entity — add / update / remove / restore)
                                          A reservation's (inventoryItemId, locationId) pair maps to
                                          the Inventory Level whose reservedQuantity it contributes to.
```

**Why these classifications:**

- **Inventory Item** is the aggregate root. SKU, dimensions, customs codes, and `requiresShipping` are catalog-level facts that describe the trackable thing. All levels and reservations belong to one Inventory Item.
- **Inventory Level** is a Related Entity (not a separate aggregate). Each level has its own identity (`id`), its own create / update / remove commands, and a unique `(inventoryItemId, locationId)` slot — but it cannot exist without its parent item: deleting the item cascade-deletes the level. Its `stockedQuantity` is the mutable state of "how much is here"; its `reservedQuantity` is derived from active reservations and is *not* directly writable.
- **Reservation Item** is a Related Entity. Each reservation has its own identity and lifecycle (add / update / remove / restore), can be soft-deleted independently of its parent, and references a level implicitly through `(inventoryItemId, locationId)`. It is *not* a Value Object — reservations are mutated in place (you can change a reservation's quantity or move it to another location) and they carry their own `lineItemId` linking them back to an order or cart line.
- **No Value Objects.** Dimensions (`weight`, `length`, `height`, `width`) sit as primitives on the Item — they are not modeled as a single dimensions VO because the module treats them as independent fields. Quantities (`stockedQuantity`, `reservedQuantity`, `incomingQuantity`) are stored as decimal numbers with raw-precision sidecar columns; they are primitives, not VOs.
- **Stock Location is external.** A `locationId` is an opaque reference to the Stock Location aggregate; this aggregate does not embed any location attributes.

## 2. Aggregate Root: Inventory Item

A stock-trackable thing — typically corresponding to a product variant, but generic enough to track any unit of inventory with a SKU, dimensions, and customs codes. The item holds catalog-level facts; the per-location stock counts and pending reservations are owned through its children.

### Attributes (Inventory Item)

| Attribute        | Type               | Req | Default | Notes                                                                   |
|------------------|--------------------|-----|---------|-------------------------------------------------------------------------|
| id               | string             | yes | gen     | Prefix `iitem_`. Create-only.                                           |
| sku              | string \| null     | no  | null    | Stock Keeping Unit. Unique among non-deleted items.                     |
| title            | string \| null     | no  | null    | Item title for display.                                                 |
| description      | string \| null     | no  | null    | Item description.                                                       |
| thumbnail        | string \| null     | no  | null    | Image URL.                                                              |
| originCountry    | string \| null     | no  | null    | Country of origin (used for customs and shipping rules).                |
| hsCode           | string \| null     | no  | null    | Harmonized System tariff code.                                          |
| midCode          | string \| null     | no  | null    | Manufacturer Identification (MID) code.                                 |
| material         | string \| null     | no  | null    | Material composition.                                                   |
| weight           | number \| null     | no  | null    | Physical weight (caller-defined unit).                                  |
| length           | number \| null     | no  | null    | Physical length.                                                        |
| height           | number \| null     | no  | null    | Physical height.                                                        |
| width            | number \| null     | no  | null    | Physical width.                                                         |
| requiresShipping | boolean            | yes | true    | When true, fulfillment requires shipping (vs. digital / service items). |
| metadata         | object \| null     | no  | null    | Merchant extension fields.                                              |
| levels           | Inventory Level[]  | no  | []      | Owned collection (§3).                                                  |
| reservations     | Reservation Item[] | no  | []      | Owned collection (§4).                                                  |

> `stockedQuantity` and `reservedQuantity` are **not stored on the Item**. They are projections computed by summing across `levels` — see the read-model section (§7). Including them in the attribute table would invite direct writes the persistence layer doesn't accept.

## 3. Related Entity: Inventory Level

The stock state for one Inventory Item at one location. Owns `stockedQuantity` (the physical count) and `incomingQuantity` (in-transit / on-order count). Its `reservedQuantity` is a derived total maintained by the aggregate when reservations are created, updated, removed, or restored; it cannot be written directly.

### Attributes (Inventory Level)

| Attribute        | Type           | Req | Default | Notes                                                                                                                           |
|------------------|----------------|-----|---------|---------------------------------------------------------------------------------------------------------------------------------|
| id               | string         | yes | gen     | Prefix `ilev_`. Create-only.                                                                                                    |
| locationId       | string         | yes | —       | Opaque reference to a Stock Location. Unique together with `inventoryItemId` among non-deleted levels.                          |
| stockedQuantity  | number         | yes | 0       | Physical stock on hand at this location.                                                                                        |
| reservedQuantity | number         | yes | 0       | Total quantity currently held by active reservations at this location. **Maintained by the aggregate — not directly writable.** |
| incomingQuantity | number         | yes | 0       | Stock in transit or on order for this location.                                                                                 |
| metadata         | object \| null | no  | null    | Extension fields.                                                                                                               |

## 4. Related Entity: Reservation Item

A held-out quantity of stock at a specific location, typically attached to an order or cart line item. Creating a reservation deducts from the level's `availableQuantity` (computed as `stockedQuantity − reservedQuantity`); removing or restoring a reservation re-flows that quantity.

### Attributes (Reservation Item)

| Attribute      | Type           | Req | Default | Notes                                                                                                           |
|----------------|----------------|-----|---------|-----------------------------------------------------------------------------------------------------------------|
| id             | string         | yes | gen     | Prefix `resitem_`. Create-only.                                                                                 |
| locationId     | string         | yes | —       | Opaque Stock Location reference. Together with the parent `inventoryItemId` this resolves to one level.         |
| quantity       | number         | yes | —       | Held quantity. Subject to the availability invariant unless `allowBackorder` is true.                           |
| lineItemId     | string \| null | no  | null    | External reference → Cart Line Item / Order Line Item. Drives bulk-remove and restore-by-line-item flows.       |
| allowBackorder | boolean        | yes | false   | When true, bypass the availability check; the reservation can drive `reservedQuantity` above `stockedQuantity`. |
| description    | string \| null | no  | null    | Free-text note.                                                                                                 |
| createdBy      | string \| null | no  | null    | Opaque audit identifier of the actor that created the reservation.                                              |
| externalId     | string \| null | no  | null    | Identifier from an external system (e.g., a fulfillment provider).                                              |
| metadata       | object \| null | no  | null    | Extension fields.                                                                                               |

## 5. Commands (Aggregate Boundary)

The Inventory aggregate exposes **10 commands**. Each has a 1:1 domain event. Cross-aggregate orchestration (checkout reservation, fulfillment release, replenishment, transfer) lives outside and invokes these commands.

| #  | Command                   | Payload (aggregate-facing)                                                                                                                                                                                                                                         | Notes                                                                                                                                                                      |
|----|---------------------------|--------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|----------------------------------------------------------------------------------------------------------------------------------------------------------------------------|
| 1  | **Create Inventory Item** | `sku?`, `title?`, `description?`, `thumbnail?`, `originCountry?`, `hsCode?`, `midCode?`, `material?`, `weight?`, `length?`, `height?`, `width?`, `requiresShipping?`, `metadata?`, `levels?[]` of `{ locationId, stockedQuantity?, incomingQuantity?, metadata? }` | Atomic. May seed levels. Rejected if `sku` collides with an existing non-deleted item.                                                                                     |
| 2  | **Update Inventory Item** | `id`, `sku?`, `title?`, `description?`, `thumbnail?`, `originCountry?`, `hsCode?`, `midCode?`, `material?`, `weight?`, `length?`, `height?`, `width?`, `requiresShipping?`, `metadata?`                                                                            | Catalog-level update. Levels and reservations are not edited here.                                                                                                         |
| 3  | **Delete Inventory Item** | `id`                                                                                                                                                                                                                                                               | Soft-deletes the item. Cascade-deletes all owned levels and reservations.                                                                                                  |
| 4  | **Add Levels**            | `id`, `levels[]` of `{ locationId, stockedQuantity?, incomingQuantity?, metadata? }`                                                                                                                                                                               | Adds new owned levels. Rejected if a non-deleted level already exists for `(id, locationId)`.                                                                              |
| 5  | **Update Levels**         | `id`, `levels[]` of `{ id, stockedQuantity?, incomingQuantity?, metadata?, stockedQuantityAdjustment?, incomingQuantityAdjustment? }`                                                                                                                              | Mutates `stockedQuantity` / `incomingQuantity`. Accepts either absolute values or `*Adjustment` deltas. `reservedQuantity` is rejected.                                    |
| 6  | **Remove Levels**         | `id`, `levels[]` of `{ id }`                                                                                                                                                                                                                                       | Soft-deletes the selected levels. Does not auto-remove reservations at those levels.                                                                                       |
| 7  | **Create Reservations**   | `id`, `reservations[]` of `{ locationId, quantity, lineItemId?, allowBackorder?, description?, createdBy?, externalId?, metadata? }`                                                                                                                               | Validates `availableQuantity ≥ quantity` at the target level unless `allowBackorder=true`. Increments the level's `reservedQuantity` in a lock keyed on `inventoryItemId`. |
| 8  | **Update Reservations**   | `id`, `reservations[]` of `{ id, locationId?, quantity?, allowBackorder?, description?, externalId?, metadata? }`                                                                                                                                                  | Re-runs the availability check. Adjusts `reservedQuantity` on both the old and new levels when `locationId` changes. Locked on `inventoryItemId`.                          |
| 9  | **Remove Reservations**   | `reservations[]` of `{ id }`  *(also accepts bulk selectors: `lineItemIds[]` or `locationIds[]`)*                                                                                                                                                                  | Soft-deletes the selected reservations and decrements the affected levels' `reservedQuantity` in a locked transaction.                                                     |
| 10 | **Restore Reservations**  | `reservations[]` of `{ id }`  *(also accepts bulk selector: `lineItemIds[]`)*                                                                                                                                                                                      | Clears `deletedAt` on the selected reservations and re-increments the affected levels' `reservedQuantity` in a locked transaction.                                         |

**Commands explicitly merged or omitted:**

- `adjustInventory` (`(inventoryItemId, locationId, delta)`) — **merged** into `Update Levels`. The delta form is exposed as `stockedQuantityAdjustment` on a level entry; the same domain event (`Inventory Level Updated`) fires for both absolute set and delta adjust.
- `deleteInventoryItemLevelByLocationId` (bulk-by-location level removal) — **merged** into `Remove Levels`. From a domain-command perspective, removing one level per call and removing many in one call are the same event with different selectors.
- `deleteReservationItems` / `softDeleteReservationItems` — **merged** into `Remove Reservations`. The hard-delete vs. soft-delete distinction is a persistence concern; the domain event is the same.
- `deleteReservationItemsByLineItem`, `deleteReservationItemByLocationId` — **merged** into `Remove Reservations` as alternative selectors (`lineItemIds[]`, `locationIds[]`). They resolve to the same business event.
- `restoreReservationItemsByLineItem` — **merged** into `Restore Reservations` as a `lineItemIds[]` selector.
- `confirmInventory(itemId, locationIds[], quantity)` — NOT a command. It is a query that returns a boolean (see §7 read models).
- **Soft-delete inventory item** — `softDeleteInventoryItems` is the persistence verb for `Delete Inventory Item`; one domain command.
- **Auto-clean reservations on level removal** — NOT modeled as a command. The aggregate does not currently cascade-clean reservations when a single level is removed; orphaned reservations are the caller's responsibility. (This is a notable gap worth flagging to the user.)

## 6. Domain Events

| #  | Event                       | Emitted by                |
|----|-----------------------------|---------------------------|
| 1  | Inventory Item Created      | Create Inventory Item     |
| 2  | Inventory Item Updated      | Update Inventory Item     |
| 3  | Inventory Item Deleted      | Delete Inventory Item     |
| 4  | Inventory Levels Added      | Add Levels                |
| 5  | Inventory Levels Updated    | Update Levels             |
| 6  | Inventory Levels Removed    | Remove Levels             |
| 7  | Reservations Created        | Create Reservations       |
| 8  | Reservations Updated        | Update Reservations       |
| 9  | Reservations Removed        | Remove Reservations       |
| 10 | Reservations Restored       | Restore Reservations      |

> `Create Reservations`, `Update Reservations`, `Remove Reservations`, and `Restore Reservations` each implicitly cause an `Inventory Levels Updated` side effect because they re-derive the affected levels' `reservedQuantity`. The aggregate emits the secondary event(s); subscribers can react to either. Modeled here as the primary event only — the level update is the inner mechanism, not a separate business event.

## 7. Read Models / Queries

### Query: Get Inventory Item

Inputs: `id`, optional relation/field selectors.

Returns the Inventory Item plus optional expansions:

| Field            | Description                                                                                                  |
|------------------|--------------------------------------------------------------------------------------------------------------|
| id               | Inventory Item id.                                                                                           |
| sku              | SKU.                                                                                                         |
| title            | Item title.                                                                                                  |
| description      | Item description.                                                                                            |
| thumbnail        | Image URL.                                                                                                   |
| originCountry    | Origin country.                                                                                              |
| hsCode           | HS tariff code.                                                                                              |
| midCode          | Manufacturer Identification code.                                                                            |
| material         | Material composition.                                                                                        |
| weight           | Physical weight.                                                                                             |
| length           | Physical length.                                                                                             |
| height           | Physical height.                                                                                             |
| width            | Physical width.                                                                                              |
| requiresShipping | Whether the item requires shipping.                                                                          |
| metadata         | Extension fields.                                                                                            |
| stockedQuantity  | **Computed.** `SUM(levels.stockedQuantity)` across all live levels for this item.                            |
| reservedQuantity | **Computed.** `SUM(levels.reservedQuantity)` across all live levels for this item.                           |
| levels           | (Optional expansion) Array of Inventory Level projections (see Get Inventory Level fields).                  |
| reservations     | (Optional expansion) Array of Reservation Item projections (see Get Reservation Item fields).                |

### Query: List Inventory Items

Filterable by:

| Filter            | Type     | Notes                                                                                  |
|-------------------|----------|----------------------------------------------------------------------------------------|
| ids               | string[] | By item id.                                                                            |
| sku               | string   | Exact or list match.                                                                   |
| locationId        | string   | Items stocked at the given location (joins through levels).                            |
| originCountry     | string   | Exact match.                                                                           |
| hsCode            | string   | Exact match.                                                                           |
| requiresShipping  | boolean  | Filter on shipping-required flag.                                                      |
| q                 | string   | Free-text search across `sku`, `title`, `description`.                                 |

### Query: Get Inventory Level

Inputs: `id`, or `(inventoryItemId, locationId)`.

| Field             | Description                                                                                                                                                     |
|-------------------|-----------------------------------------------------------------------------------------------------------------------------------------------------------------|
| id                | Level id.                                                                                                                                                       |
| inventoryItemId   | Parent Inventory Item id.                                                                                                                                       |
| locationId        | Stock Location id.                                                                                                                                              |
| stockedQuantity   | Stored physical count.                                                                                                                                          |
| reservedQuantity  | Stored derived reservation total.                                                                                                                               |
| incomingQuantity  | Stored in-transit count.                                                                                                                                        |
| availableQuantity | **Computed.** `stockedQuantity − reservedQuantity`. Always ≥ 0 under the availability invariant; may go negative when `allowBackorder=true` reservations exist. |
| metadata          | Extension fields.                                                                                                                                               |

### Query: List Inventory Levels

Filterable by:

| Filter             | Type     | Notes                                            |
|--------------------|----------|--------------------------------------------------|
| ids                | string[] | By level id.                                     |
| inventoryItemId    | string[] | Levels for the given items.                      |
| locationId         | string[] | Levels at the given locations.                   |
| stockedQuantity    | range    | Numeric range / operator filter.                 |
| reservedQuantity   | range    | Numeric range / operator filter.                 |
| incomingQuantity   | range    | Numeric range / operator filter.                 |

### Query: Get Reservation Item

Inputs: `id`.

| Field            | Description                                                  |
|------------------|--------------------------------------------------------------|
| id               | Reservation id.                                              |
| inventoryItemId  | Parent Inventory Item id.                                    |
| locationId       | Stock Location id.                                           |
| quantity         | Held quantity.                                               |
| lineItemId       | External line-item reference.                                |
| allowBackorder   | Backorder flag.                                              |
| description      | Free-text note.                                              |
| createdBy        | Audit identifier.                                            |
| externalId       | External system identifier.                                  |
| metadata         | Extension fields.                                            |

### Query: List Reservation Items

Filterable by:

| Filter            | Type     | Notes                                                |
|-------------------|----------|------------------------------------------------------|
| ids               | string[] | By reservation id.                                   |
| inventoryItemId   | string[] | Reservations for the given items.                    |
| locationId        | string[] | Reservations at the given locations.                 |
| lineItemId        | string[] | Reservations bound to the given line items.          |
| createdBy         | string[] | Reservations created by the given actors.            |
| quantity          | range    | Numeric range / operator filter.                     |
| description       | string   | Substring search.                                    |

### Query: Get Available Quantity

Inputs: `inventoryItemId`, `locationIds[]`.
Returns a scalar: `SUM(stockedQuantity − reservedQuantity)` across the listed levels for the item.

### Query: Get Stocked Quantity

Inputs: `inventoryItemId`, `locationIds[]`.
Returns a scalar: `SUM(stockedQuantity)` across the listed levels.

### Query: Get Reserved Quantity

Inputs: `inventoryItemId`, `locationIds[]`.
Returns a scalar: `SUM(reservedQuantity)` across the listed levels.

### Query: Confirm Inventory

Inputs: `inventoryItemId`, `locationIds[]`, `quantity`.
Returns boolean: true if `Get Available Quantity(inventoryItemId, locationIds) ≥ quantity`. Used as a pre-checkout pre-flight check.

## 8. Invariants

1. **SKU uniqueness among non-deleted Inventory Items.** A `sku` value may exist on at most one live item at a time. Soft-deleted items do not participate in the constraint.
2. **`(inventoryItemId, locationId)` uniqueness among non-deleted Inventory Levels.** A given item may have at most one live level per location.
3. **`reservedQuantity` is derived, not directly writable.** The aggregate strips any caller-supplied `reservedQuantity` from `Add Levels` and `Update Levels` payloads. The value is changed only as a side effect of reservation create / update / remove / restore.
4. **`Inventory Level.reservedQuantity = SUM(active Reservation Item.quantity)` at the same `(inventoryItemId, locationId)`.** Maintained transactionally on every reservation mutation. "Active" means `deletedAt IS NULL`.
5. **Availability invariant on reservation creation and update.** `Create Reservations` and `Update Reservations` reject any operation that would result in `quantity > availableQuantity` at the target level — unless the reservation entry sets `allowBackorder=true`, which explicitly opts out of the check.
6. **Backorders may drive `availableQuantity` negative.** When `allowBackorder=true`, `reservedQuantity` may exceed `stockedQuantity`. Read-model `availableQuantity` may therefore go below zero; callers must handle this.
7. **Pessimistic locking on reservation mutations.** `Create Reservations`, `Update Reservations`, `Remove Reservations`, and `Restore Reservations` all wrap their level-quantity adjustment inside a lock keyed on the affected `inventoryItemId(s)`. This prevents lost decrements when concurrent reservation flows mutate the same item. (Fixed for delete/update/restore paths in commit `d36790f6cc`; the create path already locked.)
8. **Cascade delete from Item to Levels and Reservations.** `Delete Inventory Item` cascade-deletes all owned levels and reservations. The cascade is enforced by the persistence layer's `ON DELETE` rules.
9. **No cascade from Level removal to Reservations.** `Remove Levels` does **not** automatically remove reservations at the affected location. Orphaned reservations may result and are the caller's responsibility to clean up — this is a known limitation surfaced as a follow-up question rather than a defended design.
10. **`locationId` is opaque to this aggregate.** No foreign-key constraint is enforced against the Stock Location aggregate; the caller is responsible for ensuring the location exists. The aggregate validates the `(inventoryItemId, locationId)` pair against existing levels when creating reservations.
11. **`Reservation Item.allowBackorder` is per-reservation.** Toggling `allowBackorder` on `Update Reservations` re-runs the availability check on the new combined state; setting it `false` while the resulting `availableQuantity` would be negative is rejected.
12. **Decimal-precision quantities.** `stockedQuantity`, `reservedQuantity`, `incomingQuantity`, and reservation `quantity` are stored as decimals with raw-precision sidecar columns; the aggregate is precise for non-integer units (e.g., bulk goods).
13. **Soft-delete semantics for all three entities.** `Delete Inventory Item`, `Remove Levels`, and `Remove Reservations` set `deletedAt`. Read queries exclude soft-deleted records by default.
14. **Restore semantics for reservations only.** `Restore Reservations` un-deletes soft-deleted reservations and re-increments the affected levels' `reservedQuantity`. There is no `Restore Levels` or `Restore Item` domain command.

## 9. External References

| Field                       | Points to                                                                                                                                                         |
|-----------------------------|-------------------------------------------------------------------------------------------------------------------------------------------------------------------|
| Inventory Level.locationId  | Stock Location aggregate                                                                                                                                          |
| Reservation Item.locationId | Stock Location aggregate                                                                                                                                          |
| Reservation Item.lineItemId | Order Line Item or Cart Line Item (cross-aggregate)                                                                                                               |
| Reservation Item.createdBy  | User aggregate / opaque audit identifier                                                                                                                          |
| Reservation Item.externalId | Identifier in an external system (e.g., fulfillment provider)                                                                                                     |
| Inventory Item (id)         | Referenced **inbound** by Product Variant (via module link) — the inventory module itself does not store `variantId`; the Product Module links to inventory items |

Cross-aggregate orchestration that exists in the codebase but is **out of scope** for this aggregate:

- **Checkout reservation flow.** Cart / order workflows call `Create Reservations` to hold stock for a cart line, then later `Update Reservations` or `Remove Reservations` to commit or release.
- **Fulfillment release.** When an order is fulfilled or canceled, fulfillment workflows call `Remove Reservations` (typically `byLineItemIds`) to release the hold.
- **Replenishment.** Receiving stock from a supplier calls `Update Levels` to increase `stockedQuantity` (or `Add Levels` for a new location).
- **Transfer between locations.** A cross-location transfer is currently a sequence of `Update Levels` calls coordinated by an external workflow; this aggregate does not have a single "Transfer Inventory" command.
- **Variant linkage.** The Product Module owns the Variant↔InventoryItem link record; reads through the query graph expose `inventoryItem.variantId`, but the link is stored externally.
- **Inventory snapshots and reporting.** Aggregated reporting (totals by region, by warehouse) is built on the read models in §7, not on stored facts.

## 10. Tests (at the aggregate boundary)

Extracted from `packages/modules/inventory/integration-tests/__tests__/inventory-module-service.spec.ts`. Rephrased in business language as Given/When/Then.

### Create Inventory Item
- Given no inventory items exist, When the caller creates an item with `sku="test-sku"` and `originCountry="DK"`, Then the item is returned with an assigned id (prefix `iitem_`) and both fields populated.
- Given the caller creates an item with `levels` seeded in the same payload, When the create call returns, Then the levels are persisted, each with a unique id, and their `(inventoryItemId, locationId)` slots are occupied.

### Update Inventory Item
- Given an item exists, When the caller updates the item's `title` and `metadata`, Then those fields are updated and `reservedQuantity` projection remains unchanged.

### Delete Inventory Item
- Given an item with two levels and three reservations exists, When the caller deletes the item, Then the item is soft-deleted and both levels and all three reservations are cascade-deleted in the same transaction.

### Add Levels
- Given an item exists with no levels, When the caller adds a level at `locationId="location-1"` with `stockedQuantity=2`, Then the level is persisted with `reservedQuantity=0` and `availableQuantity` reads as 2.
- Given an item already has a level at `locationId="location-1"`, When the caller adds another level for the same location, Then the command is rejected with a uniqueness error on `(inventoryItemId, locationId)`.

### Update Levels
- Given a level exists with `stockedQuantity=4`, When the caller updates the level with `stockedQuantity=6`, Then the level's `stockedQuantity` becomes 6.
- Given a level exists with `stockedQuantity=4`, When the caller updates the level with `stockedQuantityAdjustment=-1`, Then the level's `stockedQuantity` becomes 3.
- Given a level exists, When the caller updates the level with `reservedQuantity=0` in the payload, Then the field is silently sanitized out and the level's `reservedQuantity` is determined solely by its active reservations.

### Remove Levels
- Given a level exists with no reservations, When the caller removes the level, Then the level is soft-deleted.
- Given a level exists with one active reservation, When the caller removes the level, Then the level is soft-deleted and the reservation remains (orphaned) — see invariant 9.

### Create Reservations
- Given an item with two levels (`location-1` stocked=2, `location-2` stocked=2), When the caller creates a reservation at `location-1` for `quantity=2`, Then a reservation is persisted, `location-1.reservedQuantity` becomes 2, and `location-1.availableQuantity` becomes 0.
- Given a level at `location-1` has `stockedQuantity=2` and `reservedQuantity=0`, When the caller creates a reservation for `quantity=3` without `allowBackorder`, Then the command is rejected with "Not enough stock available for item … at location location-1" and `reservedQuantity` remains 0.
- Given a level at `location-1` has `stockedQuantity=2` and `reservedQuantity=0`, When the caller creates a reservation for `quantity=3` with `allowBackorder=true`, Then the reservation is persisted, `reservedQuantity` becomes 3, and `availableQuantity` becomes −1.

### Update Reservations
- Given a reservation at `location-1` with `quantity=3` and a level with `stockedQuantity=10, reservedQuantity=3`, When the caller updates the reservation to `quantity=2`, Then the reservation's `quantity` becomes 2 and the level's `reservedQuantity` becomes 2.
- Given a reservation at `location-1` with `quantity=3` and a level with `stockedQuantity=10, reservedQuantity=3`, When the caller updates the reservation to `quantity=11` without `allowBackorder`, Then the command is rejected and `reservedQuantity` remains 3.
- Given a reservation at `location-1` (`stocked=10, reserved=3`) and another level at `location-2` (`stocked=10, reserved=0`), When the caller updates the reservation's `locationId` to `location-2` keeping `quantity=3`, Then `location-1.reservedQuantity` decrements to 0 and `location-2.reservedQuantity` increments to 3 in the same transaction.

### Remove Reservations
- Given a reservation at `location-1` with `quantity=2` and `level.reservedQuantity=2`, When the caller removes the reservation by id, Then the reservation is soft-deleted and `level.reservedQuantity` becomes 0.
- Given three reservations with `lineItemId="li_1"` at `location-1` (`quantity=2, 2, 2`) and a fourth reservation at the same location with no `lineItemId`, When the caller removes reservations by `lineItemIds=["li_1"]`, Then the three matching reservations are soft-deleted and `level.reservedQuantity` decrements from 8 to 2.

### Restore Reservations
- Given three reservations were removed by `lineItemIds=["li_1"]` (so `level.reservedQuantity` was decremented), When the caller restores reservations by `lineItemIds=["li_1"]`, Then all three reservations have their `deletedAt` cleared and `level.reservedQuantity` re-increments by the original total.

### Concurrent reservation mutations (locking)
- Given a reservation exists at `location-1` and two concurrent flows attempt to update its quantity, When both calls execute, Then the lock keyed on `inventoryItemId` serializes them and the final `level.reservedQuantity` correctly reflects exactly one application of each update — never a lost decrement.

### Read-model queries
- Given an item with `location-1` (stocked=4, reserved=0) and `location-2` (stocked=4, reserved=2), When the caller queries `Get Available Quantity` with both locations, Then the result is 6 (= (4−0) + (4−2)).
- Given an item with `location-1` (stocked=4) and `location-2` (stocked=4), When the caller queries `Get Stocked Quantity` with both locations, Then the result is 8.
- Given an item with `location-1` (reserved=0), `location-2` (reserved=2), `location-3` (reserved=2), When the caller queries `Get Reserved Quantity` with `[location-1, location-2]`, Then the result is 2.
- Given an item whose levels' `availableQuantity` sums to 6 across the queried locations, When the caller calls `Confirm Inventory` with `quantity=5`, Then the result is true; with `quantity=7` it is false.
