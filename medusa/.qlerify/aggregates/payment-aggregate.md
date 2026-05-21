# Payment Aggregate — DDD Extraction

**Source:** Medusa monorepo, `packages/modules/payment/`
**Extracted on:** 2026-05-13
**Aggregate scope chosen:** `PaymentCollection` (top-level), with `PaymentSession`, `Payment`, `Capture`, `Refund` modeled as nested entities inside the aggregate boundary.

This document captures Phase 0 of the Qlerify workflow-creation skill: it isolates one aggregate from the existing codebase, lists every entity / value object / command / event / invariant / test the model needs, and notes external references that cross the aggregate boundary. It does NOT push to Qlerify — it is the input artifact for that step.

---

## 1. Aggregate Root Selection

The module surfaces **two candidate roots**:

| Candidate           | Status                                                                           | Verdict                                                                                                                                                                       |
|---------------------|----------------------------------------------------------------------------------|-------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|
| `PaymentCollection` | Top-level entity; owns `payment_sessions` and `payments`; holds aggregated state | **Chosen as the single aggregate root.**                                                                                                                                      |
| `Payment`           | Owns `captures` and `refunds`; marked for deprecation                            | Modeled as a **nested entity inside the PaymentCollection aggregate**. See `packages/modules/payment/src/models/payment.ts:7-8` — explicit TODO to merge into PaymentSession. |

**Rationale.** Mutations on `Payment` (`capturePayment`, `refundPayment`, `cancelPayment`) all call `maybeUpdatePaymentCollection_` at the end (`packages/modules/payment/src/services/payment-module.ts:735, :886, :1005-1100`) to recompute `authorized_amount`, `captured_amount`, `refunded_amount`, `status`, and `completed_at` on the parent collection. The collection's state is therefore not an independent consistency boundary — every mutation flows back through it. Modeling `Payment` as a sibling aggregate would require a saga to keep these in sync; modeling it inside the collection lets a single transaction maintain the invariant.

**Out of scope for this workflow** (separate aggregates / catalogs in the same module, modeled in their own workflows if needed):

- `RefundReason` — reference catalog (label/code/description), referenced from `Refund.refund_reason_id`.
- `PaymentProvider` — provider registry; only ID is referenced.
- `AccountHolder` — provider-side customer wallet abstraction; lifecycle independent of any collection.
- `PaymentMethod` — provider-managed; no local persistence.

---

## 2. Module Structure (Entities vs Value Objects vs External Refs)

All five modeled types in this aggregate have their own identity, their own lifecycle (independent add / update / delete), and are tracked individually in the data store. They are all **entities** — there are no genuine value objects inside the Payment aggregate in this codebase.

### 2.1 `PaymentCollection` — Aggregate Root

`packages/modules/payment/src/models/payment-collection.ts`

| Attribute           | Type                      | Required | Notes                                                                                                             |
|---------------------|---------------------------|----------|-------------------------------------------------------------------------------------------------------------------|
| `id`                | string (`pay_col_*`)      | yes      | Primary key.                                                                                                      |
| `currency_code`     | string (ISO 4217, 3-char) | yes      | Normalized to uppercase by `normalizeCurrencyCode`.                                                               |
| `amount`            | BigNumber                 | yes      | Total amount the collection is responsible for collecting.                                                        |
| `authorized_amount` | BigNumber \| null         | no       | **Computed**; sum over child sessions where `status = authorized`. Maintained by `maybeUpdatePaymentCollection_`. |
| `captured_amount`   | BigNumber \| null         | no       | **Computed**; sum over child captures.                                                                            |
| `refunded_amount`   | BigNumber \| null         | no       | **Computed**; sum over child refunds.                                                                             |
| `status`            | `PaymentCollectionStatus` | yes      | Default `not_paid`. State machine — see §6.                                                                       |
| `completed_at`      | datetime \| null          | no       | Set when `captured_amount >= amount` (within currency epsilon) or by `completePaymentCollections`.                |
| `metadata`          | JSON \| null              | no       | User-managed custom data.                                                                                         |
| `payment_sessions`  | `PaymentSession[]`        | no       | One-to-many child collection.                                                                                     |
| `payments`          | `Payment[]`               | no       | One-to-many child collection (created as a side effect of authorizing sessions).                                  |
| `payment_providers` | `PaymentProvider[]`       | no       | Many-to-many catalog reference (not modeled inside the aggregate).                                                |

