import Database from 'better-sqlite3';
import { ICouponRepository } from '../../domain/repositories/ICouponRepository';
import { Coupon } from '../../domain/value-objects/Coupon';

interface CouponRow {
  code: string;
  discount_type: string;
  discount_value: number;
  min_order_amount: number;
}

export class SqliteCouponRepository implements ICouponRepository {
  private findStmt: Database.Statement;

  constructor(db: Database.Database) {
    this.findStmt = db.prepare('SELECT * FROM coupons WHERE code = ?');
  }

  findByCode(code: string): Coupon | null {
    const row = this.findStmt.get(code.toUpperCase()) as CouponRow | undefined;
    if (!row) return null;
    return new Coupon(
      row.code,
      row.discount_type as 'percentage' | 'fixed',
      row.discount_value,
      row.min_order_amount,
    );
  }
}
