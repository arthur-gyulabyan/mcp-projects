import type Database from "better-sqlite3";

export function initSchema(db: Database.Database): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS cart (
      id TEXT PRIMARY KEY,
      currency_code TEXT NOT NULL,
      region_id TEXT,
      customer_id TEXT,
      sales_channel_id TEXT,
      email TEXT,
      locale TEXT,
      metadata TEXT,
      completed_at TEXT,
      billing_address TEXT,
      shipping_address TEXT,
      version INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      deleted_at TEXT
    );

    CREATE INDEX IF NOT EXISTS idx_cart_customer ON cart(customer_id);
    CREATE INDEX IF NOT EXISTS idx_cart_email ON cart(email);
    CREATE INDEX IF NOT EXISTS idx_cart_deleted ON cart(deleted_at);

    CREATE TABLE IF NOT EXISTS line_item (
      id TEXT PRIMARY KEY,
      cart_id TEXT NOT NULL REFERENCES cart(id) ON DELETE CASCADE,
      title TEXT NOT NULL,
      quantity INTEGER NOT NULL,
      unit_price TEXT NOT NULL,
      subtitle TEXT,
      thumbnail TEXT,
      variant_id TEXT,
      product_id TEXT,
      product_title TEXT,
      product_description TEXT,
      product_subtitle TEXT,
      product_type TEXT,
      product_type_id TEXT,
      product_collection TEXT,
      product_handle TEXT,
      variant_sku TEXT,
      variant_barcode TEXT,
      variant_title TEXT,
      variant_option_values TEXT,
      requires_shipping INTEGER NOT NULL DEFAULT 1,
      is_discountable INTEGER NOT NULL DEFAULT 1,
      is_giftcard INTEGER NOT NULL DEFAULT 0,
      is_tax_inclusive INTEGER NOT NULL DEFAULT 0,
      is_custom_price INTEGER NOT NULL DEFAULT 0,
      compare_at_unit_price TEXT,
      metadata TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      deleted_at TEXT
    );
    CREATE INDEX IF NOT EXISTS idx_line_item_cart ON line_item(cart_id);

    CREATE TABLE IF NOT EXISTS shipping_method (
      id TEXT PRIMARY KEY,
      cart_id TEXT NOT NULL REFERENCES cart(id) ON DELETE CASCADE,
      name TEXT NOT NULL,
      amount TEXT NOT NULL,
      description TEXT,
      shipping_option_id TEXT,
      data TEXT,
      is_tax_inclusive INTEGER NOT NULL DEFAULT 0,
      metadata TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      deleted_at TEXT
    );
    CREATE INDEX IF NOT EXISTS idx_shipping_method_cart ON shipping_method(cart_id);

    CREATE TABLE IF NOT EXISTS credit_line (
      id TEXT PRIMARY KEY,
      cart_id TEXT NOT NULL REFERENCES cart(id) ON DELETE CASCADE,
      amount TEXT NOT NULL,
      reference TEXT,
      reference_id TEXT,
      metadata TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      deleted_at TEXT
    );
    CREATE INDEX IF NOT EXISTS idx_credit_line_cart ON credit_line(cart_id);

    CREATE TABLE IF NOT EXISTS line_item_adjustment (
      id TEXT PRIMARY KEY,
      line_item_id TEXT NOT NULL REFERENCES line_item(id) ON DELETE CASCADE,
      amount TEXT NOT NULL,
      code TEXT,
      description TEXT,
      promotion_id TEXT,
      provider_id TEXT,
      is_tax_inclusive INTEGER NOT NULL DEFAULT 0,
      metadata TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      deleted_at TEXT
    );
    CREATE INDEX IF NOT EXISTS idx_li_adj_li ON line_item_adjustment(line_item_id);

    CREATE TABLE IF NOT EXISTS line_item_tax_line (
      id TEXT PRIMARY KEY,
      line_item_id TEXT NOT NULL REFERENCES line_item(id) ON DELETE CASCADE,
      code TEXT NOT NULL,
      rate TEXT NOT NULL,
      description TEXT,
      provider_id TEXT,
      tax_rate_id TEXT,
      metadata TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      deleted_at TEXT
    );
    CREATE INDEX IF NOT EXISTS idx_li_tax_li ON line_item_tax_line(line_item_id);

    CREATE TABLE IF NOT EXISTS shipping_method_adjustment (
      id TEXT PRIMARY KEY,
      shipping_method_id TEXT NOT NULL REFERENCES shipping_method(id) ON DELETE CASCADE,
      amount TEXT NOT NULL,
      code TEXT,
      description TEXT,
      promotion_id TEXT,
      provider_id TEXT,
      metadata TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      deleted_at TEXT
    );
    CREATE INDEX IF NOT EXISTS idx_sm_adj_sm ON shipping_method_adjustment(shipping_method_id);

    CREATE TABLE IF NOT EXISTS shipping_method_tax_line (
      id TEXT PRIMARY KEY,
      shipping_method_id TEXT NOT NULL REFERENCES shipping_method(id) ON DELETE CASCADE,
      code TEXT NOT NULL,
      rate TEXT NOT NULL,
      description TEXT,
      provider_id TEXT,
      tax_rate_id TEXT,
      metadata TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      deleted_at TEXT
    );
    CREATE INDEX IF NOT EXISTS idx_sm_tax_sm ON shipping_method_tax_line(shipping_method_id);
  `);

  db.pragma("foreign_keys = ON");
}