Cascade: deleting a `PaymentCollection` cascades to its `payment_sessions` and `payments` (model definition lines 29-31).

### 2.2 `PaymentSession` — Nested entity

`packages/modules/payment/src/models/payment-session.ts`

| Attribute              | Type                    | Required | Notes                                                                       |
|------------------------|-------------------------|----------|-----------------------------------------------------------------------------|
| `id`                   | string (`payses_*`)     | yes      | Primary key.                                                                |
| `currency_code`        | string                  | yes      |                                                                             |
| `amount`               | BigNumber               | yes      | Amount the session is responsible for authorizing.                          |
| `provider_id`          | string                  | yes      | Reference to the external `PaymentProvider` ID (Stripe, Square, etc.).      |
| `status`               | `PaymentSessionStatus`  | yes      | Default `pending`. State machine — see §6.                                  |
| `data`                 | JSON                    | yes      | Default `{}`. Provider-managed session payload.                             |
| `context`              | JSON \| null            | no       | Provider context (e.g. customer details for the gateway).                   |
| `authorized_at`        | datetime \| null        | no       | Set when the provider returns `authorized` or `captured`.                   |
| `metadata`             | JSON \| null            | no       | User-managed custom data.                                                   |
| `payment_collection`   | `PaymentCollection`     | yes      | belongs-to.                                                                 |
| `payment`              | `Payment \| null`       | no       | has-one. Created as a side effect of `authorizePaymentSession`.             |

### 2.3 `Payment` — Nested entity

`packages/modules/payment/src/models/payment.ts`

| Attribute            | Type                | Required | Notes                                                       |
|----------------------|---------------------|----------|-------------------------------------------------------------|
| `id`                 | string (`pay_*`)    | yes      | Primary key.                                                |
| `amount`             | BigNumber           | yes      | Carried over from the source session at authorization.      |
| `currency_code`      | string              | yes      |                                                             |
| `provider_id`        | string              | yes      | Carried over from the source session.                       |
| `data`               | JSON \| null        | no       | Provider response payload.                                  |
| `metadata`           | JSON \| null        | no       | User-managed custom data.                                   |
| `captured_at`        | datetime \| null    | no       | Set when fully captured.                                    |
| `canceled_at`        | datetime \| null    | no       | Set when canceled.                                          |
| `payment_collection` | `PaymentCollection` | yes      | belongs-to.                                                 |
| `payment_session`    | `PaymentSession`    | yes      | belongs-to (one-to-one).                                    |
| `captures`           | `Capture[]`         | no       | one-to-many; cascades on delete.                            |
| `refunds`            | `Refund[]`          | no       | one-to-many; cascades on delete.                            |

### 2.4 `Capture` — Nested entity

`packages/modules/payment/src/models/capture.ts`

| Attribute    | Type              | Required | Notes                                             |
|--------------|-------------------|----------|---------------------------------------------------|
| `id`         | string (`capt_*`) | yes      | Primary key.                                      |
| `amount`     | BigNumber         | yes      | Captured amount; partial captures are allowed.    |
| `created_by` | string \| null    | no       | User or system identifier that performed capture. |
| `metadata`   | JSON \| null      | no       |                                                   |
| `payment`    | `Payment`         | yes      | belongs-to.                                       |

### 2.5 `Refund` — Nested entity

`packages/modules/payment/src/models/refund.ts`

