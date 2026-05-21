import {
  assertLineItem,
} from "../../domain/cart/invariants.js";
import { InvalidDataError } from "../../domain/errors.js";
import { lineItemId } from "../../domain/ids.js";
import { toMoney } from "../../domain/money.js";
import type { Cart, LineItem } from "../../domain/types.js";
import { publish } from "../../events/bus.js";
import {
  CartRepository,
  toBool,
  toJson,
} from "../../infrastructure/cart-repository.js";

export function addLineItem(
  repo: CartRepository,
  cartId: string,
  items: Array<Partial<LineItem>>,
): Cart {
  if (!cartId) throw new InvalidDataError(`Field "id" is required`, "id");
  if (!Array.isArray(items) || items.length === 0) {
    throw new InvalidDataError(
      `Field "items" must be a non-empty array`,
      "items",
    );
  }
  for (const item of items) assertLineItem(item);
  const cart = repo.loadCart(cartId);
  const now = new Date().toISOString();
  const stmt = repo.raw.prepare(`
    INSERT INTO line_item (
      id, cart_id, title, quantity, unit_price, subtitle, thumbnail,
      variant_id, product_id, product_title, product_description, product_subtitle,
      product_type, product_type_id, product_collection, product_handle,
      variant_sku, variant_barcode, variant_title, variant_option_values,
      requires_shipping, is_discountable, is_giftcard, is_tax_inclusive,
      is_custom_price, compare_at_unit_price, metadata,
      created_at, updated_at, deleted_at
    ) VALUES (@id, @cart_id, @title, @quantity, @unit_price, @subtitle, @thumbnail,
      @variant_id, @product_id, @product_title, @product_description, @product_subtitle,
      @product_type, @product_type_id, @product_collection, @product_handle,
      @variant_sku, @variant_barcode, @variant_title, @variant_option_values,
      @requires_shipping, @is_discountable, @is_giftcard, @is_tax_inclusive,
      @is_custom_price, @compare_at_unit_price, @metadata,
      @created_at, @updated_at, NULL)
  `);
  repo.withTransaction(() => {
    for (const item of items) {
      stmt.run({
        id: lineItemId(),
        cart_id: cartId,
        title: item.title!,
        quantity: item.quantity!,
        unit_price: toMoney(item.unitPrice),
        subtitle: item.subtitle ?? null,
        thumbnail: item.thumbnail ?? null,
        variant_id: item.variantId ?? null,
        product_id: item.productId ?? null,
        product_title: item.productTitle ?? null,
        product_description: item.productDescription ?? null,
        product_subtitle: item.productSubtitle ?? null,
        product_type: item.productType ?? null,
        product_type_id: item.productTypeId ?? null,
        product_collection: item.productCollection ?? null,
        product_handle: item.productHandle ?? null,
        variant_sku: item.variantSku ?? null,
        variant_barcode: item.variantBarcode ?? null,
        variant_title: item.variantTitle ?? null,
        variant_option_values: toJson(item.variantOptionValues ?? null),
        requires_shipping: toBool(item.requiresShipping ?? true),
        is_discountable: toBool(item.isDiscountable ?? true),
        is_giftcard: toBool(item.isGiftcard ?? false),
        is_tax_inclusive: toBool(item.isTaxInclusive ?? false),
        is_custom_price: toBool(item.isCustomPrice ?? false),
        compare_at_unit_price:
          item.compareAtUnitPrice == null ? null : toMoney(item.compareAtUnitPrice),
        metadata: toJson(item.metadata ?? null),
        created_at: now,
        updated_at: now,
      });
    }
    repo.bumpVersion(cartId, cart.version, now);
  });
  const updated = repo.loadCart(cartId);
  publish({
    name: "LineItemAdded",
    cartId,
    payload: { items: updated.items, cart: updated },
    occurredAt: now,
  });
  return updated;
}

export interface UpdateLineItemPatch {
  id: string;
  title?: string;
  quantity?: number;
  unitPrice?: string | number;
  metadata?: Record<string, unknown> | null;
}

export function updateLineItem(
  repo: CartRepository,
  cartId: string,
  items: UpdateLineItemPatch[],
): Cart {
  if (!cartId) throw new InvalidDataError(`Field "id" is required`, "id");
  if (!Array.isArray(items) || items.length === 0) {
    throw new InvalidDataError(`items must be a non-empty array`, "items");
  }
  const cart = repo.loadCart(cartId);
  const now = new Date().toISOString();
  repo.withTransaction(() => {
    for (const patch of items) {
      if (!patch.id) throw new InvalidDataError(`items[].id is required`, "items.id");
      if (!repo.lineItemBelongsToCart(patch.id, cartId)) {
        throw new InvalidDataError(
          `Line item "${patch.id}" does not belong to cart "${cartId}"`,
          "items.id",
        );
      }
      if (
        patch.quantity !== undefined &&
        (typeof patch.quantity !== "number" ||
          !Number.isFinite(patch.quantity) ||
          patch.quantity <= 0)
      ) {
        throw new InvalidDataError(
          "quantity must be a positive number",
          "items.quantity",
        );
      }
      const sets: string[] = [];
      const params: Record<string, unknown> = { id: patch.id };
      if (patch.title !== undefined) {
        sets.push(`title = @title`);
        params.title = patch.title;
      }
      if (patch.quantity !== undefined) {
        sets.push(`quantity = @quantity`);
        params.quantity = patch.quantity;
      }
      if (patch.unitPrice !== undefined) {
        sets.push(`unit_price = @unit_price`);
        params.unit_price = toMoney(patch.unitPrice);
      }
      if (patch.metadata !== undefined) {
        sets.push(`metadata = @metadata`);
        params.metadata = toJson(patch.metadata);
      }
      sets.push(`updated_at = @updated_at`);
      params.updated_at = now;
      if (sets.length === 1) continue; // only updated_at
      repo.raw.prepare(`UPDATE line_item SET ${sets.join(", ")} WHERE id = @id`).run(params);
    }
    repo.bumpVersion(cartId, cart.version, now);
  });
  const updated = repo.loadCart(cartId);
  publish({
    name: "LineItemUpdated",
    cartId,
    payload: { items: updated.items, cart: updated },
    occurredAt: now,
  });
  return updated;
}

export function removeLineItem(
  repo: CartRepository,
  cartId: string,
  items: Array<{ id: string }>,
): Cart {
  if (!cartId) throw new InvalidDataError(`Field "id" is required`, "id");
  if (!Array.isArray(items) || items.length === 0) {
    throw new InvalidDataError(`items must be a non-empty array`, "items");
  }
  const cart = repo.loadCart(cartId);
  const now = new Date().toISOString();
  repo.withTransaction(() => {
    for (const { id } of items) {
      if (!id) throw new InvalidDataError(`items[].id is required`, "items.id");
      if (!repo.lineItemBelongsToCart(id, cartId)) {
        throw new InvalidDataError(
          `Line item "${id}" does not belong to cart "${cartId}"`,
          "items.id",
        );
      }
      repo.raw
        .prepare(`UPDATE line_item SET deleted_at = ?, updated_at = ? WHERE id = ?`)
        .run(now, now, id);
    }
    repo.bumpVersion(cartId, cart.version, now);
  });
  const updated = repo.loadCart(cartId);
  publish({
    name: "LineItemRemoved",
    cartId,
    payload: { ids: items.map((i) => i.id), cart: updated },
    occurredAt: now,
  });
  return updated;
}
