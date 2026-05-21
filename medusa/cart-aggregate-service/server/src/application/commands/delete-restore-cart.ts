import { InvalidDataError, NotFoundError } from "../../domain/errors.js";
import { publish } from "../../events/bus.js";
import { CartRepository } from "../../infrastructure/cart-repository.js";

export function deleteCart(repo: CartRepository, id: string): { id: string } {
  if (!id) throw new InvalidDataError(`Field "id" is required`, "id");
  if (!repo.cartExistsAny(id)) {
    throw new NotFoundError(`Cart "${id}" was not found`);
  }
  const now = new Date().toISOString();
  repo.withTransaction(() => {
    repo.raw
      .prepare(`UPDATE cart SET deleted_at = ?, updated_at = ? WHERE id = ?`)
      .run(now, now, id);
  });
  publish({
    name: "CartDeleted",
    cartId: id,
    payload: { id },
    occurredAt: now,
  });
  return { id };
}

export function restoreCart(repo: CartRepository, id: string): { id: string } {
  if (!id) throw new InvalidDataError(`Field "id" is required`, "id");
  if (!repo.cartExistsAny(id)) {
    throw new NotFoundError(`Cart "${id}" was not found`);
  }
  const now = new Date().toISOString();
  repo.withTransaction(() => {
    repo.raw
      .prepare(`UPDATE cart SET deleted_at = NULL, updated_at = ? WHERE id = ?`)
      .run(now, id);
  });
  publish({
    name: "CartRestored",
    cartId: id,
    payload: { id },
    occurredAt: now,
  });
  return { id };
}
