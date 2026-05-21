import { normalizeAddress } from "../../domain/cart/invariants.js";
import { InvalidDataError } from "../../domain/errors.js";
import type { Address, Cart } from "../../domain/types.js";
import { publish } from "../../events/bus.js";
import { CartRepository, toJson } from "../../infrastructure/cart-repository.js";

export function setShippingAddress(
  repo: CartRepository,
  cartId: string,
  address: Partial<Address> | null,
): Cart {
  if (!cartId) throw new InvalidDataError(`Field "id" is required`, "id");
  const existing = repo.loadCart(cartId);
  const normalized = normalizeAddress(address);
  const now = new Date().toISOString();
  repo.withTransaction(() => {
    repo.raw
      .prepare(`UPDATE cart SET shipping_address = ? WHERE id = ?`)
      .run(toJson(normalized as never), cartId);
    repo.bumpVersion(cartId, existing.version, now);
  });
  const updated = repo.loadCart(cartId);
  publish({
    name: "ShippingAddressSet",
    cartId,
    payload: { shippingAddress: updated.shippingAddress, cart: updated },
    occurredAt: now,
  });
  return updated;
}

export function setBillingAddress(
  repo: CartRepository,
  cartId: string,
  address: Partial<Address> | null,
): Cart {
  if (!cartId) throw new InvalidDataError(`Field "id" is required`, "id");
  const existing = repo.loadCart(cartId);
  const normalized = normalizeAddress(address);
  const now = new Date().toISOString();
  repo.withTransaction(() => {
    repo.raw
      .prepare(`UPDATE cart SET billing_address = ? WHERE id = ?`)
      .run(toJson(normalized as never), cartId);
    repo.bumpVersion(cartId, existing.version, now);
  });
  const updated = repo.loadCart(cartId);
  publish({
    name: "BillingAddressSet",
    cartId,
    payload: { billingAddress: updated.billingAddress, cart: updated },
    occurredAt: now,
  });
  return updated;
}
