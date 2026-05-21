# Product Aggregate — Reverse-Engineering Extraction

Source: `packages/modules/product` (Medusa monorepo, branch `develop`).
Date: 2026-05-14.
Scope: the `Product` aggregate as exposed by `ProductModuleService` — the catalog
write side. Read-side projections are listed for completeness but no read-model
implementation is part of the aggregate boundary.

---

## 1. Bounded context

**Suggested bounded context:** `Product Catalog`.

The Medusa `@medusajs/product` module is one logical service that owns the product
catalog: products, variants, options, option values, images, plus the standalone
catalog taxonomies (tags, types, collections, categories). For Qlerify modeling
we treat **only the Product aggregate** as part of this extraction. The taxonomies
sit in the same bounded context but are separate aggregate roots referenced from
the Product aggregate by ID.

---

## 2. Aggregate root rationale

`Product` is the aggregate root.

**Evidence in code (`packages/modules/product/src/models/product.ts`):**

- `Product` owns the cascade-delete lifecycle of its children:
  `cascades({ delete: ["variants", "options", "images"] })`.
  Soft-delete and restore both propagate from `Product` to variants, options,
  option values, and images (proven by integration tests
  `products.spec.ts` → "should soft delete a product and its cascaded relations"
  / "should restore a soft deleted product and its cascaded relations").
- Variants, options, and images cannot be created without a `product_id`
  (`product-module-service.ts` lines 372–377 and 879–884 throw `INVALID_DATA`
  when missing).
- `ProductOptionValue` belongs to a `ProductOption` which belongs to `Product` —
  three levels of nesting, all rooted at Product.
- Catalog taxonomies (`Tag`, `Type`, `Collection`, `Category`) have their own
  identity and lifecycle independent of any single product. They are referenced
  from Product but not owned by it.

The aggregate boundary therefore contains: **Product, ProductVariant,
ProductOption, ProductOptionValue, ProductImage, ProductVariantProductImage**
(association). Everything else is external.

---

## 3. Service-layer peel

Most callers of the Product aggregate sit in workflow steps under
`packages/core/core-flows/src/product/`. Those workflows orchestrate cross-module
behavior (link product to sales channel, attach inventory items, sync price
sets). They are **service layer** in the DDD sense and stay outside this
extraction. The aggregate commands modeled below are the methods on
`ProductModuleService` itself — what those workflows ultimately call.

Cross-aggregate orchestration we explicitly do **not** model here:

- Linking product variants to sales channels (handled by Sales Channel module).
- Linking variants to inventory items (Inventory module).
- Linking variants to price sets (Pricing module).
- Linking categories/products to publishable API keys (API Key module).

These are link-table mutations that live in the Medusa orchestration layer, not
on the Product aggregate.

---

## 4. Entities and Value Objects

All members below are **entities** — every one carries an `id` field and a
`deleted_at` lifecycle column. There are no pure value objects in this aggregate
in the DDD sense: dimensions (weight/length/height/width) and customs fields
(hs_code/mid_code/origin_country/material) are denormalised onto Product and
ProductVariant rather than modeled as a `Money`/`Dimensions` VO. We keep them as
flat attributes to mirror the code.

### 4.1 Product (aggregate root)

The catalog item that customers browse and purchase.

| Attribute      | Type               | Required | Notes / default                                                             |
|----------------|--------------------|----------|-----------------------------------------------------------------------------|
| id             | string             | yes      | Prefix `prod_…`. Primary key.                                               |
| title          | string             | yes      | Display name. Searchable, translatable.                                     |
| handle         | string             | yes      | URL slug. Auto-derived from `title` via `toHandle` if not provided. Unique. |
| subtitle       | string \| null     | no       | Translatable.                                                               |
| description    | string \| null     | no       | Translatable.                                                               |
| is_giftcard    | boolean            | no       | Default `false`. Forces `discountable=false` on update when toggled true.   |
| status         | enum ProductStatus | no       | One of `draft`, `proposed`, `published`, `rejected`. Default `draft`.       |
| thumbnail      | string \| null     | no       | URL. Auto-set to `images[0].url` on create when missing.                    |
| weight         | number \| null     | no       | Float.                                                                      |
| length         | number \| null     | no       | Float.                                                                      |
| height         | number \| null     | no       | Float.                                                                      |
| width          | number \| null     | no       | Float.                                                                      |
| origin_country | string \| null     | no       | Customs.                                                                    |
| hs_code        | string \| null     | no       | Customs (Harmonized System).                                                |
| mid_code       | string \| null     | no       | Customs (Manufacturer Identification).                                      |
| material       | string \| null     | no       | Translatable.                                                               |
| discountable   | boolean            | no       | Default `true`. Forced `false` whenever `is_giftcard=true`.                 |
| external_id    | string \| null     | no       | Caller-supplied external identifier.                                        |
| metadata       | json \| null       | no       | Free-form key/value bag.                                                    |
| variants       | ProductVariant[]   | no       | Owned children. Cascade soft-delete/restore.                                |
| options        | ProductOption[]    | no       | Owned children. Cascade soft-delete/restore.                                |
| images         | ProductImage[]     | no       | Owned children. Cascade soft-delete/restore.                                |
| type           | ProductType?       | no       | External aggregate, referenced by `type_id` (nullable).                     |
| collection     | ProductCollection? | no       | External aggregate, referenced by `collection_id` (nullable).               |
| tags           | ProductTag[]       | no       | External aggregates, m:n via `tag_ids` on commands.                         |
| categories     | ProductCategory[]  | no       | External aggregates, m:n via `category_ids` on commands.                    |

