# Cart Aggregate Service

Generated from the Qlerify domain model in **Skill Self Improvement / Cart Aggregate** (`cart-aggregate.md`).

Bounded context: **Cart Management**. Aggregate root: **Cart**.
17 commands, 17 domain events, 2 queries (`ListCarts`, `GetCart` with computed totals).
3 roles: **Customer**, **Automation**, **Admin**.

## Run

```bash
npm install         # already done by codegen
npm run dev         # both server (:3002) and client (:5174)

# or individually
npm run dev -w server
npm run dev -w client

npm test            # 36 vitest tests from GWTs
npm run typecheck   # tsc --noEmit on both packages
npm run build       # client build + server tsc emit
```

## Try it

Open <http://localhost:5174/> and switch the **Role** picker at the top right:

- **Customer** — shop the catalog, set addresses, pick a shipping method
- **Automation** — apply promotions (set-replacement adjustments), tax lines, and credit lines on any cart
- **Admin** — soft-delete and restore carts

Every command in the model maps to a primary action button somewhere in the view it belongs to.

## API surface (`/api/v1`)

| Method | Path | Role | Command |
|--------|------|------|---------|
| GET | `/carts` | Customer/Admin/Automation | listCarts |
| GET | `/carts/:id` | Customer/Admin/Automation | getCart |
| POST | `/carts` | Customer | **CreateCart** |
| PATCH | `/carts/:id` | Customer | **UpdateCart** |
| DELETE | `/carts/:id` | Admin | **DeleteCart** |
| POST | `/carts/:id/restore` | Admin | **RestoreCart** |
| PUT | `/carts/:id/shipping-address` | Customer | **SetShippingAddress** |
| PUT | `/carts/:id/billing-address` | Customer | **SetBillingAddress** |
| POST | `/carts/:id/line-items` | Customer | **AddLineItem** |
| PATCH | `/carts/:id/line-items` | Customer | **UpdateLineItem** |
| DELETE | `/carts/:id/line-items` | Customer | **RemoveLineItem** |
| POST | `/carts/:id/shipping-methods` | Customer | **AddShippingMethod** |
| DELETE | `/carts/:id/shipping-methods` | Customer | **RemoveShippingMethod** |
| PUT | `/carts/:id/line-item-adjustments` | Automation | **SetLineItemAdjustments** |
| PUT | `/carts/:id/shipping-method-adjustments` | Automation | **SetShippingMethodAdjustments** |
| PUT | `/carts/:id/line-item-tax-lines` | Automation | **SetLineItemTaxLines** |
| PUT | `/carts/:id/shipping-method-tax-lines` | Automation | **SetShippingMethodTaxLines** |
| POST | `/carts/:id/credit-lines` | Automation | **AddCreditLine** |
| DELETE | `/carts/:id/credit-lines` | Automation | **RemoveCreditLine** |

Role is read from the `X-Role` header (default: `Customer`, override with `DEFAULT_ROLE` env).
Swap `server/src/interface/auth.ts` for real auth (JWT / session) without touching handlers.

## Layout

```
.qlerify/
├── codegen.json         # stack + persistence decisions; anchor for delta-apply
└── workflow.json        # spec pointer (re-fetch with mcp__qlerify__get_workflow)
server/
├── src/
│   ├── domain/          # types, errors, ids, money, invariant guards
│   ├── application/     # 17 command handlers + 2 query handlers
│   ├── infrastructure/  # SQLite schema, repository, serialization
│   ├── events/          # in-process bus
│   └── interface/       # Express routes + role-based auth
└── test/
    └── cart.test.ts     # 36 tests derived from event GWTs
client/
└── src/
    ├── pages/           # Shop, CartList, CartDetail, AdminInbox, AutomationInbox
    ├── components/      # Layout, Modal, AddressForm, Money
    └── context/         # RoleContext, Toast
```

## Persistence

All decisions are in `.qlerify/codegen.json` under `persistenceDecisions`. Highlights:

- Cart aggregate stored as one row in `cart`; optimistic concurrency via `version`.
- Address VOs embedded inline as JSON columns.
- LineItem / ShippingMethod / CreditLine in separate tables with FK + CASCADE.
- Adjustment / TaxLine VOs in separate tables — IDs are exposed at the system boundary because the Set-replacement commands need id-based upsert (update if id matches, create if no id, soft-delete if omitted).
- Monetary values stored as decimal strings; arithmetic via `big.js`.
- Totals (`item_total`, `discount_total`, `tax_total`, `total`, etc.) are computed on read and never persisted.
