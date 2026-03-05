import { CartStatus, canTransition } from '../value-objects/CartStatus';
import { Coupon } from '../value-objects/Coupon';
import { CartItem } from './CartItem';

export interface CartProps {
  id: string;
  customerId: string;
  status: CartStatus;
  currency: string;
  subtotal: number;
  discount: number;
  totalAmount: number;
  couponCode: string | null;
  createdAt: string;
  updatedAt: string;
  expiresAt: string | null;
  items: CartItem[];
}

export class Cart {
  readonly id: string;
  readonly customerId: string;
  private _status: CartStatus;
  readonly currency: string;
  private _subtotal: number;
  private _discount: number;
  private _totalAmount: number;
  private _couponCode: string | null;
  readonly createdAt: string;
  private _updatedAt: string;
  readonly expiresAt: string | null;
  private _items: CartItem[];
  private _appliedCoupon: Coupon | null = null;

  private constructor(props: CartProps) {
    this.id = props.id;
    this.customerId = props.customerId;
    this._status = props.status;
    this.currency = props.currency;
    this._subtotal = props.subtotal;
    this._discount = props.discount;
    this._totalAmount = props.totalAmount;
    this._couponCode = props.couponCode;
    this.createdAt = props.createdAt;
    this._updatedAt = props.updatedAt;
    this.expiresAt = props.expiresAt;
    this._items = props.items;
  }

  static create(params: { id: string; customerId: string; currency: string }): Cart {
    const now = new Date().toISOString();
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
    return new Cart({
      id: params.id,
      customerId: params.customerId,
      status: 'active',
      currency: params.currency,
      subtotal: 0,
      discount: 0,
      totalAmount: 0,
      couponCode: null,
      createdAt: now,
      updatedAt: now,
      expiresAt,
      items: [],
    });
  }

  static reconstitute(props: CartProps): Cart {
    return new Cart(props);
  }

  private assertActive(): void {
    if (this._status !== 'active') {
      throw new Error(`Cannot modify cart in '${this._status}' status`);
    }
  }

  private transition(to: CartStatus): void {
    if (!canTransition(this._status, to)) {
      throw new Error(`Cannot transition from '${this._status}' to '${to}'`);
    }
    this._status = to;
    this._updatedAt = new Date().toISOString();
  }

  addItem(item: CartItem): void {
    this.assertActive();
    const existing = this._items.find(i => i.productId === item.productId);
    if (existing) {
      existing.updateQuantity(existing.quantity + item.quantity);
    } else {
      this._items.push(item);
    }
    this.recalculateTotals();
  }

  updateItemQuantity(cartItemId: string, quantity: number): void {
    this.assertActive();
    const item = this._items.find(i => i.id === cartItemId);
    if (!item) throw new Error(`Cart item '${cartItemId}' not found`);
    item.updateQuantity(quantity);
    this.recalculateTotals();
  }

  removeItem(cartItemId: string): void {
    this.assertActive();
    const idx = this._items.findIndex(i => i.id === cartItemId);
    if (idx === -1) throw new Error(`Cart item '${cartItemId}' not found`);
    this._items.splice(idx, 1);
    this.recalculateTotals();
  }

  applyCoupon(coupon: Coupon): void {
    this.assertActive();
    this._appliedCoupon = coupon;
    this._couponCode = coupon.code;
    this.recalculateTotals();
  }

  recalculateTotals(): void {
    this._subtotal = this._items.reduce((sum, item) => sum + item.subtotal, 0);
    this._subtotal = Math.round(this._subtotal * 100) / 100;

    if (this._appliedCoupon) {
      this._discount = this._appliedCoupon.calculateDiscount(this._subtotal);
    }
    this._discount = Math.round(this._discount * 100) / 100;

    this._totalAmount = Math.round((this._subtotal - this._discount) * 100) / 100;
    this._updatedAt = new Date().toISOString();
  }

  initiateCheckout(): void {
    if (this._items.length === 0) throw new Error('Cannot checkout empty cart');
    this.transition('checking_out');
  }

  completeCheckout(): void {
    this.transition('checked_out');
  }

  failCheckout(): void {
    this.transition('active');
  }

  markHandedOff(): void {
    this.transition('handed_off');
  }

  get status(): CartStatus { return this._status; }
  get subtotal(): number { return this._subtotal; }
  get discount(): number { return this._discount; }
  get totalAmount(): number { return this._totalAmount; }
  get couponCode(): string | null { return this._couponCode; }
  get updatedAt(): string { return this._updatedAt; }
  get items(): ReadonlyArray<CartItem> { return this._items; }
  get itemCount(): number { return this._items.reduce((sum, i) => sum + i.quantity, 0); }
}
