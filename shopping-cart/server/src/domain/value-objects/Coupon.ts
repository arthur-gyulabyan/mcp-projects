export class Coupon {
  constructor(
    readonly code: string,
    readonly discountType: 'percentage' | 'fixed',
    readonly discountValue: number,
    readonly minOrderAmount: number,
  ) {}

  calculateDiscount(subtotal: number): number {
    if (subtotal < this.minOrderAmount) return 0;
    if (this.discountType === 'percentage') {
      return Math.round(subtotal * this.discountValue) / 100;
    }
    return Math.min(this.discountValue, subtotal);
  }
}
