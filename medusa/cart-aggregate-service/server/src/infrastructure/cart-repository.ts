import type Database from "better-sqlite3";
import { ConflictError, NotFoundError } from "../domain/errors.js";
import type { Cart } from "../domain/types.js";
import {
  cartFromRow,
  creditLineFromRow,
  fromBool,
  fromJson,
  lineItemAdjustmentFromRow,
  lineItemFromRow,
  lineItemTaxLineFromRow,
  shippingMethodAdjustmentFromRow,
  shippingMethodFromRow,
  shippingMethodTaxLineFromRow,
  toBool,
  toJson,
  type CartRow,
  type CreditLineRow,
  type LineItemAdjustmentRow,
  type LineItemRow,
  type LineItemTaxLineRow,
  type ShippingMethodAdjustmentRow,
  type ShippingMethodRow,
  type ShippingMethodTaxLineRow,
} from "./serialize.js";

export class CartRepository {
  constructor(private readonly db: Database.Database) {}

  insertCart(cart: Cart): void {
    const stmt = this.db.prepare(`
      INSERT INTO cart (
        id, currency_code, region_id, customer_id, sales_channel_id,
        email, locale, metadata, completed_at,
        billing_address, shipping_address,
        version, created_at, updated_at, deleted_at
      ) VALUES (@id, @currency_code, @region_id, @customer_id, @sales_channel_id,
        @email, @locale, @metadata, @completed_at,
        @billing_address, @shipping_address,
        @version, @created_at, @updated_at, @deleted_at)
    `);
    stmt.run({
      id: cart.id,
      currency_code: cart.currencyCode,
      region_id: cart.regionId ?? null,
      customer_id: cart.customerId ?? null,
      sales_channel_id: cart.salesChannelId ?? null,
      email: cart.email ?? null,
      locale: cart.locale ?? null,
      metadata: toJson(cart.metadata ?? null),
      completed_at: cart.completedAt ?? null,
      billing_address: toJson(cart.billingAddress as never),
      shipping_address: toJson(cart.shippingAddress as never),
      version: cart.version,
      created_at: cart.createdAt,
      updated_at: cart.updatedAt,
      deleted_at: cart.deletedAt ?? null,
    });
  }

  loadCart(id: string, opts: { includeDeleted?: boolean } = {}): Cart {
    const cartRow = this.db
      .prepare<[string]>(`SELECT * FROM cart WHERE id = ?`)
      .get(id) as CartRow | undefined;
    if (!cartRow) {
      throw new NotFoundError(`Cart "${id}" was not found`);
    }
    if (cartRow.deleted_at && !opts.includeDeleted) {
      throw new NotFoundError(`Cart "${id}" was not found`);
    }

    const base = cartFromRow(cartRow);

    const itemRows = this.db
      .prepare<[string]>(
        `SELECT * FROM line_item WHERE cart_id = ? AND deleted_at IS NULL ORDER BY created_at ASC`,
      )
      .all(id) as LineItemRow[];

    const items = itemRows.map((row) => {
      const adjustmentRows = this.db
        .prepare<[string]>(
          `SELECT * FROM line_item_adjustment WHERE line_item_id = ? AND deleted_at IS NULL ORDER BY created_at ASC`,
        )
        .all(row.id) as LineItemAdjustmentRow[];
      const taxLineRows = this.db
        .prepare<[string]>(
          `SELECT * FROM line_item_tax_line WHERE line_item_id = ? AND deleted_at IS NULL ORDER BY created_at ASC`,
        )
        .all(row.id) as LineItemTaxLineRow[];
      return lineItemFromRow(
        row,
        adjustmentRows.map(lineItemAdjustmentFromRow),
        taxLineRows.map(lineItemTaxLineFromRow),
      );
    });

    const methodRows = this.db
      .prepare<[string]>(
        `SELECT * FROM shipping_method WHERE cart_id = ? AND deleted_at IS NULL ORDER BY created_at ASC`,
      )
      .all(id) as ShippingMethodRow[];

    const shippingMethods = methodRows.map((row) => {
      const adjustmentRows = this.db
        .prepare<[string]>(
          `SELECT * FROM shipping_method_adjustment WHERE shipping_method_id = ? AND deleted_at IS NULL ORDER BY created_at ASC`,
        )
        .all(row.id) as ShippingMethodAdjustmentRow[];
      const taxLineRows = this.db
        .prepare<[string]>(
          `SELECT * FROM shipping_method_tax_line WHERE shipping_method_id = ? AND deleted_at IS NULL ORDER BY created_at ASC`,
        )
        .all(row.id) as ShippingMethodTaxLineRow[];
      return shippingMethodFromRow(
        row,
        adjustmentRows.map(shippingMethodAdjustmentFromRow),
        taxLineRows.map(shippingMethodTaxLineFromRow),
      );
    });

    const creditRows = this.db
      .prepare<[string]>(
        `SELECT * FROM credit_line WHERE cart_id = ? AND deleted_at IS NULL ORDER BY created_at ASC`,
      )
      .all(id) as CreditLineRow[];
    const creditLines = creditRows.map(creditLineFromRow);

    return {
      ...base,
      items,
      shippingMethods,
      creditLines,
    };
  }

  cartExists(id: string): boolean {
    const row = this.db
      .prepare<[string]>(
        `SELECT 1 AS x FROM cart WHERE id = ? AND deleted_at IS NULL`,
      )
      .get(id);
    return Boolean(row);
  }

  cartExistsAny(id: string): boolean {
    const row = this.db.prepare<[string]>(`SELECT 1 AS x FROM cart WHERE id = ?`).get(id);
    return Boolean(row);
  }

  /**
   * Optimistic concurrency: bumps version. Throws ConflictError if the version
   * does not match the loaded version.
   */
  bumpVersion(cartId: string, expectedVersion: number, now: string): number {
    const newVersion = expectedVersion + 1;
    const result = this.db
      .prepare(
        `UPDATE cart SET version = ?, updated_at = ? WHERE id = ? AND version = ?`,
      )
      .run(newVersion, now, cartId, expectedVersion);
    if (result.changes === 0) {
      throw new ConflictError(
        `Cart "${cartId}" was modified concurrently; please retry`,
      );
    }
    return newVersion;
  }

  /** Like loadCart but does not throw for soft-deleted carts. */
  tryLoadCartIncludingDeleted(id: string): Cart {
    return this.loadCart(id, { includeDeleted: true });
  }

  /** Helper: confirms a line item belongs to a given cart and is alive. */
  lineItemBelongsToCart(lineItemId: string, cartId: string): boolean {
    const row = this.db
      .prepare<[string, string]>(
        `SELECT 1 AS x FROM line_item WHERE id = ? AND cart_id = ? AND deleted_at IS NULL`,
      )
      .get(lineItemId, cartId);
    return Boolean(row);
  }

  shippingMethodBelongsToCart(shippingMethodId: string, cartId: string): boolean {
    const row = this.db
      .prepare<[string, string]>(
        `SELECT 1 AS x FROM shipping_method WHERE id = ? AND cart_id = ? AND deleted_at IS NULL`,
      )
      .get(shippingMethodId, cartId);
    return Boolean(row);
  }

  // Raw helpers used by command handlers
  withTransaction<T>(fn: () => T): T {
    const tx = this.db.transaction(fn);
    return tx();
  }

  get raw(): Database.Database {
    return this.db;
  }
}

export { toBool, toJson, fromJson, fromBool };