| Attribute          | Type             | Required | Notes                                                              |
|--------------------|------------------|----------|--------------------------------------------------------------------|
| `id`               | string (`ref_*`) | yes      | Primary key.                                                       |
| `amount`           | BigNumber        | yes      | Refunded amount; partial refunds are allowed.                      |
| `note`             | string \| null   | no       |                                                                    |
| `created_by`       | string \| null   | no       | User or system identifier.                                         |
| `refund_reason_id` | string \| null   | no       | External reference to a `RefundReason` (different aggregate).      |
| `metadata`         | JSON \| null     | no       |                                                                    |
| `payment`          | `Payment`        | yes      | belongs-to.                                                        |

---

## 3. Commands

Ten commands operate on this aggregate. All are public methods on `PaymentModuleService` (`packages/modules/payment/src/services/payment-module.ts`), decorated with `@InjectManager()` and `@EmitEvents()`. Each command is invoked through the aggregate root (`PaymentCollection`) — either directly on it or on one of its nested entities.

The `upsertPaymentCollections` method is a convenience that delegates to create or update; it is intentionally **not** modeled as a separate command. The `updatePayment` method is included for completeness but is a near-noop today (no provider sync, only `id` in `UpdatePaymentDTO`).

### Lane assignment

| Lane       | Commands                                                                                                                         |
|------------|----------------------------------------------------------------------------------------------------------------------------------|
| Customer   | Create Payment Collection · Create Payment Session · Update Payment Session · Delete Payment Session · Authorize Payment Session |
| Merchant   | Update Payment Collection · Complete Payment Collection · Capture Payment · Refund Payment · Cancel Payment                      |
| Automation | *(none in scope — Payment Collection status / amount recompute is internal side effect, not a separate command)*                 |

### 3.1 Create Payment Collection — Customer

- Method: `createPaymentCollections(data, sharedContext)` — `payment-module.ts:193`
- DTO: `CreatePaymentCollectionDTO` (`packages/core/types/src/payment/mutations.ts:12`)
- Fields (mirror of aggregate root):
  - `currencyCode` — string, required
  - `amount` — number, required
  - `metadata` — object, optional
- Behavior: persists a new `PaymentCollection` with default `status = not_paid`.

### 3.2 Update Payment Collection — Merchant

- Method: `updatePaymentCollections(idOrSelector, data, sharedContext)` — `payment-module.ts:242`
- DTO: `PaymentCollectionUpdatableFields` (`mutations.ts:68`)
- Fields:
  - `id` — string, required
  - `currencyCode` — string, optional
  - `amount` — number, optional
  - `status` — enum, optional
  - `metadata` — object, optional
- Behavior: applies the patch and re-normalizes currency code. Does not recompute amounts.

### 3.3 Complete Payment Collection — Merchant

- Method: `completePaymentCollections(paymentCollectionId, sharedContext)` — `payment-module.ts:373`
- Fields:
  - `id` — string, required
- Behavior: stamps `completed_at = now()`. Note the inline TODO at `payment-module.ts:384` — "what checks should be done here? e.g. captured_amount === amount?" — meaning the invariant is currently advisory rather than enforced at this command. (The system also auto-completes via `maybeUpdatePaymentCollection_` when capture sum ≥ amount.)

### 3.4 Create Payment Session — Customer

- Method: `createPaymentSession(paymentCollectionId, input, sharedContext)` — `payment-module.ts:398`
- DTO: `CreatePaymentSessionDTO` (`mutations.ts:200`)
- Command structure (nested into Payment Collection):
  - `id` — string, required (the parent payment collection id)
  - `paymentSessions[]` — one-to-many → PaymentSession
    - `providerId` — string, required (external ref to `PaymentProvider`)
    - `currencyCode` — string, required
    - `amount` — number, required
    - `data` — object, required (provider session payload)
    - `context` — object, optional (provider context)
    - `metadata` — object, optional
