import { publish } from "../../events/bus.js";
import {
  assertCurrencyCode,
  assertLineItem,
  normalizeAddress,
} from "../../domain/cart/invariants.js";
import { cartId as newCartId, lineItemId } from "../../domain/ids.js";
import { toMoney } from "../../domain/money.js";
import type { Cart, LineItem } from "../../domain/types.js";
import {
  CartRepository,
  toBool,
  toJson,
} from "../../infrastructure/cart-repository.js";

export interface CreateCartInput {
  currencyCode?: string;
  regionId?: string | null;
  customerId?: string | null;
  salesChannelId?: string | null;
  email?: string | null;
  locale?: string | null;
  metadata?: Record<string, unknown> | null;
  billingAddress?: Partial<import("../../domain/types.js").Address> | null;
  shippingAddress?: Partial<import("../../domain/types.js").Address> | null;
  items?: Array<Partial<LineItem>>;
}

export function createCart(
  repo: CartRepository,
  input: CreateCartInput,
): Cart {
  const currency = assertCurrencyCode(input.currencyCode);
  const items = (input.items ?? []) as Array<Partial<LineItem>>;
  for (const item of items) {
    assertLineItem(item);
  }
  const now = new Date().toISOString();
  const id = newCartId();

  const cart: Cart = {
    id,
    currencyCode: currency,
    regionId: input.regionId ?? null,
    customerId: input.customerId ?? null,
    salesChannelId: input.salesChannelId ?? null,
    email: input.email ?? null,
    locale: input.locale ?? null,
    metadata: (input.metadata as Cart["metadata"]) ?? null,
    completedAt: null,
    billingAddress: normalizeAddress(input.billingAddress),
    shippingAddress: normalizeAddress(input.shippingAddress),
    items: [],
    shippingMethods: [],
    creditLines: [],
    version: 0,
    createdAt: now,
    updatedAt: now,
    deletedAt: null,
  };

  repo.withTransaction(() => {
    repo.insertCart(cart);

    const itemStmt = repo.raw.prepare(`
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

    for (const item of items) {
      itemStmt.run({
        id: lineItemId(),
        cart_id: id,
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
  });

  const result = repo.loadCart(id);
  publish({
    name: "CartCreated",
    cartId: id,
    payload: result,
    occurredAt: now,
  });
  return result;
}
