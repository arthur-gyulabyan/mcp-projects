/**
 * Domain types — mirror the Qlerify Cart Aggregate model.
 * Monetary values are kept as strings throughout (bigNumber semantics).
 */

export type Json = Record<string, unknown> | null;

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
  customerId?: string | null;
  metadata?: Json;
}

export interface LineItemAdjustment {
  id?: string;
  amount: string;
  code?: string | null;
  description?: string | null;
  promotionId?: string | null;
  providerId?: string | null;
  isTaxInclusive?: boolean;
  metadata?: Json;
}

export interface LineItemTaxLine {
  id?: string;
  code: string;
  rate: string;
  description?: string | null;
  providerId?: string | null;
  taxRateId?: string | null;
  metadata?: Json;
}

export interface ShippingMethodAdjustment {
  id?: string;
  amount: string;
  code?: string | null;
  description?: string | null;
  promotionId?: string | null;
  providerId?: string | null;
  metadata?: Json;
}

export interface ShippingMethodTaxLine {
  id?: string;
  code: string;
  rate: string;
  description?: string | null;
  providerId?: string | null;
  taxRateId?: string | null;
  metadata?: Json;
}

export interface LineItem {
  id: string;
  title: string;
  quantity: number;
  unitPrice: string;
  subtitle?: string | null;
  thumbnail?: string | null;
  variantId?: string | null;
  productId?: string | null;
  productTitle?: string | null;
  productDescription?: string | null;
  productSubtitle?: string | null;
  productType?: string | null;
  productTypeId?: string | null;
  productCollection?: string | null;
  productHandle?: string | null;
  variantSku?: string | null;
  variantBarcode?: string | null;
  variantTitle?: string | null;
  variantOptionValues?: Json;
  requiresShipping?: boolean;
  isDiscountable?: boolean;
  isGiftcard?: boolean;
  isTaxInclusive?: boolean;
  isCustomPrice?: boolean;
  compareAtUnitPrice?: string | null;
  metadata?: Json;
  adjustments?: LineItemAdjustment[];
  taxLines?: LineItemTaxLine[];
}

export interface ShippingMethod {
  id: string;
  name: string;
  amount: string;
  description?: Json;
  shippingOptionId?: string | null;
  data?: Json;
  isTaxInclusive?: boolean;
  metadata?: Json;
  adjustments?: ShippingMethodAdjustment[];
  taxLines?: ShippingMethodTaxLine[];
}

export interface CreditLine {
  id: string;
  amount: string;
  reference?: string | null;
  referenceId?: string | null;
  metadata?: Json;
}

export interface Cart {
  id: string;
  currencyCode: string;
  regionId?: string | null;
  customerId?: string | null;
  salesChannelId?: string | null;
  email?: string | null;
  locale?: string | null;
  metadata?: Json;
  completedAt?: string | null;
  billingAddress?: Address | null;
  shippingAddress?: Address | null;
  items: LineItem[];
  shippingMethods: ShippingMethod[];
  creditLines: CreditLine[];
  version: number;
  createdAt: string;
  updatedAt: string;
  deletedAt?: string | null;
}