- Behavior: creates the local `PaymentSession`, then calls `paymentProviderService_.createSession(...)` on the provider with an `idempotency_key = paymentSession.id`. If the provider call fails, the local session is rolled back.

### 3.5 Update Payment Session — Customer

- Method: `updatePaymentSession(data, sharedContext)` — `payment-module.ts:478`
- DTO: `UpdatePaymentSessionDTO` (`mutations.ts:235`)
- Command structure (nested into Payment Collection):
  - `paymentSessions[]` — one-to-many → PaymentSession
    - `id` — string, required
    - `data` — object, required
    - `currencyCode` — string, required
    - `amount` — number, required
    - `status` — enum, optional (allows webhook-driven overrides — see `payment-module.ts:505`)
    - `context` — object, optional
    - `metadata` — object, optional
- Behavior: calls `paymentProviderService_.updateSession(...)`, then persists the merged data and status.

### 3.6 Delete Payment Session — Customer

- Method: `deletePaymentSession(id, sharedContext)` — `payment-module.ts:516`
- Fields:
  - `paymentSessions[].id` — string, required (nested under the parent collection to mirror aggregate structure)
- Behavior: calls `paymentProviderService_.deleteSession(...)` then removes the session.

### 3.7 Authorize Payment Session — Customer

- Method: `authorizePaymentSession(id, context, sharedContext)` — `payment-module.ts:535`
- Fields:
  - `paymentSessions[]` — one-to-many → PaymentSession
    - `id` — string, required
    - `context` — object, required (provider context, e.g. customer info, return URLs)
- Behavior: **idempotent** — if the session already has both `authorized_at` and a linked `payment`, returns the existing payment unchanged (`payment-module.ts:559-561`). Otherwise calls `paymentProviderService_.authorizePayment(...)` with `idempotency_key = session.id`. On `authorized` or `captured` provider status, creates a new `Payment` (1:1 with the session). On `captured`, also creates a `Capture` immediately and sets `captured_at`. On any other status, persists the new status and throws `NOT_ALLOWED`.

### 3.8 Capture Payment — Merchant

- Method: `capturePayment(data, sharedContext)` — `payment-module.ts:685`
- DTO: `CreateCaptureDTO` (`mutations.ts:138`)
- Command structure (nested into Payment Collection):
  - `payments[]` — one-to-many → Payment
    - `id` — string, required (`payment_id`)
    - `captures[]` — one-to-many → Capture
      - `amount` — number, optional (defaults to full remaining authorized amount)
      - `createdBy` — string, optional (`captured_by`)
      - `isCaptured` — boolean, optional (signals auto-capture from a previous authorize)
- Behavior: validates `data.amount ≤ remainingToCapture` (`payment-module.ts:776-786`). Persists the `Capture`, then calls `paymentProviderService_.capturePayment(...)` with `idempotency_key = capture.id`. Sets `Payment.captured_at = now()` when fully captured. Idempotent if the payment is already fully captured (returns unchanged). Recomputes the parent collection's amounts and status.

### 3.9 Refund Payment — Merchant

- Method: `refundPayment(data, sharedContext)` — `payment-module.ts:857`
- DTO: `CreateRefundDTO` (`mutations.ts:164`)
- Command structure (nested into Payment Collection):
  - `payments[]` — one-to-many → Payment
    - `id` — string, required (`payment_id`)
    - `refunds[]` — one-to-many → Refund
      - `amount` — number, optional (defaults to full payment amount)
      - `refundReasonId` — string, optional (external ref to `RefundReason`)
      - `note` — string, optional
      - `createdBy` — string, optional
      - `metadata` — object, optional
- Behavior: validates `capturedAmount - totalRefundedAmount ≥ -currencyEpsilon` (`payment-module.ts:923-933`) — meaning refunds may not exceed captures, with tolerance for provider rounding. Persists the `Refund`, then calls `paymentProviderService_.refundPayment(...)` with `idempotency_key = refund.id`. Recomputes the parent collection's amounts and status.

