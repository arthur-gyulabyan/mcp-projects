import { Cart } from '../../domain/entities/Cart';
import { CartItem } from '../../domain/entities/CartItem';

export interface CartDto {
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
  cartItems: CartItemDto[];
}

export interface CartItemDto {
  id: string;
  productId: string;
  productName: string;
  sku: string;
  quantity: number;
  unitPrice: number;
  subtotal: number;
  imageUrl: string | null;
}

export interface GetCartByIdResponse extends CartDto {
  itemCount: number;
}

export interface GetAllCartsResponse {
  cartId: string;
  customerId: string;
  status: string;
  totalAmount: number;
  createdAt: string;
  updatedAt: string;
}

export interface GetCartSummaryResponse {
  cartId: string;
  itemCount: number;
  subtotal: number;
  discount: number;
  totalAmount: number;
  couponCode: string | null;
  currency: string;
}

export function toCartItemDto(item: CartItem): CartItemDto {
  return {
    id: item.id,
    productId: item.productId,
    productName: item.productName,
    sku: item.sku,
    quantity: item.quantity,
    unitPrice: item.unitPrice,
    subtotal: item.subtotal,
    imageUrl: item.imageUrl,
  };
}

export function toCartDto(cart: Cart): CartDto {
  return {
    id: cart.id,
    customerId: cart.customerId,
    status: cart.status,
    currency: cart.currency,
    subtotal: cart.subtotal,
    discount: cart.discount,
    totalAmount: cart.totalAmount,
    couponCode: cart.couponCode,
    createdAt: cart.createdAt,
    updatedAt: cart.updatedAt,
    expiresAt: cart.expiresAt,
    cartItems: cart.items.map(toCartItemDto),
  };
}

export function toGetCartByIdResponse(cart: Cart): GetCartByIdResponse {
  return { ...toCartDto(cart), itemCount: cart.itemCount };
}

export function toGetAllCartsResponse(cart: Cart): GetAllCartsResponse {
  return {
    cartId: cart.id,
    customerId: cart.customerId,
    status: cart.status,
    totalAmount: cart.totalAmount,
    createdAt: cart.createdAt,
    updatedAt: cart.updatedAt,
  };
}

export function toGetCartSummaryResponse(cart: Cart): GetCartSummaryResponse {
  return {
    cartId: cart.id,
    itemCount: cart.itemCount,
    subtotal: cart.subtotal,
    discount: cart.discount,
    totalAmount: cart.totalAmount,
    couponCode: cart.couponCode,
    currency: cart.currency,
  };
}
