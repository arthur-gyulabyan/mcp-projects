export interface Cart {
  id: string;
  customerId: string;
  status: string;
  currency: string;
  subtotal: number;
  discount: number;
  totalAmount: number;
  couponCode: string | null;
  createdAt: string;
  updatedAt: string;
  expiresAt: string | null;
  cartItems: CartItem[];
}

export interface CartItem {
  id: string;
  productId: string;
  productName: string;
  sku: string;
  quantity: number;
  unitPrice: number;
  subtotal: number;
  imageUrl: string | null;
}

export interface CartDetails extends Cart {
  itemCount: number;
}

export interface Product {
  productId: string;
  productName: string;
  sku: string;
  unitPrice: number;
  imageUrl: string | null;
}

export interface ApiError {
  message: string;
}
