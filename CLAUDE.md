# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Repository Purpose

This repo is for experimenting and testing the Qlerify MCP capabilities. Each subfolder is a standalone microservice project built from a Qlerify domain model (workflow.json) and OpenAPI spec. The Qlerify plugin (`mcp-companion@qlerify-plugins`) is enabled for domain-driven workflow creation and code generation.

## Git Configuration

- Uses local git config (not global): `--local` flag required
- SSH remote uses host alias `github.com-arthur-gyulabyan` with `id_personal` key
- Remote: `git@github.com-arthur-gyulabyan:arthur-gyulabyan/mcp-projects.git`

## Shopping Cart Project (`shopping-cart/`)

### Commands

```bash
# Install dependencies (from shopping-cart/)
npm install

# Run both server and client
npm run dev

# Run individually
npm run dev -w server    # Express API on :3001
npm run dev -w client    # Vite React on :5173

# Build
npm run build

# TypeScript check
npx tsc -p server/tsconfig.json --noEmit
npx tsc -p client/tsconfig.json --noEmit

# Seed coupons manually
npm run seed -w server
```

### Architecture

**Backend** (`server/`) — Express + TypeScript + SQLite (better-sqlite3), DDD layered:

- **Domain** (`src/domain/`): Pure entities (`Cart` aggregate root, `CartItem`), value objects (`Coupon`, `CartStatus`), repository interfaces, service interfaces. No framework dependencies. `Cart` enforces status state machine: `active → checking_out → checked_out → handed_off`. The `Cart.create()` factory is for new carts; `Cart.reconstitute()` hydrates from DB without re-validation.
- **Application** (`src/application/`): Command handlers (12) and query handlers (3), each in their own file. DTOs and mappers in `dtos/`. Custom error classes (`NotFoundError`, `BadRequestError`) in `errors.ts`.
- **Infrastructure** (`src/infrastructure/`): SQLite repositories using prepared statements and transactions. `StubProductService` (6 hardcoded products) and `StubInventoryService` (always in-stock) implement domain service interfaces — swap these for real HTTP services via `container.ts`.
- **Interface** (`src/interface/`): Express routes matching the OpenAPI spec at `/api/v1/*`. `container.ts` wires all dependencies (poor-man's DI). Auto-seeds coupon data on startup.

All repository methods are **synchronous** (better-sqlite3's sync API). No async/await in domain or application layers.

**Frontend** (`client/`) — React 19 + Vite + TypeScript:

- `CartContext` (useReducer) manages global cart state; `useCart` hook for access
- Vite proxies `/api` → `http://localhost:3001`
- After every mutation, re-fetches full cart from server for consistency
- Auto-creates a cart for `guest-user` on first load

### Domain Model Reference

Workflow spec: `docs/workflow.json` — Qlerify domain model with events, commands, entities, queries
OpenAPI spec: `docs/openapi.yaml` — generated API contract

### Downloading Qlerify Data

When saving Qlerify data to files, use `curl + jq` (via the `/download` skill) instead of MCP tools. MCP responses pass through AI context which is slow for large data. Credentials are in `~/.claude.json` under the project's MCP server config.
