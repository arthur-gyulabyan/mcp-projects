import {
  assertLineItemAdjustment,
  assertLineItemTaxLine,
  assertShippingMethodAdjustment,
  assertShippingMethodTaxLine,
} from "../../domain/cart/invariants.js";
import { InvalidDataError } from "../../domain/errors.js";
import {
  lineItemAdjustmentId,
  lineItemTaxLineId,
  shippingMethodAdjustmentId,
  shippingMethodTaxLineId,
} from "../../domain/ids.js";
import { toMoney } from "../../domain/money.js";
import type {
  Cart,
  LineItemAdjustment,
  LineItemTaxLine,
  ShippingMethodAdjustment,
  ShippingMethodTaxLine,
} from "../../domain/types.js";
import { publish } from "../../events/bus.js";
import {
  CartRepository,
  toBool,
  toJson,
} from "../../infrastructure/cart-repository.js";

export interface LineItemSet<T> {
  id: string;
  adjustments?: T[];
  taxLines?: T[];
}

export function setLineItemAdjustments(
  repo: CartRepository,
  cartId: string,
  items: Array<{ id: string; adjustments: LineItemAdjustment[] }>,
): Cart {
  if (!cartId) throw new InvalidDataError(`Field "id" is required`, "id");
  const cart = repo.loadCart(cartId);
  const now = new Date().toISOString();

  for (const block of items) {
    if (!block.id) throw new InvalidDataError(`items[].id is required`, "items.id");
    if (!repo.lineItemBelongsToCart(block.id, cartId)) {
      throw new InvalidDataError(
        `Line item "${block.id}" does not belong to cart "${cartId}"`,
        "items.id",
      );
    }
    for (const adj of block.adjustments ?? []) {
      assertLineItemAdjustment(adj);
    }
  }

  repo.withTransaction(() => {
    for (const block of items) {
      const adjustments = block.adjustments ?? [];
      const inputIds = new Set(adjustments.filter((a) => a.id).map((a) => a.id!));

      // Soft-delete adjustments not in the input list
      repo.raw
        .prepare(
          `UPDATE line_item_adjustment SET deleted_at = ?, updated_at = ? WHERE line_item_id = ? AND deleted_at IS NULL` +
            (inputIds.size > 0
              ? ` AND id NOT IN (${Array.from(inputIds).map(() => "?").join(",")})`
              : ``),
        )
        .run(now, now, block.id, ...Array.from(inputIds));

      for (const adj of adjustments) {
        if (adj.id) {
          // update in place
          repo.raw
            .prepare(
              `UPDATE line_item_adjustment SET amount = ?, code = ?, description = ?, promotion_id = ?, provider_id = ?, is_tax_inclusive = ?, metadata = ?, updated_at = ?, deleted_at = NULL WHERE id = ?`,
            )
            .run(
              toMoney(adj.amount),
              adj.code ?? null,
              adj.description ?? null,
              adj.promotionId ?? null,
              adj.providerId ?? null,
              toBool(adj.isTaxInclusive ?? false),
              toJson(adj.metadata ?? null),
              now,
              adj.id,
            );
        } else {
          repo.raw
            .prepare(
              `INSERT INTO line_item_adjustment (id, line_item_id, amount, code, description, promotion_id, provider_id, is_tax_inclusive, metadata, created_at, updated_at, deleted_at)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL)`,
            )
            .run(
              lineItemAdjustmentId(),
              block.id,
              toMoney(adj.amount),
              adj.code ?? null,
              adj.description ?? null,
              adj.promotionId ?? null,
              adj.providerId ?? null,
              toBool(adj.isTaxInclusive ?? false),
              toJson(adj.metadata ?? null),
              now,
              now,
            );
        }
      }
    }
    repo.bumpVersion(cartId, cart.version, now);
  });

  const updated = repo.loadCart(cartId);
  publish({
    name: "LineItemAdjustmentsSet",
    cartId,
    payload: { items: updated.items, cart: updated },
    occurredAt: now,
  });
  return updated;
}