Database invariants worth noting (from index definitions):

- `handle` is unique among non-soft-deleted rows.
- `(type_id)`, `(collection_id)`, `(status)` are indexed for filter performance.

### 4.2 ProductVariant (child entity)

A purchasable SKU under a Product. Has its own identity, can be added/updated/
soft-deleted independently of the parent Product.

| Attribute        | Type                 | Required | Notes / default                                                                 |
|------------------|----------------------|----------|---------------------------------------------------------------------------------|
| id               | string               | yes      | Prefix `variant_…`. Primary key.                                                |
| title            | string               | yes      | Translatable.                                                                   |
| sku              | string \| null       | no       | Unique among non-soft-deleted rows.                                             |
| barcode          | string \| null       | no       | Unique among non-soft-deleted rows.                                             |
| ean              | string \| null       | no       | Unique among non-soft-deleted rows.                                             |
| upc              | string \| null       | no       | Unique among non-soft-deleted rows.                                             |
| allow_backorder  | boolean              | no       | Default `false`.                                                                |
| manage_inventory | boolean              | no       | Default `true`.                                                                 |
| hs_code          | string \| null       | no       | Customs.                                                                        |
| origin_country   | string \| null       | no       | Customs.                                                                        |
| mid_code         | string \| null       | no       | Customs.                                                                        |
| material         | string \| null       | no       | Translatable.                                                                   |
| weight           | number \| null       | no       |                                                                                 |
| length           | number \| null       | no       |                                                                                 |
| height           | number \| null       | no       |                                                                                 |
| width            | number \| null       | no       |                                                                                 |
| metadata         | json \| null         | no       |                                                                                 |
| variant_rank     | number \| null       | no       | Default `0`. Ordering within product.                                           |
| thumbnail        | string \| null       | no       | Variant-level thumbnail (since 2.11.2).                                         |
| options          | ProductOptionValue[] | yes*     | m:n via pivot `product_variant_option`. Required if parent product has options. |
| images           | ProductImage[]       | no       | m:n via `ProductVariantProductImage`. Variant-specific image overrides.         |

`*` "yes" in the sense that domain validation rejects a variant whose option
combination doesn't cover every `ProductOption` defined on the parent product.

### 4.3 ProductOption (child entity)

A configurable axis on a Product (e.g. "Size", "Color"). Belongs to one Product;
holds a list of `ProductOptionValue`s.

| Attribute | Type                 | Required | Notes                                                          |
|-----------|----------------------|----------|----------------------------------------------------------------|
| id        | string               | yes      | Prefix `opt_…`.                                                |
| title     | string               | yes      | Unique within `(product_id, title)` for non-soft-deleted rows. |
| metadata  | json \| null         | no       |                                                                |
| product   | Product              | yes      | Belongs-to parent Product.                                     |
| values    | ProductOptionValue[] | no       | Cascade-delete children.                                       |

### 4.4 ProductOptionValue (grandchild entity)

A concrete value of a ProductOption (e.g. "Large", "Red"). Belongs to one
ProductOption and is used to build a Variant's option combination.

| Attribute | Type             | Required | Notes                                                                       |
|-----------|------------------|----------|-----------------------------------------------------------------------------|
| id        | string           | yes      | Prefix `optval_…`.                                                          |
| value     | string           | yes      | Unique within `(option_id, value)` for non-soft-deleted rows. Translatable. |
| metadata  | json \| null     | no       |                                                                             |
| option    | ProductOption?   | no       | Belongs-to parent option (nullable in schema, but populated in practice).   |
| variants  | ProductVariant[] | no       | m:n via `product_variant_option`.                                           |

### 4.5 ProductImage (child entity)

An image associated with a Product. Always rooted at a Product (`belongsTo`
Product) and additionally m:n linked to a subset of variants for variant-specific
overrides.

| Attribute | Type             | Required | Notes                                                                  |
|-----------|------------------|----------|------------------------------------------------------------------------|
| id        | string           | yes      | Prefix `img_…`. Table `image`.                                         |
| url       | string           | yes      | Indexed.                                                               |
| rank      | number           | no       | Default `0`. Auto-assigned to array index on create when missing.      |
| metadata  | json \| null     | no       |                                                                        |
| product   | Product          | yes      | Belongs-to parent Product.                                             |
| variants  | ProductVariant[] | no       | m:n via `ProductVariantProductImage`. Empty = "general product image". |

### 4.6 ProductVariantProductImage (association entity)

