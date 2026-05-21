export type Role = "Customer" | "Automation" | "Admin";

let currentRole: Role = "Customer";

export function setRole(role: Role) {
  currentRole = role;
}

export function getRole(): Role {
  return currentRole;
}

export interface ApiError extends Error {
  code?: string;
  status: number;
  field?: string;
}

async function request<T>(
  method: string,
  path: string,
  body?: unknown,
): Promise<T> {
  const res = await fetch(`/api/v1${path}`, {
    method,
    headers: {
      "Content-Type": "application/json",
      "X-Role": currentRole,
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await res.text();
  const data = text ? JSON.parse(text) : null;
  if (!res.ok) {
    const err = new Error(data?.message ?? `${res.status} ${res.statusText}`) as ApiError;
    err.status = res.status;
    err.code = data?.code;
    err.field = data?.field;
    throw err;
  }
  return data as T;
}

export const api = {
  listCarts: (params: Record<string, string | undefined> = {}) => {
    const q = new URLSearchParams(
      Object.entries(params).filter(([, v]) => v) as [string, string][],
    ).toString();
    return request<CartSummary[]>("GET", `/carts${q ? `?${q}` : ""}`);
  },
  getCart: (id: string) => request<CartView>("GET", `/carts/${id}`),

  createCart: (body: Record<string, unknown>) =>
    request<CartView>("POST", `/carts`, body),
  updateCart: (id: string, body: Record<string, unknown>) =>
    request<CartView>("PATCH", `/carts/${id}`, body),
  deleteCart: (id: string) => request<{ id: string }>("DELETE", `/carts/${id}`),
  restoreCart: (id: string) =>
    request<{ id: string }>("POST", `/carts/${id}/restore`),

  setShippingAddress: (id: string, address: Address) =>
    request<CartView>("PUT", `/carts/${id}/shipping-address`, {
      shippingAddress: address,
    }),
  setBillingAddress: (id: string, address: Address) =>
    request<CartView>("PUT", `/carts/${id}/billing-address`, {
      billingAddress: address,
    }),

  addLineItem: (id: string, items: Array<Record<string, unknown>>) =>
    request<CartView>("POST", `/carts/${id}/line-items`, { items }),
  updateLineItem: (id: string, items: Array<Record<string, unknown>>) =>
    request<CartView>("PATCH", `/carts/${id}/line-items`, { items }),
  removeLineItem: (id: string, items: Array<{ id: string }>) =>
    request<CartView>("DELETE", `/carts/${id}/line-items`, { items }),

  addShippingMethod: (id: string, methods: Array<Record<string, unknown>>) =>
    request<CartView>("POST", `/carts/${id}/shipping-methods`, {
      shippingMethods: methods,
    }),
  removeShippingMethod: (id: string, methods: Array<{ id: string }>) =>
    request<CartView>("DELETE", `/carts/${id}/shipping-methods`, {
      shippingMethods: methods,
    }),

  setLineItemAdjustments: (id: string, items: Array<Record<string, unknown>>) =>
    request<CartView>("PUT", `/carts/${id}/line-item-adjustments`, { items }),
  setShippingMethodAdjustments: (
    id: string,
    shippingMethods: Array<Record<string, unknown>>,
  ) =>
    request<CartView>("PUT", `/carts/${id}/shipping-method-adjustments`, {
      shippingMethods,
    }),
  setLineItemTaxLines: (id: string, items: Array<Record<string, unknown>>) =>
    request<CartView>("PUT", `/carts/${id}/line-item-tax-lines`, { items }),
  setShippingMethodTaxLines: (
    id: string,
    shippingMethods: Array<Record<string, unknown>>,
  ) =>
    request<CartView>("PUT", `/carts/${id}/shipping-method-tax-lines`, {
      shippingMethods,
    }),

  addCreditLine: (id: string, creditLines: Array<Record<string, unknown>>) =>
    request<CartView>("POST", `/carts/${id}/credit-lines`, { creditLines }),
  removeCreditLine: (id: string, creditLines: Array<{ id: string }>) =>
    request<CartView>("DELETE", `/carts/${id}/credit-lines`, { creditLines }),
};

export interface Address {
  firstName?: string | null;
  lastName?: string | null;
  company?: string | null;
  address1?: string | null;
  address2?: string | null;
  city?: string | null;
  province?: string | null;
  postalCode?: string | null;
  countryCode?: string | null;
  phone?: string | null;
}

export interface LineItemView {
  id: string;
  title: string;
  quantity: number;
  unitPrice: string;
  productId?: string | null;
  thumbnail?: string | null;
  isGiftcard?: boolean;
  isDiscountable?: boolean;
  isTaxInclusive?: boolean;
  compareAtUnitPrice?: string | null;
  subtotal: string;
  total: string;
  discountTotal: string;
  taxTotal: string;
  adjustments?: Array<{ id?: string; amount: string; code?: string | null; description?: string | null }>;
  taxLines?: Array<{ id?: string; code: string; rate: string; description?: string | null }>;
}

export interface ShippingMethodView {
  id: string;
  name: string;
  amount: string;
  shippingOptionId?: string | null;
  isTaxInclusive?: boolean;
  subtotal: string;
  total: string;
  discountTotal: string;
  taxTotal: string;
  adjustments?: Array<{ id?: string; amount: string; code?: string | null; description?: string | null }>;
  taxLines?: Array<{ id?: string; code: string; rate: string; description?: string | null }>;
}

export interface CreditLineView {
  id: string;
  amount: string;
  reference?: string | null;
  referenceId?: string | null;
}

export interface CartTotals {
  itemTotal: string;
  originalItemTotal: string;
  shippingTotal: string;
  discountTotal: string;
  taxTotal: string;
  subtotal: string;
  total: string;
  creditLineTotal: string;
}

export interface CartView {
  id: string;
  currencyCode: string;
  regionId?: string | null;
  customerId?: string | null;
  salesChannelId?: string | null;
  email?: string | null;
  locale?: string | null;
  completedAt?: string | null;
  billingAddress?: Address | null;
  shippingAddress?: Address | null;
  items: LineItemView[];
  shippingMethods: ShippingMethodView[];
  creditLines: CreditLineView[];
  version: number;
  createdAt: string;
  updatedAt: string;
  deletedAt?: string | null;
  totals: CartTotals;
}

export interface CartSummary {
  id: string;
  currencyCode: string;
  customerId: string | null;
  email: string | null;
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
  total: string;
  subtotal: string;
}
