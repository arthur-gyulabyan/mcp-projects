import { getDatabase } from './database';
import { runMigrations } from './migrations';

const db = getDatabase();
runMigrations(db);

const insert = db.prepare(
  'INSERT OR REPLACE INTO coupons (code, discount_type, discount_value, min_order_amount) VALUES (?, ?, ?, ?)'
);

const coupons = [
  ['SAVE10', 'percentage', 10, 50],
  ['WELCOME20', 'fixed', 20, 0],
  ['SUMMER15', 'percentage', 15, 75],
] as const;

const seedAll = db.transaction(() => {
  for (const c of coupons) {
    insert.run(...c);
  }
});

seedAll();
console.log(`Seeded ${coupons.length} coupons`);