### 3.10 Cancel Payment — Merchant

- Method: `cancelPayment(paymentId, sharedContext)` — `payment-module.ts:977`
- Command structure:
  - `payments[]` — one-to-many → Payment
    - `id` — string, required
- Behavior: calls `paymentProviderService_.cancelPayment(...)` with `idempotency_key = payment.id`, persists the provider response data, and stamps `canceled_at = now()`. No precondition guard in the source — any payment can be canceled (subsequent capture is then blocked at §6).

---

## 4. Domain Events (1:1 with commands)

Every command emits a single past-tense event in the same lane as the command's actor.

| #  | Command                     | Event                          | Lane      |
|----|-----------------------------|--------------------------------|-----------|
| 1  | Create Payment Collection   | Payment Collection Created     | Customer  |
| 2  | Update Payment Collection   | Payment Collection Updated     | Merchant  |
| 3  | Complete Payment Collection | Payment Collection Completed   | Merchant  |
| 4  | Create Payment Session      | Payment Session Created        | Customer  |
| 5  | Update Payment Session      | Payment Session Updated        | Customer  |
| 6  | Delete Payment Session      | Payment Session Deleted        | Customer  |
| 7  | Authorize Payment Session   | Payment Session Authorized     | Customer  |
| 8  | Capture Payment             | Payment Captured               | Merchant  |
| 9  | Refund Payment              | Payment Refunded               | Merchant  |
| 10 | Cancel Payment              | Payment Canceled               | Merchant  |

**Note on `Payment Session Authorized`.** This event has a domain side effect that is not its own separate event: it conditionally creates a `Payment` (and possibly a `Capture`). Modeled as one event because the side effect is internal to the aggregate's authorize transaction — the customer's intent is "authorize," not "create payment."

**Note on the internal status recompute.** `maybeUpdatePaymentCollection_` is invoked after capture / refund and updates the parent collection's status and amount totals. This is **not** modeled as a separate command/event — it's an internal projection that maintains the aggregate's invariant, similar to a database trigger.

### Suggested chronological flow

`start` → Payment Collection Created → Payment Session Created → Payment Session Updated *(optional)* → Payment Session Authorized → Payment Captured → Payment Refunded *(optional)* → Payment Collection Completed

Alternate branches: Payment Session Deleted (after Created), Payment Canceled (after Authorized), Payment Collection Updated (any time before complete).

---

## 5. Read Models / Queries

Six query surfaces are exposed by `PaymentModuleService`. They include both list/retrieve patterns; computed (projection-only) fields are flagged.

### 5.1 Get Payment Collection

- Method: `retrievePaymentCollection(id, config)` plus `listPaymentCollections` / `listAndCountPaymentCollections`
- Entity: `PaymentCollection`
- Filters: `id` (single / array)
- Returned fields: entity attributes + `authorized_amount`, `captured_amount`, `refunded_amount` (all computed via `maybeUpdatePaymentCollection_` and persisted, but conceptually projections); optional relations: `payment_sessions`, `payments`, `payment_providers`.

### 5.2 List Payment Sessions

- Methods: `retrievePaymentSession`, `listPaymentSessions`, `listAndCountPaymentSessions`
- Entity: `PaymentSession`
- Filters: `id`, `payment_collection_id`, `status`, `provider_id`

### 5.3 Get Payment

- Methods: `retrievePayment`, `listPayments`, `listAndCountPayments`
- Entity: `Payment`
- Filters: `id`, `payment_collection_id`, `provider_id`
- Returned fields (DTO-level computed):
  - `authorized_amount` — derived from `payment_session.amount`
  - `captured_amount` — sum of `captures[].amount`
  - `refunded_amount` — sum of `refunds[].amount`