export function setShippingMethodAdjustments(
  repo: CartRepository,
  cartId: string,
  methods: Array<{ id: string; adjustments: ShippingMethodAdjustment[] }>,
): Cart {
  if (!cartId) throw new InvalidDataError(`Field "id" is required`, "id");
  const cart = repo.loadCart(cartId);
  const now = new Date().toISOString();

  for (const block of methods) {
    if (!block.id) throw new InvalidDataError(`shippingMethods[].id is required`, "shippingMethods.id");
    if (!repo.shippingMethodBelongsToCart(block.id, cartId)) {
      throw new InvalidDataError(
        `Shipping method "${block.id}" does not belong to cart "${cartId}"`,
        "shippingMethods.id",
      );
    }
    for (const adj of block.adjustments ?? []) {
      assertShippingMethodAdjustment(adj);
    }
  }

  repo.withTransaction(() => {
    for (const block of methods) {
      const adjustments = block.adjustments ?? [];
      const inputIds = new Set(adjustments.filter((a) => a.id).map((a) => a.id!));
      repo.raw
        .prepare(
          `UPDATE shipping_method_adjustment SET deleted_at = ?, updated_at = ? WHERE shipping_method_id = ? AND deleted_at IS NULL` +
            (inputIds.size > 0
              ? ` AND id NOT IN (${Array.from(inputIds).map(() => "?").join(",")})`
              : ``),
        )
        .run(now, now, block.id, ...Array.from(inputIds));
      for (const adj of adjustments) {
        if (adj.id) {
          repo.raw
            .prepare(
              `UPDATE shipping_method_adjustment SET amount = ?, code = ?, description = ?, promotion_id = ?, provider_id = ?, metadata = ?, updated_at = ?, deleted_at = NULL WHERE id = ?`,
            )
            .run(
              toMoney(adj.amount),
              adj.code ?? null,
              adj.description ?? null,
              adj.promotionId ?? null,
              adj.providerId ?? null,
              toJson(adj.metadata ?? null),
              now,
              adj.id,
            );
        } else {
          repo.raw
            .prepare(
              `INSERT INTO shipping_method_adjustment (id, shipping_method_id, amount, code, description, promotion_id, provider_id, metadata, created_at, updated_at, deleted_at)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL)`,
            )
            .run(
              shippingMethodAdjustmentId(),
              block.id,
              toMoney(adj.amount),
              adj.code ?? null,
              adj.description ?? null,
              adj.promotionId ?? null,
              adj.providerId ?? null,
              toJson(adj.metadata ?? null),
              now,
              now,
            );
        }
      }
    }
    repo.bumpVersion(cartId, cart.version, now);
  });

  const updated = repo.loadCart(cartId);
  publish({
    name: "ShippingMethodAdjustmentsSet",
    cartId,
    payload: { shippingMethods: updated.shippingMethods, cart: updated },
    occurredAt: now,
  });
  return updated;
}

export function setLineItemTaxLines(
  repo: CartRepository,
  cartId: string,
  items: Array<{ id: string; taxLines: LineItemTaxLine[] }>,
): Cart {
  if (!cartId) throw new InvalidDataError(`Field "id" is required`, "id");
  const cart = repo.loadCart(cartId);
  const now = new Date().toISOString();

  for (const block of items) {
    if (!block.id) throw new InvalidDataError(`items[].id is required`, "items.id");
    if (!repo.lineItemBelongsToCart(block.id, cartId)) {
      throw new InvalidDataError(
        `Line item "${block.id}" does not belong to cart "${cartId}"`,
        "items.id",
      );
    }
    for (const tl of block.taxLines ?? []) {
      assertLineItemTaxLine(tl);
    }
  }

  repo.withTransaction(() => {
    for (const block of items) {
      const taxLines = block.taxLines ?? [];
      const inputIds = new Set(taxLines.filter((t) => t.id).map((t) => t.id!));
      repo.raw
        .prepare(
          `UPDATE line_item_tax_line SET deleted_at = ?, updated_at = ? WHERE line_item_id = ? AND deleted_at IS NULL` +
            (inputIds.size > 0
              ? ` AND id NOT IN (${Array.from(inputIds).map(() => "?").join(",")})`
              : ``),
        )
        .run(now, now, block.id, ...Array.from(inputIds));
      for (const tl of taxLines) {
        if (tl.id) {
          repo.raw
            .prepare(
              `UPDATE line_item_tax_line SET code = ?, rate = ?, description = ?, provider_id = ?, tax_rate_id = ?, metadata = ?, updated_at = ?, deleted_at = NULL WHERE id = ?`,
            )
            .run(
              tl.code,
              String(tl.rate),
              tl.description ?? null,
              tl.providerId ?? null,
              tl.taxRateId ?? null,
              toJson(tl.metadata ?? null),
              now,
              tl.id,
            );
        } else {
          repo.raw
            .prepare(
              `INSERT INTO line_item_tax_line (id, line_item_id, code, rate, description, provider_id, tax_rate_id, metadata, created_at, updated_at, deleted_at)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL)`,
            )
            .run(
              lineItemTaxLineId(),
              block.id,
              tl.code,
              String(tl.rate),
              tl.description ?? null,
              tl.providerId ?? null,
              tl.taxRateId ?? null,
              toJson(tl.metadata ?? null),
              now,
              now,
            );
        }
      }
    }
    repo.bumpVersion(cartId, cart.version, now);
  });

  const updated = repo.loadCart(cartId);
  publish({
    name: "LineItemTaxLinesSet",
    cartId,
    payload: { items: updated.items, cart: updated },
    occurredAt: now,
  });
  return updated;
}

