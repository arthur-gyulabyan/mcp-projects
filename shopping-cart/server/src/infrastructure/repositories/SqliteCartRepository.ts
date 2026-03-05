import Database from 'better-sqlite3';
import { Cart } from '../../domain/entities/Cart';
import { CartItem } from '../../domain/entities/CartItem';
import { ICartRepository } from '../../domain/repositories/ICartRepository';
import { CartStatus } from '../../domain/value-objects/CartStatus';

interface CartRow {
  id: string;
  customer_id: string;
  status: string;
  currency: string;
  subtotal: number;
  discount: number;
  total_amount: number;
  coupon_code: string | null;
  created_at: string;
  updated_at: string;
  expires_at: string | null;
}

interface CartItemRow {
  id: string;
  cart_id: string;
  product_id: string;
  product_name: string;
  sku: string;
  quantity: number;
  unit_price: number;
  subtotal: number;
  image_url: string | null;
}

export class SqliteCartRepository implements ICartRepository {
  private findCartStmt: Database.Statement;
  private findItemsStmt: Database.Statement;
  private findByCustomerStmt: Database.Statement;
  private findByCustomerStatusStmt: Database.Statement;
  private upsertCartStmt: Database.Statement;
  private deleteItemsStmt: Database.Statement;
  private insertItemStmt: Database.Statement;
  private deleteCartStmt: Database.Statement;

  constructor(private db: Database.Database) {
    this.findCartStmt = db.prepare('SELECT * FROM carts WHERE id = ?');
    this.findItemsStmt = db.prepare('SELECT * FROM cart_items WHERE cart_id = ?');
    this.findByCustomerStmt = db.prepare('SELECT * FROM carts WHERE customer_id = ?');
    this.findByCustomerStatusStmt = db.prepare('SELECT * FROM carts WHERE customer_id = ? AND status = ?');
    this.upsertCartStmt = db.prepare(`
      INSERT INTO carts (id, customer_id, status, currency, subtotal, discount, total_amount, coupon_code, created_at, updated_at, expires_at)
      VALUES (@id, @customer_id, @status, @currency, @subtotal, @discount, @total_amount, @coupon_code, @created_at, @updated_at, @expires_at)
      ON CONFLICT(id) DO UPDATE SET
        status = @status, currency = @currency, subtotal = @subtotal, discount = @discount,
        total_amount = @total_amount, coupon_code = @coupon_code, updated_at = @updated_at
    `);
    this.deleteItemsStmt = db.prepare('DELETE FROM cart_items WHERE cart_id = ?');
    this.insertItemStmt = db.prepare(`
      INSERT INTO cart_items (id, cart_id, product_id, product_name, sku, quantity, unit_price, subtotal, image_url)
      VALUES (@id, @cart_id, @product_id, @product_name, @sku, @quantity, @unit_price, @subtotal, @image_url)
    `);
    this.deleteCartStmt = db.prepare('DELETE FROM carts WHERE id = ?');
  }

  findById(id: string): Cart | null {
    const row = this.findCartStmt.get(id) as CartRow | undefined;
    if (!row) return null;
    const itemRows = this.findItemsStmt.all(id) as CartItemRow[];
    return this.toDomain(row, itemRows);
  }

  findByCustomerId(customerId: string, status?: string): Cart[] {
    const rows = status
      ? this.findByCustomerStatusStmt.all(customerId, status) as CartRow[]
      : this.findByCustomerStmt.all(customerId) as CartRow[];
    return rows.map(row => {
      const itemRows = this.findItemsStmt.all(row.id) as CartItemRow[];
      return this.toDomain(row, itemRows);
    });
  }

  save(cart: Cart): void {
    const saveTransaction = this.db.transaction(() => {
      this.upsertCartStmt.run({
        id: cart.id,
        customer_id: cart.customerId,
        status: cart.status,
        currency: cart.currency,
        subtotal: cart.subtotal,
        discount: cart.discount,
        total_amount: cart.totalAmount,
        coupon_code: cart.couponCode,
        created_at: cart.createdAt,
        updated_at: cart.updatedAt,
        expires_at: cart.expiresAt,
      });
      this.deleteItemsStmt.run(cart.id);
      for (const item of cart.items) {
        this.insertItemStmt.run({
          id: item.id,
          cart_id: cart.id,
          product_id: item.productId,
          product_name: item.productName,
          sku: item.sku,
          quantity: item.quantity,
          unit_price: item.unitPrice,
          subtotal: item.subtotal,
          image_url: item.imageUrl,
        });
      }
    });
    saveTransaction();
  }

  delete(id: string): void {
    this.deleteCartStmt.run(id);
  }

  private toDomain(row: CartRow, itemRows: CartItemRow[]): Cart {
    const items = itemRows.map(ir => CartItem.reconstitute({
      id: ir.id,
      productId: ir.product_id,
      productName: ir.product_name,
      sku: ir.sku,
      quantity: ir.quantity,
      unitPrice: ir.unit_price,
      subtotal: ir.subtotal,
      imageUrl: ir.image_url,
    }));

    return Cart.reconstitute({
      id: row.id,
      customerId: row.customer_id,
      status: row.status as CartStatus,
      currency: row.currency,
      subtotal: row.subtotal,
      discount: row.discount,
      totalAmount: row.total_amount,
      couponCode: row.coupon_code,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      expiresAt: row.expires_at,
      items,
    });
  }
}
