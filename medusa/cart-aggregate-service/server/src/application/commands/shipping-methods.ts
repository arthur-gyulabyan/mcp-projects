import { assertShippingMethod } from "../../domain/cart/invariants.js";
import { InvalidDataError } from "../../domain/errors.js";
import { shippingMethodId } from "../../domain/ids.js";
import { toMoney } from "../../domain/money.js";
import type { Cart, ShippingMethod } from "../../domain/types.js";
import { publish } from "../../events/bus.js";
import {
  CartRepository,
  toBool,
  toJson,
} from "../../infrastructure/cart-repository.js";

export function addShippingMethod(
  repo: CartRepository,
  cartId: string,
  methods: Array<Partial<ShippingMethod>>,
): Cart {
  if (!cartId) throw new InvalidDataError(`Field "id" is required`, "id");
  if (!Array.isArray(methods) || methods.length === 0) {
    throw new InvalidDataError(`shippingMethods must be a non-empty array`, "shippingMethods");
  }
  for (const m of methods) assertShippingMethod(m);
  const cart = repo.loadCart(cartId);
  const now = new Date().toISOString();
  const stmt = repo.raw.prepare(`
    INSERT INTO shipping_method (
      id, cart_id, name, amount, description, shipping_option_id, data,
      is_tax_inclusive, metadata, created_at, updated_at, deleted_at
    ) VALUES (@id, @cart_id, @name, @amount, @description, @shipping_option_id, @data,
      @is_tax_inclusive, @metadata, @created_at, @updated_at, NULL)
  `);
  repo.withTransaction(() => {
    for (const m of methods) {
      stmt.run({
        id: shippingMethodId(),
        cart_id: cartId,
        name: m.name!,
        amount: toMoney(m.amount),
        description: toJson(m.description ?? null),
        shipping_option_id: m.shippingOptionId ?? null,
        data: toJson(m.data ?? null),
        is_tax_inclusive: toBool(m.isTaxInclusive ?? false),
        metadata: toJson(m.metadata ?? null),
        created_at: now,
        updated_at: now,
      });
    }
    repo.bumpVersion(cartId, cart.version, now);
  });
  const updated = repo.loadCart(cartId);
  publish({
    name: "ShippingMethodAdded",
    cartId,
    payload: { shippingMethods: updated.shippingMethods, cart: updated },
    occurredAt: now,
  });
  return updated;
}

export function removeShippingMethod(
  repo: CartRepository,
  cartId: string,
  methods: Array<{ id: string }>,
): Cart {
  if (!cartId) throw new InvalidDataError(`Field "id" is required`, "id");
  if (!Array.isArray(methods) || methods.length === 0) {
    throw new InvalidDataError(`shippingMethods must be a non-empty array`, "shippingMethods");
  }
  const cart = repo.loadCart(cartId);
  const now = new Date().toISOString();
  repo.withTransaction(() => {
    for (const { id } of methods) {
      if (!id) throw new InvalidDataError(`shippingMethods[].id is required`, "shippingMethods.id");
      if (!repo.shippingMethodBelongsToCart(id, cartId)) {
        throw new InvalidDataError(
          `Shipping method "${id}" does not belong to cart "${cartId}"`,
          "shippingMethods.id",
        );
      }
      repo.raw
        .prepare(`UPDATE shipping_method SET deleted_at = ?, updated_at = ? WHERE id = ?`)
        .run(now, now, id);
    }
    repo.bumpVersion(cartId, cart.version, now);
  });
  const updated = repo.loadCart(cartId);
  publish({
    name: "ShippingMethodRemoved",
    cartId,
    payload: { ids: methods.map((m) => m.id), cart: updated },
    occurredAt: now,
  });
  return updated;
}
