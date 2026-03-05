export interface CartItemProps {
  id: string;
  productId: string;
  productName: string;
  sku: string;
  quantity: number;
  unitPrice: number;
  imageUrl: string | null;
}

export class CartItem {
  readonly id: string;
  readonly productId: string;
  readonly productName: string;
  readonly sku: string;
  private _quantity: number;
  readonly unitPrice: number;
  private _subtotal: number;
  readonly imageUrl: string | null;

  private constructor(props: CartItemProps) {
    this.id = props.id;
    this.productId = props.productId;
    this.productName = props.productName;
    this.sku = props.sku;
    this._quantity = props.quantity;
    this.unitPrice = props.unitPrice;
    this._subtotal = Math.round(props.quantity * props.unitPrice * 100) / 100;
    this.imageUrl = props.imageUrl;
  }

  static create(props: CartItemProps): CartItem {
    if (props.quantity < 1) throw new Error('Quantity must be at least 1');
    if (props.unitPrice < 0) throw new Error('Unit price cannot be negative');
    return new CartItem(props);
  }

  static reconstitute(props: CartItemProps & { subtotal: number }): CartItem {
    const item = new CartItem(props);
    item._subtotal = props.subtotal;
    return item;
  }

  updateQuantity(newQty: number): void {
    if (newQty < 1) throw new Error('Quantity must be at least 1');
    this._quantity = newQty;
    this._subtotal = Math.round(this._quantity * this.unitPrice * 100) / 100;
  }

  get quantity(): number { return this._quantity; }
  get subtotal(): number { return this._subtotal; }
}
