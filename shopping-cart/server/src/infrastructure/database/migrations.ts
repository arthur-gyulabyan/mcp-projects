import Database from 'better-sqlite3';

export function runMigrations(db: Database.Database): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS carts (
      id            TEXT PRIMARY KEY,
      customer_id   TEXT NOT NULL,
      status        TEXT NOT NULL DEFAULT 'active',
      currency      TEXT NOT NULL DEFAULT 'USD',
      subtotal      REAL NOT NULL DEFAULT 0,
      discount      REAL NOT NULL DEFAULT 0,
      total_amount  REAL NOT NULL DEFAULT 0,
      coupon_code   TEXT,
      created_at    TEXT NOT NULL,
      updated_at    TEXT NOT NULL,
      expires_at    TEXT
    );

    CREATE INDEX IF NOT EXISTS idx_carts_customer_status ON carts(customer_id, status);

    CREATE TABLE IF NOT EXISTS cart_items (
      id            TEXT PRIMARY KEY,
      cart_id       TEXT NOT NULL,
      product_id    TEXT NOT NULL,
      product_name  TEXT NOT NULL,
      sku           TEXT NOT NULL,
      quantity      INTEGER NOT NULL DEFAULT 1,
      unit_price    REAL NOT NULL,
      subtotal      REAL NOT NULL,
      image_url     TEXT,
      FOREIGN KEY (cart_id) REFERENCES carts(id) ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS idx_cart_items_cart_id ON cart_items(cart_id);

    CREATE TABLE IF NOT EXISTS coupons (
      code             TEXT PRIMARY KEY,
      discount_type    TEXT NOT NULL,
      discount_value   REAL NOT NULL,
      min_order_amount REAL NOT NULL DEFAULT 0
    );
  `);
}
