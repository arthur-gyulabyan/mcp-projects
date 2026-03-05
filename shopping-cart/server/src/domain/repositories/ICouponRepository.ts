import { Coupon } from '../value-objects/Coupon';

export interface ICouponRepository {
  findByCode(code: string): Coupon | null;
}