- Optional relations: `captures`, `refunds`, `payment_session`, `payment_collection`

### 5.4 List Captures

- Methods: `listCaptures`, `listAndCountCaptures`
- Entity: `Capture`
- Filters: `payment_id`

### 5.5 List Refunds

- Methods: `listRefunds`, `listAndCountRefunds`
- Entity: `Refund`
- Filters: `payment_id`, `refund_reason_id`

### 5.6 List Payment Providers (catalog, supports Create Payment Session)

- Method: `listPaymentProviders`
- Entity: `PaymentProvider` (out-of-aggregate)
- Filters: `id`, `is_enabled`
- Used by Customer before issuing `Create Payment Session` to pick a `providerId`.

### Reuse strategy

`Get Payment Collection` is needed before nearly every command (the customer needs to look up the collection before creating sessions; the merchant needs it before capture/refund/cancel/complete). The same applies to `Get Payment` for capture/refund/cancel. Reuse these two read models across multiple events when wired into Qlerify.

---

## 6. Invariants & Business Rules

### 6.1 PaymentCollection state machine

Implemented in `maybeUpdatePaymentCollection_` (`payment-module.ts:1006-1100`):

```
[no sessions]         → not_paid
[sessions, none auth] → awaiting
[some auth, sum<amt]  → partially_authorized
[auth sum >= amount]  → authorized
[capture sum >= amt]  → completed       (also sets completed_at = now)
```

Statuses `partially_captured`, `canceled`, `failed` exist in the enum but are not currently set by `maybeUpdatePaymentCollection_` — they can only be set via `Update Payment Collection` (`status` field on `PaymentCollectionUpdatableFields`).

### 6.2 PaymentSession state machine

```
pending      → authorized | captured | error | canceled | requires_more
authorized   → captured (via authorize when provider returns captured) | canceled
```

Authorize is idempotent (§3.7). Status can also be overridden by the caller in `Update Payment Session` to support webhook flows (`payment-module.ts:505`).

### 6.3 Payment state machine (timestamp-driven)

```
authorized (default) → captured (captured_at set) → final
authorized           → canceled (canceled_at set) → final
```

Implicit; there is no `status` enum on `Payment` itself.

### 6.4 Amount invariants

- **Capture amount** must satisfy `newCaptureAmount ≤ remainingToCapture = authorizedAmount − sum(existingCaptures)`, rounded to currency precision (`payment-module.ts:776-786`). Otherwise: `INVALID_DATA` "You cannot capture more than the authorized amount substracted by what is already captured."
- **Refund amount** must satisfy `capturedAmount − totalRefundedAmount ≥ -currencyEpsilon` (`payment-module.ts:923-933`). The epsilon tolerance accommodates provider rounding (e.g. capturing 87.957975 USD and refunding 87.96 succeeds because the difference is below 0.01).
- Capturing a canceled payment throws `INVALID_DATA` "The payment: X has been canceled" (`payment-module.ts:752-757`).
- Capturing a fully-captured payment is a no-op return (`payment-module.ts:759-761`).
- Authorize requires the provider to return `authorized` or `captured`; any other status persists the new status on the session and throws `NOT_ALLOWED` (`payment-module.ts:571-587`).

### 6.5 Idempotency

Every provider call passes `idempotency_key` so retries are safe (`payment-module.ts:417, 567, 825, 962, 992`):

| Provider operation       | Idempotency key       |
|--------------------------|-----------------------|
| Create session           | `payment_session.id`  |
| Authorize payment        | `payment_session.id`  |
| Capture payment          | `capture.id`          |
| Refund payment           | `refund.id`           |
| Cancel payment           | `payment.id`          |

`authorizePaymentSession` is also idempotent at the module level (§3.7).

### 6.6 Cascades

- `PaymentCollection` → cascade-deletes `payment_sessions`, `payments`.
- `Payment` → cascade-deletes `captures`, `refunds`.