Pivot row that links a ProductImage to a specific ProductVariant. Modeled as an
entity (it has its own `id`) but semantically a join. Mutated only via
`addImageToVariant` / `removeImageFromVariant`.

| Attribute | Type           | Required | Notes                  |
|-----------|----------------|----------|------------------------|
| id        | string         | yes      | Prefix `pvpi_…`.       |
| variant   | ProductVariant | yes      | Belongs-to.            |
| image     | ProductImage   | yes      | Belongs-to.            |

---

## 5. External references (other aggregates)

The Product aggregate refers to four sibling aggregates by ID. Their internals
live in the same module file but their commands are out of scope for this
extraction (they have their own create/update/delete + own events).

| Reference                | Field on Product / command         | Cardinality   | External aggregate     |
|--------------------------|------------------------------------|---------------|------------------------|
| Product type             | `type_id` (or `type: { id }`)      | many-to-one   | `ProductType`          |
| Product collection       | `collection_id`                    | many-to-one   | `ProductCollection`    |
| Product tags             | `tag_ids: string[]`                | many-to-many  | `ProductTag`           |
| Product categories       | `category_ids: string[]`           | many-to-many  | `ProductCategory`      |

`type` may also be passed as an inline `{ value }` object on create/update — the
service then upserts a `ProductType` row internally (see test
`products.spec.ts:757` "should upsert a product type when type object is
passed"). Even with the inline shape, the result is still a foreign-key
reference — the Product aggregate never owns the type's lifecycle.

---

## 6. Commands

13 aggregate commands. Each maps 1:1 to a domain event (Section 7).

Notation conventions:

- "Category 1" = primitive attribute. "Category 2" = ID-only ref to external
  aggregate (field ends in `Id`). "Category 3" = referenced same-BC entity/VO,
  no nested mutation. "Category 4" = nested entity/VO mutated through the
  aggregate, structure mirrored from the entity model.

### 6.1 Create Product

Creates a Product, optionally with nested options/variants/images and
references to existing tags/categories/collection/type.

**Source:** `ProductModuleService.createProducts` (line 1530).

**Fields (mirroring Product entity):**

| Field                                       | Category        | Notes                                                                                          |
|---------------------------------------------|-----------------|------------------------------------------------------------------------------------------------|
| id                                          | 1               | Optional. Auto-generated `prod_…` if absent.                                                   |
| title                                       | 1               | Required.                                                                                      |
| handle                                      | 1               | Optional. Defaults to `toHandle(title)`.                                                       |
| subtitle                                    | 1               | Optional.                                                                                      |
| description                                 | 1               | Optional.                                                                                      |
| isGiftcard                                  | 1               | Optional, default `false`.                                                                     |
| status                                      | 1               | Optional, default `draft`.                                                                     |
| thumbnail                                   | 1               | Optional. Defaults to first image URL when missing.                                            |
| weight/length/height/width                  | 1               | All optional.                                                                                  |
| originCountry / hsCode / midCode / material | 1               | All optional.                                                                                  |
| discountable                                | 1               | Optional, default `true`. Forced `false` if `isGiftcard=true`.                                 |
| externalId                                  | 1               | Optional.                                                                                      |
| metadata                                    | 1               | Optional JSON.                                                                                 |
| typeId                                      | 2               | Optional. Reference to `ProductType`. May also be passed inline as `type: { value }`.          |
| collectionId                                | 2               | Optional. Reference to `ProductCollection`.                                                    |
| tagIds                                      | 2 (array)       | Optional. References to existing `ProductTag` rows. Throws if any id not found.                |
| categoryIds                                 | 2 (array)       | Optional. References to existing `ProductCategory` rows. Throws if any id not found.           |
| options                                     | 4 (one-to-many) | Nested ProductOption objects: `[{ title, values: [string] }]`.                                 |
| variants                                    | 4 (one-to-many) | Nested ProductVariant objects: `[{ title, sku, ..., options: { [optionTitle]: value } }]`.     |
| images                                      | 4 (one-to-many) | Nested ProductImage objects: `[{ url, rank?, metadata? }]`. Rank auto-assigned to array index. |

**Invariants enforced:**

1. `title` is required (`validateProductCreatePayload` line 1898).
2. `handle` must be URL-safe (`validateProductPayload` line 1885 → `isValidHandle`).
3. Every variant must specify a value for every option declared on the product
   (line 1908–1927 → "Product '…' has variants with missing options: […]").
4. Variant option values must reference values that exist on the corresponding
   product option (line 2152–2157 → "Option value X does not exist for option Y").
5. Two variants on the same product cannot share the same combination of option
   values (line 2229–2253 → "Variant '…' has same combination of option values
   as '…'").
6. Every tag in `tagIds` must already exist (line 1707 → "Tag with id … not
   found. Please create the tag before associating it with the product.").
7. `is_giftcard=true` implies `discountable=false` (normalized in
   `normalizeUpdateProductInput` line 2013–2015).
8. Image rank defaults to its index in the input array if not provided
   (line 1962–1971).

### 6.2 Update Product

Patches a Product. Can update scalar fields, replace images, replace the option
set (with value-identity preservation), upsert+delete variants in one shot, and
attach/detach tag/category/collection/type references.

**Source:** `ProductModuleService.updateProducts` (line 1601). Implementation
delegates to `ProductRepository.deepUpdate` (line 1768).

**Fields:** identical to Create Product except `id` is required and all other
fields are optional. Notable nested mutation semantics:

| Field        | Category  | Update semantics                                                                                               |
|--------------|-----------|----------------------------------------------------------------------------------------------------------------|
| variants     | 4         | Diff-based: variants present in input are upserted, variants absent from input are removed.                    |
| options      | 4         | Same diff. Option values matched by `value` string preserve their existing `id` (test `products.spec.ts:637`). |
| images       | 4         | Replacement: passing `images: []` deletes all images (test `products.spec.ts:1610`).                           |
| tagIds       | 2 (array) | Replacement: array fully replaces the tag set. Each id must exist.                                             |
| categoryIds  | 2 (array) | Replacement: array fully replaces the category set. Each id must exist.                                        |
| collectionId | 2         | Replacement: `null` detaches.                                                                                  |
| typeId       | 2         | Replacement: `null` detaches. Inline `{ value }` triggers an upsert of the ProductType row.                    |

**Invariants enforced (in addition to all create-time invariants):**

1. Product with the supplied `id` must exist (line 1609 → "Product with id … was not found").
2. When updating variants on a product with multiple options, every variant in
   the input must specify a value for every option (test `products.spec.ts:1080`
   → "Product has N option values but there were M provided option values…").
3. Two variants in one update payload cannot share the same option combination
   (test `products.spec.ts:1059`).

### 6.3 Soft Delete Product

Marks the Product as deleted; cascade-soft-deletes its variants, options, option
values, images, and `ProductVariantProductImage` rows.

**Source:** `softDeleteProducts` from `MedusaService` base.
**Field:** `ids: string[]` (Category 1 array of product ids).
**Invariants:** all targeted ids must exist (base service throws otherwise).

### 6.4 Restore Product

Reverses `softDeleteProducts` — clears `deleted_at` on the product and all
cascaded children.

**Source:** `restoreProducts` from `MedusaService` base.
**Field:** `ids: string[]`.

### 6.5 Create Product Variant

Creates one or more variants on an existing product. Differs from "Create
Product" in that the parent product must already exist.

**Source:** `createProductVariants` (line 348).

| Field                                       | Category   | Notes                                                                         |
|---------------------------------------------|------------|-------------------------------------------------------------------------------|
| id                                          | 1          | Optional. Auto-generated `variant_…` if absent.                               |
| productId                                   | 2          | Required. Reference to the parent Product. Throws if missing.                 |
| title                                       | 1          | Required.                                                                     |
| sku                                         | 1          | Optional. Unique among non-soft-deleted rows.                                 |
| barcode / ean / upc                         | 1          | Optional. Unique.                                                             |
| allowBackorder                              | 1          | Optional, default `false`.                                                    |
| manageInventory                             | 1          | Optional, default `true`.                                                     |
| hsCode / originCountry / midCode / material | 1          | Optional.                                                                     |
| weight/length/height/width                  | 1          | Optional.                                                                     |
| variantRank                                 | 1          | Optional, default `0`.                                                        |
| thumbnail                                   | 1          | Optional.                                                                     |
| metadata                                    | 1          | Optional.                                                                     |
| options                                     | 1 (record) | Required when parent has options. Map `{ [optionTitle]: optionValueString }`. |

**Invariants:**

1. `productId` is required (line 372 → "Unable to create variants without
   specifying a product_id").
2. Variant's option values must reference existing values on the parent product
   (line 2152).
3. Variant's option combination must be unique within the parent product
   (line 2185 → "Variant (…) with provided options already exists").

### 6.6 Update Product Variant

Patches one or more variants. Supports partial option updates.

**Source:** `updateProductVariants` (line 476).

| Field                             | Category   | Notes                                                                                                  |
|-----------------------------------|------------|--------------------------------------------------------------------------------------------------------|
| id                                | 1          | Required.                                                                                              |
| (all variant scalar fields above) | 1          | Optional.                                                                                              |
| options                           | 1 (record) | Optional. Partial update — replaces only the listed option axes (test `product-variants.spec.ts:447`). |

**Invariants:**

1. Variant `id` must exist (line 527 → "Cannot update non-existing variants
   with ids: …").
2. Updated option combination must remain unique among variants of the same
   product (test `product-variants.spec.ts:656`).

### 6.7 Soft Delete Product Variant

**Source:** `softDeleteProductVariants` from `MedusaService` base.
**Field:** `ids: string[]`.

### 6.8 Create Product Option

Adds one or more options to an existing product. Option values may be passed
as inline strings.

**Source:** `createProductOptions` (line 857).

| Field     | Category        | Notes                                                       |
|-----------|-----------------|-------------------------------------------------------------|
| productId | 2               | Required.                                                   |
| title     | 1               | Required. Must be unique within `(product_id, title)`.      |
| values    | 4 (one-to-many) | Array of `{ value: string }` (or bare strings, normalized). |
| metadata  | 1               | Optional.                                                   |

**Invariants:**

1. `productId` is required (line 879 → "Tried to create options without specifying a product_id").

### 6.9 Update Product Option

Updates an option, optionally replacing its value list. Existing values matched
by `value` string keep their `id`.

**Source:** `updateProductOptions` (line 960). Underlying repository call uses
`upsertWithReplace` against `values` (line 1054).

| Field    | Category        | Notes                                                                                 |
|----------|-----------------|---------------------------------------------------------------------------------------|
| id       | 1               | Required.                                                                             |
| title    | 1               | Optional.                                                                             |
| values   | 4 (one-to-many) | Optional. Replaces entire value list; existing values keyed by `value` keep their id. |
| metadata | 1               | Optional.                                                                             |

**Invariants:**

1. Option `id` must exist (line 967 / line 1010 → "Cannot update non-existing
   options with ids: …" or "ProductOption with id: … was not found").

### 6.10 Delete Product Option

**Source:** `deleteProductOptions` from `MedusaService` base.
**Field:** `ids: string[]`.
Cascade-deletes each option's `values` (model cascade `delete: ["values"]`).

### 6.11 Update Product Option Value

Patches individual option values directly without going through the option
parent.

**Source:** `updateProductOptionValues` (line 1793).

| Field    | Category | Notes                                                              |
|----------|----------|--------------------------------------------------------------------|
| id       | 1        | Required.                                                          |
| value    | 1        | Optional new string value.                                         |
| metadata | 1        | Optional.                                                          |

**Invariants:**

1. Option value `id` must exist (line 1810).

### 6.12 Add Image To Variant

Associates an existing image with an existing variant (creates a
`ProductVariantProductImage` row).

**Source:** `addImageToVariant` (line 2372).

| Field      | Category | Notes                                                              |
|------------|----------|--------------------------------------------------------------------|
| variantId  | 2        | Required.                                                          |
| imageId    | 2        | Required.                                                          |

(Accepts an array `[{ variant_id, image_id }, …]` for batch.)

### 6.13 Remove Image From Variant

Removes the association created above.

**Source:** `removeImageFromVariant` (line 2402). Same field shape as 6.12.

---

## 7. Domain events

One event per command. Event names follow Medusa's `ProductEvents.*` constants
(see `packages/core/utils/src/product/events.ts`). The base `MedusaService` plus
`createMedusaMikroOrmEventSubscriber` auto-emit `*_CREATED`, `*_UPDATED`, and
`*_DELETED` events for every persisted/modified entity inside an `@EmitEvents()`
boundary, so a single business command fans out into multiple low-level events.
For Qlerify modeling we keep the **business event** (one per command); the
fan-out below is documented for traceability.

| #  | Command                     | Business event                 | Auto-emitted child events on success                                                                                                            |
|----|-----------------------------|--------------------------------|-------------------------------------------------------------------------------------------------------------------------------------------------|
| 1  | Create Product              | `Product Created`              | `PRODUCT_CREATED`, `PRODUCT_OPTION_CREATED` × N, `PRODUCT_OPTION_VALUE_CREATED` × M, `PRODUCT_VARIANT_CREATED` × V, `PRODUCT_IMAGE_CREATED` × I |
| 2  | Update Product              | `Product Updated`              | `PRODUCT_UPDATED` plus cascade `*_CREATED`/`*_UPDATED`/`*_DELETED` for changed children                                                         |
| 3  | Soft Delete Product         | `Product Deleted`              | `PRODUCT_DELETED`, `PRODUCT_VARIANT_DELETED` × V, `PRODUCT_OPTION_DELETED` × N, `PRODUCT_OPTION_VALUE_DELETED` × M, `PRODUCT_IMAGE_DELETED` × I |
| 4  | Restore Product             | `Product Restored`             | `PRODUCT_RESTORED` (+ cascade restored events)                                                                                                  |
| 5  | Create Product Variant      | `Product Variant Created`      | `PRODUCT_VARIANT_CREATED`                                                                                                                       |
| 6  | Update Product Variant      | `Product Variant Updated`      | `PRODUCT_VARIANT_UPDATED`                                                                                                                       |
| 7  | Soft Delete Product Variant | `Product Variant Deleted`      | `PRODUCT_VARIANT_DELETED`                                                                                                                       |
| 8  | Create Product Option       | `Product Option Created`       | `PRODUCT_OPTION_CREATED`, `PRODUCT_OPTION_VALUE_CREATED` × M                                                                                    |
| 9  | Update Product Option       | `Product Option Updated`       | `PRODUCT_OPTION_UPDATED` (+ value created/updated/deleted)                                                                                      |
| 10 | Delete Product Option       | `Product Option Deleted`       | `PRODUCT_OPTION_DELETED`, `PRODUCT_OPTION_VALUE_DELETED` × M                                                                                    |
| 11 | Update Product Option Value | `Product Option Value Updated` | `PRODUCT_OPTION_VALUE_UPDATED`                                                                                                                  |
| 12 | Add Image To Variant        | `Image Attached To Variant`    | (no `ProductEvents` constant — model as application-level)                                                                                      |
| 13 | Remove Image From Variant   | `Image Detached From Variant`  | (no `ProductEvents` constant — model as application-level)                                                                                      |

**Event payload shape** (all `ProductEvents.*`): `{ id }` — the affected
entity's id only. See `events.spec.ts:86–148`. No further data is included.

**Lane (actor):** every command is invoked by a Catalog Manager (human role) or
by an upstream system through Automation. Both lanes are valid; for a clean
extraction, model commands 1–11 on the **Catalog Manager** lane and commands
12–13 on **Automation** (variant-image association is typically driven by upload
workflows). The codebase imposes no lane restriction.

---

## 8. Read models / queries

The aggregate exposes the following read methods on `ProductModuleService`. All
support a generic `FindConfig` (relations, fields, pagination, ordering) plus a
typed `Filterable*Props` selector.

| Read model                    | Method                                           | Key filter parameters                                                                                                                                                                               |
|-------------------------------|--------------------------------------------------|-----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|
| Get Product                   | `retrieveProduct(id, config?)`                   | `id`. Special-case: requesting `variants.images` triggers a separate variant-image build pass.                                                                                                      |
| List Products                 | `listProducts(filters?, config?)`                | `id`, `q` (free-text), `handle`, `status[]`, `collection_id`, `category_id`, `type_id`, `tags.id`, `variants.options.option_id`, `variants.options.value`, `created_at`, `updated_at`, `deleted_at` |
| List + Count Products         | `listAndCountProducts(filters?, config?)`        | Same as above; returns `[items, total]`.                                                                                                                                                            |
| Get Product Variant           | `retrieveProductVariant(id, config?)`            | `id`. Special-case: requesting `images` triggers variant-image build.                                                                                                                               |
| List Product Variants         | `listProductVariants(filters?, config?)`         | `id`, `product_id`, `sku`, `options.value`, plus generic timestamps.                                                                                                                                |
| List + Count Product Variants | `listAndCountProductVariants(filters?, config?)` | Same as above; returns `[items, total]`.                                                                                                                                                            |
| List Product Options          | `listProductOptions(filters?, config?)`          | Auto-generated by `MedusaService` base.                                                                                                                                                             |
| Retrieve Product Option       | `retrieveProductOption(id, config?)`             | Auto-generated.                                                                                                                                                                                     |
| List Product Images           | `listProductImages(filters?, config?)`           | Auto-generated. Includes `product_id`.                                                                                                                                                              |

`FindConfig` always allows: `relations[]`, `select[]`, `take`, `skip`, `order`,
`withDeleted`. Filters supporting array values use the `$in` operator
implicitly; `$gt`/`$lt`/`$gte`/`$lte`/`$nin`/`$or` are available on top of any
filterable field.

---

## 9. Invariants (consolidated)

Carried forward from Sections 6.1–6.13 plus model-level constraints. To be
attached as Given-When-Then conditions (or attribute-level `isRequired`) when
modeled in Qlerify.

**Aggregate-root level:**

- I1. `Product.title` is required on create.
- I2. `Product.handle` is unique among non-soft-deleted products.
- I3. `Product.handle` must be URL-safe (regex enforced by `isValidHandle`).
- I4. `Product.handle` defaults to `toHandle(title)` if absent on create.
- I5. `Product.is_giftcard=true` ⇒ `Product.discountable=false`.
- I6. `Product.thumbnail` defaults to `images[0].url` on create.
- I7. Soft-deleting a Product cascade-soft-deletes its variants, options,
       option values, and images. Restoring reverses this.

**Variant level:**

- I8. `ProductVariant` cannot exist without a parent `Product` (FK + service
       guard).
- I9. `ProductVariant.sku/barcode/ean/upc` are unique among non-soft-deleted
       rows.
- I10. Every variant must define a value for every option declared on its
        parent product.
- I11. A variant's option values must exist on the parent product's options.
- I12. No two non-soft-deleted variants on the same product may share the same
        option-value combination.

**Option level:**

- I13. `ProductOption.title` is unique within a product (excluding
        soft-deleted).
- I14. `ProductOptionValue.value` is unique within an option (excluding
        soft-deleted).
- I15. Cascading: deleting a Product deletes its options and option values;
        deleting an option deletes its values.

**Image level:**

- I16. `ProductImage.rank` auto-assigns to its index in the input array on
        create when not provided.
- I17. Updating a Product with `images: []` deletes all of its images.
- I18. Listed images are returned ordered by `rank` ascending when the relation
        is requested.

**External reference level:**

- I19. Tag references (`tagIds`) must point to existing `ProductTag` rows;
        Product create/update fails otherwise.
- I20. Category references (`categoryIds`) must point to existing
        `ProductCategory` rows; Product create/update fails otherwise.
- I21. Collection references must point to an existing `ProductCollection`.
- I22. Type references must point to an existing `ProductType` (or be passed
        inline as `{ value }` to upsert it).

---

## 10. Acceptance criteria (Given / When / Then)

Distilled from the integration test suite. Each entry maps to one of the
commands above and should be attached as `acceptanceCriteria` on the
corresponding domain event when the model is built in Qlerify.

### Create Product (`Product Created`)

- *Given* tags exist, *When* a manager creates a product with a title, an
  option, one variant covering that option, one image, and a tag id, *Then*
  the product is persisted with that title, a handle derived via
  kebab-case from the title, the image with `rank=0`, an option with one value,
  one variant whose `options` includes that option value, and one tag association.
  Defaults applied: `allow_backorder=false`, `manage_inventory=true`,
  `variant_rank=0`. (`products.spec.ts:1120`)
- *Given* a product create payload with two options ("opt1" and "opt2") and one
  variant that only specifies "opt1", *When* the manager creates it, *Then*
  the call fails with "Product '…' has variants with missing options:
  [missing option]". (`products.spec.ts:1207`)
- *Given* a Product create payload, *When* the manager creates it, *Then*
  exactly `1 + N(options) + M(option_values) + V(variants) + I(images)` events
  are emitted in a single batch. (`events.spec.ts:38`)

### Update Product (`Product Updated`)

- *Given* a product, *When* the manager updates it with a new variants array
  containing one variant kept (by id) and one new variant, *Then* the kept
  variant retains its id and the new variant is created.
  (`products.spec.ts:476`)
- *Given* a product with options and option values, *When* the manager updates
  the product replacing the options array using the same `value` strings,
  *Then* the option ids and option-value ids remain unchanged.
  (`products.spec.ts:637`)
- *Given* a product, *When* the manager attaches a new tag/category/collection,
  *Then* the relationships are persisted. (`products.spec.ts:721`)
- *Given* a product, *When* the manager passes a `type` object with no id,
  *Then* the type is upserted by value and assigned to the product.
  (`products.spec.ts:757`)
- *Given* a product, *When* the manager sends an update with two variants
  sharing the same option combination, *Then* the call fails with "Variant
  '…' has same combination of option values as '…'". (`products.spec.ts:1059`)
- *Given* a product with two options, *When* the manager sends an update
  containing a variant that specifies only one option, *Then* the call fails
  with "Product has 2 option values but there were 1 provided option values
  for the variant: …". (`products.spec.ts:1080`)
- *Given* a product, *When* the manager sends an update with a non-existing
  option name, *Then* the call fails with "Option value … does not exist for
  option …". (`products.spec.ts:1097`)
- *Given* a non-existing product id, *When* an update is attempted, *Then*
  the call fails with "Product with id: … was not found".
  (`products.spec.ts:855`)
- *Given* a product with three images, *When* the manager updates it with the
  reversed image array, *Then* image ranks become 0/1/2 in the new order.
  (`products.spec.ts:1577`)
- *Given* a product with images, *When* the manager updates it with
  `images: []`, *Then* all its images are deleted. (`products.spec.ts:1610`)

### Soft Delete Product (`Product Deleted`)

- *Given* a product with options, option values, and variants, *When* the
  manager soft-deletes the product, *Then* `deleted_at` is set on the product,
  every option, every option value, and every variant.
  (`products.spec.ts:1234`)
- *Given* a soft-deleted product, *When* the manager queries with
  `withDeleted: true` and `deleted_at: { $gt: '01-01-2022' }`, *Then* the
  product appears in the result. (`products.spec.ts:1364`)

### Restore Product (`Product Restored`)

- *Given* a soft-deleted product, *When* the manager calls
  `restoreProducts([id])`, *Then* `deleted_at` is cleared on the product, every
  option, every option value, and every variant. (`products.spec.ts:1390`)

### Create Product Variant (`Product Variant Created`)

- *Given* an existing product with options, *When* the manager creates a
  variant referencing that product and providing all option values, *Then* the
  variant is persisted and linked to the matching `ProductOptionValue` ids.
  (`product-variants.spec.ts:487`, 514)
- *Given* an existing product with a variant for `(small, red)`, *When* the
  manager creates another variant with `(small, red)`, *Then* the call fails
  with "Variant (…) with provided options already exists".
  (`product-variants.spec.ts:589`)
- *Given* a Create Product Variant payload, *When* it succeeds, *Then* exactly
  one `PRODUCT_VARIANT_CREATED` event is emitted. (`events.spec.ts:506`)

### Update Product Variant (`Product Variant Updated`)

- *Given* a variant, *When* the manager updates only its title, *Then* the
  title is changed and other fields are preserved. (`product-variants.spec.ts:433`)
- *Given* a variant with options `(size=small, color=red)`, *When* the manager
  updates only `color=blue`, *Then* the variant ends up with
  `(size=small, color=blue)`. (`product-variants.spec.ts:447`)
- *Given* a variant id that does not exist, *When* an update is attempted,
  *Then* the call fails with "Cannot update non-existing variants with ids: …".
  (`product-variants.spec.ts:471`)
- *Given* a product with two variants `(small,red)` and `(small,blue)`, *When*
  the manager updates the second variant's options to `(small,red)`, *Then*
  the call fails with "Variant (…) with provided options already exists".
  (`product-variants.spec.ts:656`)
- *Given* an Update Product Variant call, *When* it succeeds, *Then* exactly
  one `PRODUCT_VARIANT_UPDATED` event is emitted. (`events.spec.ts:531`)

### Soft Delete Product Variant (`Product Variant Deleted`)

- *Given* a variant linked to option values, *When* the manager soft-deletes
  it, *Then* `deleted_at` is set on the variant.
  (`product-variants.spec.ts:699`)

### Create Product Option (`Product Option Created`)

- *Given* a product, *When* the manager creates a new option referencing that
  product (with `values: []`), *Then* the option is persisted under that
  product. (`product-options.spec.ts:281`)

### Update Product Option (`Product Option Updated`)

- *Given* an existing option, *When* the manager updates its title via
  `upsertProductOptions`, *Then* the new title is reflected.
  (`product-options.spec.ts:252`)
- *Given* a non-existing option id, *When* an update is attempted, *Then* the
  call fails with "ProductOption with id: … was not found".
  (`product-options.spec.ts:265`)

### Delete Product Option (`Product Option Deleted`)

- *Given* an existing option, *When* the manager deletes it by id, *Then*
  `listProductOptions({ id })` returns empty. (`product-options.spec.ts:238`)

### Update Product Option Value (`Product Option Value Updated`)

- *Given* an option value, *When* the manager updates it, *Then* one
  `PRODUCT_OPTION_VALUE_UPDATED` event is emitted. (`events.spec.ts:867`)

### Add Image To Variant (`Image Attached To Variant`)

- *Given* a product with two general images and one variant-specific image,
  *When* the manager calls `addImageToVariant({ variant_id, image_id })` for
  the variant-specific image and the small variant, *Then* the small variant
  resolves images = both general images + the variant-specific one (3 total),
  while the large variant still resolves = just the general images.
  (`products.spec.ts:1722`)

### Remove Image From Variant (`Image Detached From Variant`)

- *Given* a `ProductVariantProductImage` row, *When* the manager calls
  `removeImageFromVariant`, *Then* that pivot row is deleted and the variant
  no longer reports that image as variant-specific.

---

## 11. Mapping back to the Qlerify creation sequence

For when this extraction is later pushed into a Qlerify workflow, the following
table is the per-phase input.

| Phase | Step | Input from this document                                                                                                                                                                                                                    |
|-------|------|---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|
| 2     | 2    | Section 7 → 13 events. Lane = "Catalog Manager" for #1–#11, "Automation" for #12–#13.                                                                                                                                                       |
| 3     | 3    | Section 1 → 1 bounded context, "Product Catalog".                                                                                                                                                                                           |
| 3     | 4    | Section 4 → entities Product (aggregate root for events 1–4 + 12–13), ProductVariant (root for 5–7), ProductOption (root for 8–10), ProductOptionValue (root for 11), ProductImage, ProductVariantProductImage.                             |
| 3     | 5    | Section 6 → 13 commands, one per event, with the field categories noted.                                                                                                                                                                    |
| 3     | 6    | Section 8 → read models. "Get Product Details" reusable across events 1, 2, 4. "List Products" reusable across events 1, 3. "List Product Variants" reusable across events 5, 6, 7. "List Product Options" reusable across events 8, 9, 10. |
| 3     | 7    | Skip — Medusa is not Event Sourced; no domain event schemas needed.                                                                                                                                                                         |
| 3     | 8    | Section 4 → flesh out entity attributes with `dataType`, `description`,                                                                                                                                                                     |
|       |      | `exampleData`, `relatedEntity`, `cardinality`, `isRequired` per the rules.                                                                                                                                                                  |
| 4     | 9    | Run `validate_domain_model`.                                                                                                                                                                                                                |
| 4     | 10   | Reconcile against this document; nothing here is auto-applied.                                                                                                                                                                              |

---

## 12. Open questions / things to confirm before pushing to Qlerify

- `ProductVariantProductImage` is a join entity with its own id. Should it be
  modeled as an entity in Qlerify (mirrors code) or collapsed into a m:n
  relationship attribute on `ProductVariant`/`ProductImage` (mirrors domain
  semantics)? Recommend collapsing it — there is no command that targets the
  pivot directly except the attach/detach operations.
- `addImageToVariant` and `removeImageFromVariant` do not have `ProductEvents`
  constants. The aggregate emits `PRODUCT_IMAGE_*` only via the base service
  cascade. Decide whether to model these as application-level events or not at
  all.
- Tags/types/collections/categories are managed inside the same module file but
  represent separate aggregate roots. They are intentionally out of scope here.
  When modeling the full catalog domain, plan one Qlerify workflow per
  aggregate.
