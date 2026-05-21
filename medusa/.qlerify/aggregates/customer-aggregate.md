# Customer Aggregate — Standalone DDD Model

**Source:** `packages/modules/customer/` (Medusa monorepo).
**Service entry point:** `CustomerModuleService` (`packages/modules/customer/src/services/customer-module.ts`).
**Bounded context:** `Customer Management`.

The Medusa Customer module physically hosts two distinct aggregates: **Customer** and **Customer Group**. They live in the same module because Customer Group references Customer through a join table (`CustomerGroupCustomer`), but each has an independent root, lifecycle, and command surface. This artifact covers **only the Customer aggregate**: the customer record and its owned addresses. Customer Group is out of scope and modeled separately. Cross-aggregate workflows — converting carts to orders, sending verification emails, syncing with auth identities, evaluating customer-segment promotions — live in `packages/core/core-flows/` and are out of scope.

## 1. Aggregate Hierarchy

```
Customer (aggregate root)
└── addresses[]    : Customer Address    (Related Entity — add / update / remove)
```

**Why these classifications:**

- **Customer Address** is a Related Entity, not a Value Object. Each address has its own identity, its own update commands, its own create/update timestamps, and its own lifecycle (add / update / remove). The merchant or customer talks about specific addresses by id ("update my work address") and mutates them in place; addresses are not replaced wholesale.
- **No Value Objects on the root.** Customer's fields are plain primitives (`email`, `firstName`, etc.) and a `metadata` JSON bag. There is no embedded address, money, or other VO directly on Customer.
- **Customer Group is a separate aggregate.** It has its own root, can be created without any customers, can be renamed and deleted independently, and has its own membership operations (`addCustomerToGroup`, `removeCustomerFromGroup`). The join entity `CustomerGroupCustomer` belongs to the Customer Group aggregate (it represents membership *from the group's perspective*); Customer only sees group membership as an external reference.
- **No `has_account` lifecycle on the root.** `hasAccount` is a create-only boolean flag distinguishing guest vs. registered customers. It is not a state machine — there is no "register" command that flips it; the application instead creates a new customer record with `hasAccount=true`. See invariant 5.

## 2. Aggregate Root: Customer

A person (or organization) recognized by the storefront. May be a registered account holder or an anonymous guest captured at checkout. Carries identifying information (email, name, company, phone), an arbitrary metadata bag for merchant extensions, and a collection of owned addresses. Group memberships and order history are tracked outside the aggregate.

### Attributes (Customer)

| Attribute   | Type               | Req | Default | Notes                                                                                                                  |
|-------------|--------------------|-----|---------|------------------------------------------------------------------------------------------------------------------------|
| id          | string             | yes | gen     | Prefix `cus_`. Create-only.                                                                                            |
| email       | string \| null     | no  | null    | Buyer email. Part of the `(email, hasAccount)` uniqueness constraint among non-deleted records.                        |
| hasAccount  | boolean            | yes | false   | True if the customer has a registered account; false if a guest. **Create-only** — cannot be flipped after creation.   |
| firstName   | string \| null     | no  | null    | Given name.                                                                                                            |
| lastName    | string \| null     | no  | null    | Family name.                                                                                                           |
| companyName | string \| null     | no  | null    | Company or organization name on the customer record (distinct from any address-level company field).                   |
| phone       | string \| null     | no  | null    | Primary contact phone number.                                                                                          |
| metadata    | object \| null     | no  | null    | Merchant extension fields.                                                                                             |
| createdBy   | string \| null     | no  | null    | Audit identifier of the user or system that created this record. Opaque to the aggregate.                              |
| addresses   | Customer Address[] | no  | []      | Owned collection (§3).                                                                                                 |

## 3. Related Entity: Customer Address

A delivery, billing, or saved location attached to the customer. Each address has its own identity and lifecycle. At most one address per customer may be flagged `isDefaultShipping`, and at most one may be flagged `isDefaultBilling`.

### Attributes (Customer Address)

| Attribute          | Type            | Req | Default | Notes                                                                                                            |
|--------------------|-----------------|-----|---------|------------------------------------------------------------------------------------------------------------------|
| id                 | string          | yes | gen     | Prefix `cuaddr_`. Create-only.                                                                                   |
| addressName        | string \| null  | no  | null    | Friendly label for the address (e.g. "Home", "Work", "Warehouse").                                               |
| isDefaultShipping  | boolean         | yes | false   | When true, this is the customer's default shipping address. At most one per customer.                            |
| isDefaultBilling   | boolean         | yes | false   | When true, this is the customer's default billing address. At most one per customer.                             |
| company            | string \| null  | no  | null    | Company name on the address itself (may differ from `customer.companyName`).                                     |
| firstName          | string \| null  | no  | null    | Recipient first name.                                                                                            |
| lastName           | string \| null  | no  | null    | Recipient last name.                                                                                             |
| address1           | string \| null  | no  | null    | Street line 1.                                                                                                   |
| address2           | string \| null  | no  | null    | Street line 2.                                                                                                   |
| city               | string \| null  | no  | null    | City.                                                                                                            |
| countryCode        | string \| null  | no  | null    | ISO 3166-1 alpha-2.                                                                                              |
| province           | string \| null  | no  | null    | State / province / region. Stored as lower-case (ISO 3166-2 form).                                               |
| postalCode         | string \| null  | no  | null    | ZIP / postal code.                                                                                               |
| phone              | string \| null  | no  | null    | Contact phone for this address.                                                                                  |
| metadata           | object \| null  | no  | null    | Extension fields.                                                                                                |

## 4. Commands (Aggregate Boundary)

The Customer aggregate exposes **6 commands**. Each has a 1:1 domain event. All Customer Group / group-membership commands belong to the separate Customer Group aggregate and are explicitly out of scope.

| # | Command              | Payload (aggregate-facing)                                                                                                                                                                                                                                                                                  | Notes                                                                                                                                    |
|---|----------------------|-------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|------------------------------------------------------------------------------------------------------------------------------------------|
| 1 | **Create Customer**  | `email?`, `hasAccount?`, `firstName?`, `lastName?`, `companyName?`, `phone?`, `metadata?`, `createdBy?`, `addresses?[]` of `{ addressName?, isDefaultShipping?, isDefaultBilling?, company?, firstName?, lastName?, address1?, address2?, city?, countryCode?, province?, postalCode?, phone?, metadata? }` | Atomic. May seed addresses. Rejected if `(email, hasAccount)` already exists among non-deleted customers.                                |
| 2 | **Update Customer**  | `id`, `email?`, `firstName?`, `lastName?`, `companyName?`, `phone?`, `metadata?`                                                                                                                                                                                                                            | Cannot change `hasAccount` or `createdBy`.                                                                                               |
| 3 | **Delete Customer**  | `id`                                                                                                                                                                                                                                                                                                        | Soft-deletes the customer. Cascades hard-delete to addresses; cascades detach to group memberships.                                      |
| 4 | **Add Addresses**    | `id`, `addresses[]` of `{ addressName?, isDefaultShipping?, isDefaultBilling?, company?, firstName?, lastName?, address1?, address2?, city?, countryCode?, province?, postalCode?, phone?, metadata? }`                                                                                                     | Adds new owned addresses. Rejected if any payload would create a second `isDefaultShipping` or `isDefaultBilling` for the same customer. |
| 5 | **Update Addresses** | `id`, `addresses[]` of `{ id, addressName?, isDefaultShipping?, isDefaultBilling?, company?, firstName?, lastName?, address1?, address2?, city?, countryCode?, province?, postalCode?, phone?, metadata? }`                                                                                                 | Mutates owned addresses in place. Subject to the default-shipping / default-billing uniqueness invariants.                               |
| 6 | **Remove Addresses** | `id`, `addresses[]` of `{ id }`                                                                                                                                                                                                                                                                             | Soft-deletes the selected addresses.                                                                                                     |

**Commands explicitly merged or omitted:**

- `softDeleteCustomers` — **merged** into `Delete Customer`. The service distinguishes hard- and soft-delete entry points; from a domain-command perspective there is one "delete customer" event with soft-delete semantics.
- **Set Default Shipping Address** / **Set Default Billing Address** — NOT separate commands. Defaults are toggled via `Update Addresses` setting `isDefaultShipping` or `isDefaultBilling`. The database enforces at-most-one. Splitting these out would be redundant.
- **Register Customer** / **Convert Guest to Account** — NOT a domain command. `hasAccount` is create-only; the application creates a new customer with `hasAccount=true` rather than flipping the flag, and the cross-aggregate auth/account workflow lives outside.
- **Customer Group commands** (`createCustomerGroups`, `updateCustomerGroups`, `deleteCustomerGroups`, `addCustomerToGroup`, `removeCustomerFromGroup`, `listCustomerGroups`, etc.) — NOT Customer aggregate commands. They belong to the separate Customer Group aggregate.

## 5. Domain Events

| #  | Event              | Emitted by         |
|----|--------------------|--------------------|
| 1  | Customer Created   | Create Customer    |
| 2  | Customer Updated   | Update Customer    |
| 3  | Customer Deleted   | Delete Customer    |
| 4  | Addresses Added    | Add Addresses      |
| 5  | Addresses Updated  | Update Addresses   |
| 6  | Addresses Removed  | Remove Addresses   |

## 6. Read Models / Queries

### Query: Get Customer

Inputs: `id`, optional relation/field selectors.

Returns the full Customer plus optional expansions:

| Field       | Description                                                                                             |
|-------------|---------------------------------------------------------------------------------------------------------|
| id          | Customer id.                                                                                            |
| email       | Email address.                                                                                          |
| hasAccount  | Registered vs. guest flag.                                                                              |
| firstName   | Given name.                                                                                             |
| lastName    | Family name.                                                                                            |
| companyName | Company on the customer record.                                                                         |
| phone       | Primary phone.                                                                                          |
| metadata    | Extension fields.                                                                                       |
| createdBy   | Audit identifier of the creator.                                                                        |
| addresses   | (Optional expansion) Array of `Customer Address` projections (see Get Address fields below).            |
| groups      | (Optional expansion) Array of Customer Group projections (`{ id, name, metadata }`). External — see §8. |

### Query: List Customers

Filterable by:

| Filter         | Type     | Notes                                                                              |
|----------------|----------|------------------------------------------------------------------------------------|
| ids            | string[] | By customer id.                                                                    |
| email          | string   | Exact match.                                                                       |
| hasAccount     | boolean  | Filter by guest vs. registered.                                                    |
| firstName      | string   | Substring / exact depending on caller.                                             |
| lastName       | string   | Substring / exact depending on caller.                                             |
| companyName    | string   | Substring / exact.                                                                 |
| phone          | string   | Exact match.                                                                       |
| createdBy      | string   | By audit identifier.                                                               |
| groupIds       | string[] | Customers belonging to any of the given Customer Groups (external join).           |
| q              | string   | Free-text search across `email`, `firstName`, `lastName`, `companyName`, `phone`.  |
| createdAt      | range    | Date range.                                                                        |
| updatedAt      | range    | Date range.                                                                        |

Returns Customer projections (subset of Get Customer fields).

### Query: Get Address

Inputs: `id`.

| Field              | Description                                                  |
|--------------------|--------------------------------------------------------------|
| id                 | Address id.                                                  |
| customerId         | Parent customer id (FK to Customer aggregate).               |
| addressName        | Friendly label.                                              |
| isDefaultShipping  | Default-shipping flag.                                       |
| isDefaultBilling   | Default-billing flag.                                        |
| company            | Company on the address.                                      |
| firstName          | Recipient first name.                                        |
| lastName           | Recipient last name.                                         |
| address1           | Street line 1.                                               |
| address2           | Street line 2.                                               |
| city               | City.                                                        |
| countryCode        | ISO 3166-1 alpha-2.                                          |
| province           | Province / state, lower-case.                                |
| postalCode         | Postal code.                                                 |
| phone              | Contact phone for the address.                               |
| metadata           | Extension fields.                                            |

### Query: List Addresses

Filterable by:

| Filter             | Type     | Notes                                                                                  |
|--------------------|----------|----------------------------------------------------------------------------------------|
| ids                | string[] | By address id.                                                                         |
| customerId         | string[] | Addresses owned by these customers.                                                    |
| addressName        | string   | Substring / exact.                                                                     |
| isDefaultShipping  | boolean  | Filter on default-shipping flag.                                                       |
| isDefaultBilling   | boolean  | Filter on default-billing flag.                                                        |
| city               | string   | Exact match.                                                                           |
| countryCode        | string   | Exact match (ISO alpha-2).                                                             |
| province           | string   | Exact match.                                                                           |
| postalCode         | string   | Exact match.                                                                           |
| company            | string   | Substring / exact.                                                                     |
| q                  | string   | Free-text search across name / company / address lines / city / province / postal.     |

Returns Customer Address projections.

## 7. Invariants

1. **`(email, hasAccount)` uniqueness among non-deleted customers.** The pair must be unique across all live records. Allows the same email to exist exactly twice: once as a guest (`hasAccount=false`) and once as a registered account (`hasAccount=true`). Soft-deleted records do not participate in the constraint, so a deleted-and-recreated customer is permitted.
2. **`hasAccount` is create-only.** It is required (defaulting to `false`) on `Create Customer` and is not accepted by `Update Customer`. The aggregate exposes no command to flip it; converting a guest to an account is modeled as creating a new customer with `hasAccount=true`.
3. **At most one default shipping address per customer.** Any operation (`Add Addresses` or `Update Addresses`) that would result in two addresses for the same customer with `isDefaultShipping=true` is rejected with a uniqueness error.
4. **At most one default billing address per customer.** Same as (3) for `isDefaultBilling`.
5. **`Delete Customer` cascades hard-delete to addresses.** When a customer is deleted, their owned `Customer Address` records are removed outright (not soft-deleted). The cascade is enforced by the persistence layer's `ON DELETE CASCADE` rule on the address foreign key.
6. **`Delete Customer` cascades detach to group memberships.** When a customer is deleted, all of their `CustomerGroupCustomer` membership rows are removed. The Customer Group records themselves are not touched.
7. **Address requires an owning customer.** A `Customer Address` cannot exist without a `customerId`. The aggregate refuses to create or update an address that does not resolve to a live customer.
8. **`createdBy` is opaque and create-only.** It is recorded for audit on creation and is not modified by any subsequent command.
9. **Soft-delete semantics for Customer.** `Delete Customer` marks `deletedAt` rather than physically removing the row. Read queries (Get / List) exclude soft-deleted customers unless explicitly requested.

## 8. External References

| Field                       | Points to                                                                                                                     |
|-----------------------------|-------------------------------------------------------------------------------------------------------------------------------|
| Customer.createdBy          | Auth identity / User aggregate (or any opaque audit identifier)                                                               |
| Customer Address.customerId | Customer (back-reference within the aggregate — not external)                                                                 |
| Customer Group membership   | Customer Group aggregate (the join `CustomerGroupCustomer` belongs to that aggregate; Customer only references it externally) |

Cross-aggregate orchestration that exists in the codebase but is **out of scope** for this aggregate:

- **Customer Group memberships.** `addCustomerToGroup` and `removeCustomerFromGroup` are Customer Group aggregate commands. They reference Customer by id but do not mutate Customer state.
- **Auth identity linkage.** The Auth module owns credentials; when a user registers, a cross-aggregate workflow creates a Customer with `hasAccount=true` and an Auth Identity, linking them via `customer.id` ↔ `auth_identity.app_metadata`. The Customer aggregate is unaware of authentication.
- **Cart and Order linkage.** Cart and Order both store `customerId`. Updates propagate one way (cart/order reads customer); the Customer aggregate does not learn about carts or orders.
- **Promotion segmentation.** Promotion rules may target customers by group; that evaluation lives in the Promotion Module, which reads from Customer Group, not from this aggregate.
- **Customer-facing notifications.** Email / SMS verification, password reset, welcome emails are emitted by subscribers on Customer Created / Updated events and dispatched via the Notification Module.

## 9. Tests (at the aggregate boundary)

Extracted from `packages/modules/customer/integration-tests/__tests__/services/customer-module/index.spec.ts`. Rephrased in business language as Given/When/Then.

### Create Customer
- Given no customer exists, When the caller creates a customer with email `john@acme.com`, first name `John`, last name `Doe`, and `hasAccount=false`, Then a Customer is returned with an assigned id (prefix `cus_`), all fields populated, and `createdAt` / `updatedAt` timestamps set.
- Given a customer already exists with email `john@acme.com` and `hasAccount=false`, When the caller creates another customer with the same email and `hasAccount=true`, Then both customers persist side by side (one guest, one account holder).
- Given a customer already exists with email `john@acme.com` and `hasAccount=false`, When the caller creates another customer with the same email and same `hasAccount=false`, Then the command is rejected with a uniqueness error referencing email and hasAccount.
- Given a customer already exists with email `john@acme.com` and `hasAccount=true`, When the caller creates another customer with the same email and same `hasAccount=true`, Then the command is rejected with a uniqueness error.
- Given a customer creation payload including a nested `addresses` array, When the caller creates the customer, Then the customer and its addresses are persisted atomically and the addresses carry the new `customerId`.
- Given a customer creation payload whose `addresses` array contains two entries both with `isDefaultShipping=true`, When the caller creates the customer, Then the command is rejected with an address-uniqueness error.

### Update Customer
- Given a customer exists, When the caller updates the customer's `firstName` to `Jonathan`, Then the customer's `firstName` becomes `Jonathan`; `hasAccount` is unchanged.
- Given multiple customers exist, When the caller updates a batch of ids with the same field changes, Then all targeted customers receive the update.
- Given multiple customers with `lastName=Doe`, When the caller calls update with a selector `{ lastName: "Doe" }` and update data, Then all matching customers are updated.

### Delete Customer
- Given a customer exists, When the caller deletes the customer, Then the customer is soft-deleted (`deletedAt` set); subsequent `Get Customer` requests by id raise a not-found error.
- Given a customer with two owned addresses exists, When the caller deletes the customer, Then the customer is soft-deleted and both addresses are hard-deleted from the address store.
- Given a customer that is a member of two Customer Groups exists, When the caller deletes the customer, Then the customer is soft-deleted and the corresponding `CustomerGroupCustomer` membership rows are removed; the Customer Group records themselves are untouched.

### Add Addresses
- Given a customer exists, When the caller adds an address with `addressName="Home"`, country `US`, and `isDefaultShipping=true`, Then a new `Customer Address` is created and linked to the customer.
- Given a customer already has a default shipping address, When the caller adds another address with `isDefaultShipping=true`, Then the command is rejected with a default-shipping uniqueness error.
- Given a customer already has a default billing address, When the caller adds another address with `isDefaultBilling=true`, Then the command is rejected with a default-billing uniqueness error.

### Update Addresses
- Given a customer's address exists, When the caller updates the address's `addressName` and `phone`, Then the fields are updated and the customer linkage is preserved.

### Remove Addresses
- Given a customer's address exists, When the caller removes the address, Then the address is soft-deleted and no longer appears in `List Addresses` for that customer (when the default filter excludes soft-deleted records).
