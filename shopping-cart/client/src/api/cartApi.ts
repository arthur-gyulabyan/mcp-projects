import { Cart, CartDetails, CartItem, Product } from './types';

const BASE = '/api/v1';

class ApiError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

async function request<T>(url: string, options?: RequestInit): Promise<T> {
  const res = await fetch(url, options);
  const body = await res.json();
  if (!res.ok) throw new ApiError(res.status, body.message || 'Request failed');
  return body as T;
}

function post<T>(url: string, data: unknown): Promise<T> {
  return request<T>(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
}

export const cartApi = {
  listProducts: () => request<Product[]>(`${BASE}/products`),

  createCart: (customerId: string, currency = 'USD') =>
    post<Cart>(`${BASE}/create-cart`, { customerId, currency }),

  getCartById: (cartId: string) =>
    request<CartDetails>(`${BASE}/get-cart-by-id/${cartId}`),

  addItemToCart: (cartId: string, productId: string, quantity = 1) =>
    post<CartItem>(`${BASE}/add-item-to-cart`, { cartId, productId, quantity }),

  updateItemQuantity: (cartId: string, cartItemId: string, quantity: number) =>
    post<CartItem>(`${BASE}/update-item-quantity`, { cartId, cartItemId, quantity }),

  removeItemFromCart: (cartId: string, cartItemId: string) =>
    post<Cart>(`${BASE}/remove-item-from-cart`, { cartId, cartItemId }),

  applyCoupon: (cartId: string, couponCode: string) =>
    post<Cart>(`${BASE}/apply-coupon`, { cartId, couponCode }),

  checkoutCart: (cartId: string) =>
    post<Cart>(`${BASE}/checkout-cart`, { cartId }),

  completeCheckout: (cartId: string) =>
    post<Cart>(`${BASE}/complete-checkout`, { cartId }),

  failCheckout: (cartId: string, reason: string) =>
    post<Cart>(`${BASE}/fail-checkout`, { cartId, reason }),
};