export function setShippingMethodTaxLines(
  repo: CartRepository,
  cartId: string,
  methods: Array<{ id: string; taxLines: ShippingMethodTaxLine[] }>,
): Cart {
  if (!cartId) throw new InvalidDataError(`Field "id" is required`, "id");
  const cart = repo.loadCart(cartId);
  const now = new Date().toISOString();

  for (const block of methods) {
    if (!block.id) throw new InvalidDataError(`shippingMethods[].id is required`, "shippingMethods.id");
    if (!repo.shippingMethodBelongsToCart(block.id, cartId)) {
      throw new InvalidDataError(
        `Shipping method "${block.id}" does not belong to cart "${cartId}"`,
        "shippingMethods.id",
      );
    }
    for (const tl of block.taxLines ?? []) {
      assertShippingMethodTaxLine(tl);
    }
  }

  repo.withTransaction(() => {
    for (const block of methods) {
      const taxLines = block.taxLines ?? [];
      const inputIds = new Set(taxLines.filter((t) => t.id).map((t) => t.id!));
      repo.raw
        .prepare(
          `UPDATE shipping_method_tax_line SET deleted_at = ?, updated_at = ? WHERE shipping_method_id = ? AND deleted_at IS NULL` +
            (inputIds.size > 0
              ? ` AND id NOT IN (${Array.from(inputIds).map(() => "?").join(",")})`
              : ``),
        )
        .run(now, now, block.id, ...Array.from(inputIds));
      for (const tl of taxLines) {
        if (tl.id) {
          repo.raw
            .prepare(
              `UPDATE shipping_method_tax_line SET code = ?, rate = ?, description = ?, provider_id = ?, tax_rate_id = ?, metadata = ?, updated_at = ?, deleted_at = NULL WHERE id = ?`,
            )
            .run(
              tl.code,
              String(tl.rate),
              tl.description ?? null,
              tl.providerId ?? null,
              tl.taxRateId ?? null,
              toJson(tl.metadata ?? null),
              now,
              tl.id,
            );
        } else {
          repo.raw
            .prepare(
              `INSERT INTO shipping_method_tax_line (id, shipping_method_id, code, rate, description, provider_id, tax_rate_id, metadata, created_at, updated_at, deleted_at)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL)`,
            )
            .run(
              shippingMethodTaxLineId(),
              block.id,
              tl.code,
              String(tl.rate),
              tl.description ?? null,
              tl.providerId ?? null,
              tl.taxRateId ?? null,
              toJson(tl.metadata ?? null),
              now,
              now,
            );
        }
      }
    }
    repo.bumpVersion(cartId, cart.version, now);
  });

  const updated = repo.loadCart(cartId);
  publish({
    name: "ShippingMethodTaxLinesSet",
    cartId,
    payload: { shippingMethods: updated.shippingMethods, cart: updated },
    occurredAt: now,
  });
  return updated;
}