### 6.7 Required-field constraints

- `PaymentCollection`: `currency_code`, `amount`
- `PaymentSession`: `currency_code`, `amount`, `provider_id`, `payment_collection_id`, `data` (defaults to `{}`)
- `Payment`: `amount`, `currency_code`, `provider_id`, `payment_collection_id`, `payment_session_id`
- `Capture`: `amount`, `payment_id`
- `Refund`: `amount`, `payment_id`

---

## 7. Acceptance Criteria (Tests at the aggregate boundary)

From `packages/modules/payment/integration-tests/__tests__/services/payment-module/index.spec.ts`. Phrased as Given/When/Then so they can attach to their corresponding domain events later.

### Payment Collection Completed

- **Given** a `PaymentCollection` with amount 200 USD and one authorized `PaymentSession` whose `Payment` has been captured for the full 200, **When** `completePaymentCollections` is invoked, **Then** the collection's `status = completed`, `authorized_amount = 200`, `captured_amount = 200`, and `completed_at` is set. *(test lines 119-190)*
- **Given** a collection with amount `200.129` and a capture of `200.13`, **When** the provider rounds, **Then** the rounding tolerance applies and the collection still reaches `completed`. *(lines 192-263)*

### Payment Session Created

- **Given** `PaymentCollection` `pay-col-id-1`, **When** `createPaymentSession` is invoked with `providerId`, `amount`, and `currencyCode`, **Then** the collection's `payment_sessions[]` contains a new session with `status = pending`. *(lines 461-497)*

### Payment Session Authorized

- **Given** a collection of 200 USD with a session for 100 USD, **When** `authorizePaymentSession` is invoked and the provider returns `authorized`, **Then** a `Payment` of 100 is created, the session's `status = authorized`, and `authorized_at` is set. *(lines 602-651)*
- **Given** a provider that returns `captured` from `authorizePayment`, **When** the session is authorized, **Then** a `Capture` record is created, `payment.captured_at` is set, and `paymentProvider.capturePayment` is **not** called. *(lines 653-707)*

### Payment Captured

- **Given** a `Payment` with amount 100, **When** `capturePayment({ amount: 100 })` is invoked, **Then** a single `Capture` record is created and `payment.captured_at` is set. *(lines 735-755)*
- **Given** a `Payment` with amount 100, **When** the caller captures 50 twice, **Then** two `Capture` records are created (50, 50) and `captured_at` is set after the second. *(lines 757-785)*
- **Given** a `Payment` with amount 100, **When** the caller attempts to capture 200, **Then** an `INVALID_DATA` "cannot capture more than authorized" error is thrown. *(lines 787-798)*
- **Given** a fully captured `Payment`, **When** `capturePayment` is invoked again, **Then** the payment is returned unchanged (idempotent). *(lines 818-841)*
- **Given** a `Payment` with `canceled_at` set, **When** the caller attempts to capture, **Then** an `INVALID_DATA` "payment has been canceled" error is thrown. *(lines 843-856)*

### Payment Refunded

- **Given** a `Payment` with 100 captured, **When** `refundPayment({ amount: 100 })` is invoked, **Then** one `Refund` record is created on the payment. *(lines 922-945)*
- **Given** a `Payment` with 100 captured, **When** the caller refunds 50 twice, **Then** two `Refund` records are created (50, 50). *(lines 975-1019)*
- **Given** a `Payment` with 50 captured, **When** the caller attempts to refund 100, **Then** an `INVALID_DATA` "cannot refund more than captured" error is thrown. *(lines 1021-1037)*
- **Given** a `Payment` captured at 87.957975 USD, **When** the caller refunds 87.96 (difference 0.002 < epsilon 0.01), **Then** the refund succeeds. *(lines 1074-1098)*
- **Given** a `Payment` captured at 87.957975 USD, **When** the caller attempts to refund 87.98 (difference 0.02 > epsilon), **Then** an `INVALID_DATA` "cannot refund more than captured" error is thrown. *(lines 1100-1117)*

