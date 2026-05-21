import { assertCreditLine } from "../../domain/cart/invariants.js";
import { InvalidDataError } from "../../domain/errors.js";
import { creditLineId } from "../../domain/ids.js";
import { toMoney } from "../../domain/money.js";
import type { Cart, CreditLine } from "../../domain/types.js";
import { publish } from "../../events/bus.js";
import {
  CartRepository,
  toJson,
} from "../../infrastructure/cart-repository.js";

export function addCreditLine(
  repo: CartRepository,
  cartId: string,
  creditLines: Array<Partial<CreditLine>>,
): Cart {
  if (!cartId) throw new InvalidDataError(`Field "id" is required`, "id");
  if (!Array.isArray(creditLines) || creditLines.length === 0) {
    throw new InvalidDataError(`creditLines must be a non-empty array`, "creditLines");
  }
  for (const cl of creditLines) assertCreditLine(cl);
  const cart = repo.loadCart(cartId);
  const now = new Date().toISOString();
  repo.withTransaction(() => {
    for (const cl of creditLines) {
      repo.raw
        .prepare(
          `INSERT INTO credit_line (id, cart_id, amount, reference, reference_id, metadata, created_at, updated_at, deleted_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, NULL)`,
        )
        .run(
          creditLineId(),
          cartId,
          toMoney(cl.amount),
          cl.reference ?? null,
          cl.referenceId ?? null,
          toJson(cl.metadata ?? null),
          now,
          now,
        );
    }
    repo.bumpVersion(cartId, cart.version, now);
  });
  const updated = repo.loadCart(cartId);
  publish({
    name: "CreditLineAdded",
    cartId,
    payload: { creditLines: updated.creditLines, cart: updated },
    occurredAt: now,
  });
  return updated;
}

export function removeCreditLine(
  repo: CartRepository,
  cartId: string,
  creditLines: Array<{ id: string }>,
): Cart {
  if (!cartId) throw new InvalidDataError(`Field "id" is required`, "id");
  if (!Array.isArray(creditLines) || creditLines.length === 0) {
    throw new InvalidDataError(`creditLines must be a non-empty array`, "creditLines");
  }
  const cart = repo.loadCart(cartId);
  const now = new Date().toISOString();
  repo.withTransaction(() => {
    for (const { id } of creditLines) {
      if (!id) throw new InvalidDataError(`creditLines[].id is required`, "creditLines.id");
      const belongs = repo.raw
        .prepare<[string, string]>(
          `SELECT 1 AS x FROM credit_line WHERE id = ? AND cart_id = ? AND deleted_at IS NULL`,
        )
        .get(id, cartId);
      if (!belongs) {
        throw new InvalidDataError(
          `Credit line "${id}" does not belong to cart "${cartId}"`,
          "creditLines.id",
        );
      }
      repo.raw
        .prepare(`UPDATE credit_line SET deleted_at = ?, updated_at = ? WHERE id = ?`)
        .run(now, now, id);
    }
    repo.bumpVersion(cartId, cart.version, now);
  });
  const updated = repo.loadCart(cartId);
  publish({
    name: "CreditLineRemoved",
    cartId,
    payload: { ids: creditLines.map((c) => c.id), cart: updated },
    occurredAt: now,
  });
  return updated;
}