### Payment Canceled

- **Given** a `Payment` with no cancellation, **When** `cancelPayment` is invoked, **Then** `payment.canceled_at` is set to the current date. *(lines 1121-1130)*

---

## 8. External References

Fields that point outside the Payment aggregate. Model these as flat ID-only refs (Category 2 in command-field rules).

| Field                                             | On                                 | Refers to                                         | Notes                                                                               |
|---------------------------------------------------|------------------------------------|---------------------------------------------------|-------------------------------------------------------------------------------------|
| `provider_id`                                     | `PaymentSession`, `Payment`        | `PaymentProvider` (separate aggregate / registry) | The provider key, e.g. `pp_stripe`.                                                 |
| `refund_reason_id`                                | `Refund`                           | `RefundReason` (separate aggregate)               | Optional.                                                                           |
| *(joiner) `cart_id` / `order_id` / `customer_id`* | `PaymentCollection` (joiner only)  | Cart / Order / Customer modules                   | Not stored on the entity; resolved via `joiner-config.ts` at the module-link layer. |
| `context.customer.id`                             | passed into `createPaymentSession` | Customer                                          | Forwarded to the provider as part of `context`; never persisted on the aggregate.   |

The aggregate is therefore **decoupled from the cart/order flow** at the persistence layer — only the module-link layer joins them.

---

## 9. Bounded Context

**Suggested name:** `Payment Processing`

**Rationale:** owns the lifecycle of authorizing, capturing, and refunding money against an aggregate amount; integrates with external payment providers via the provider abstraction; does not own `Cart`, `Order`, or `Customer` (those are referenced only via the module-link joiner).

If splitting further later: `Payment Provider Catalog` (PaymentProvider, AccountHolder, PaymentMethod, RefundReason) could be a separate context with read-mostly traffic, but a single `Payment Processing` context is appropriate today.

---

## Appendix A — File reference index

- Models: `packages/modules/payment/src/models/{payment-collection,payment-session,payment,capture,refund,refund-reason,payment-provider,account-holder}.ts`
- Service: `packages/modules/payment/src/services/payment-module.ts` (lines 179–1331)
- Status enums: `packages/core/utils/src/payment/{payment-collection,payment-session}.ts`
- DTOs: `packages/core/types/src/payment/mutations.ts`
- Tests: `packages/modules/payment/integration-tests/__tests__/services/payment-module/index.spec.ts`
- Module-link joiner: `packages/modules/payment/src/joiner-config.ts`

## Appendix B — Notes for the Qlerify push step

Use this section as the input to the rest of the workflow-creation skill (Phase 1 onward):

1. **Phase 1** — create workflow `Payment Processing`.
2. **Phase 2** — create the 10 domain events (§4) in the order listed. Attach the Given/When/Then sentences from §7 as each event's `acceptanceCriteria`.
3. **Phase 3 Step 3** — create one bounded context `Payment Processing`.
4. **Phase 3 Step 4** — create entities `PaymentCollection` (root), `PaymentSession`, `Payment`, `Capture`, `Refund` — all entities (no value objects). Set `aggregateRootFor: [all 10 events]` on `PaymentCollection`.
5. **Phase 3 Step 5** — create the 10 commands, mirroring the nested structure in §3 (commands on `Capture` and `Refund` nest under `payments[]` which nests under the collection root).
6. **Phase 3 Step 6** — create read models from §5; reuse `Get Payment Collection` across multiple events.
7. **Phase 3 Step 7** — skip domain event schemas (Medusa is not Event Sourcing).
8. **Phase 3 Step 8** — populate entity fields per §2 with `exampleData` and `description` for each.
9. **Phase 4** — run `validate_domain_model`; then reconcile against the source files listed in Appendix A.
