import type {
  Address,
  CreditLine,
  Json,
  LineItem,
  LineItemAdjustment,
  LineItemTaxLine,
  ShippingMethod,
  ShippingMethodAdjustment,
  ShippingMethodTaxLine,
} from "../domain/types.js";

export const toJson = (v: Json | undefined): string | null =>
  v === null || v === undefined ? null : JSON.stringify(v);

export const fromJson = <T>(v: string | null): T | null =>
  v === null || v === undefined ? null : (JSON.parse(v) as T);

export const toBool = (v: unknown): number => (v ? 1 : 0);
export const fromBool = (v: number | null): boolean => Boolean(v);

interface CartRow {
  id: string;
  currency_code: string;
  region_id: string | null;
  customer_id: string | null;
  sales_channel_id: string | null;
  email: string | null;
  locale: string | null;
  metadata: string | null;
  completed_at: string | null;
  billing_address: string | null;
  shipping_address: string | null;
  version: number;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}

interface LineItemRow {
  id: string;
  cart_id: string;
  title: string;
  quantity: number;
  unit_price: string;
  subtitle: string | null;
  thumbnail: string | null;
  variant_id: string | null;
  product_id: string | null;
  product_title: string | null;
  product_description: string | null;
  product_subtitle: string | null;
  product_type: string | null;
  product_type_id: string | null;
  product_collection: string | null;
  product_handle: string | null;
  variant_sku: string | null;
  variant_barcode: string | null;
  variant_title: string | null;
  variant_option_values: string | null;
  requires_shipping: number;
  is_discountable: number;
  is_giftcard: number;
  is_tax_inclusive: number;
  is_custom_price: number;
  compare_at_unit_price: string | null;
  metadata: string | null;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}

interface ShippingMethodRow {
  id: string;
  cart_id: string;
  name: string;
  amount: string;
  description: string | null;
  shipping_option_id: string | null;
  data: string | null;
  is_tax_inclusive: number;
  metadata: string | null;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}

interface CreditLineRow {
  id: string;
  cart_id: string;
  amount: string;
  reference: string | null;
  reference_id: string | null;
  metadata: string | null;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}

interface LineItemAdjustmentRow {
  id: string;
  line_item_id: string;
  amount: string;
  code: string | null;
  description: string | null;
  promotion_id: string | null;
  provider_id: string | null;
  is_tax_inclusive: number;
  metadata: string | null;
}

interface LineItemTaxLineRow {
  id: string;
  line_item_id: string;
  code: string;
  rate: string;
  description: string | null;
  provider_id: string | null;
  tax_rate_id: string | null;
  metadata: string | null;
}

interface ShippingMethodAdjustmentRow {
  id: string;
  shipping_method_id: string;
  amount: string;
  code: string | null;
  description: string | null;
  promotion_id: string | null;
  provider_id: string | null;
  metadata: string | null;
}

interface ShippingMethodTaxLineRow {
  id: string;
  shipping_method_id: string;
  code: string;
  rate: string;
  description: string | null;
  provider_id: string | null;
  tax_rate_id: string | null;
  metadata: string | null;
}

export type {
  CartRow,
  LineItemRow,
  ShippingMethodRow,
  CreditLineRow,
  LineItemAdjustmentRow,
  LineItemTaxLineRow,
  ShippingMethodAdjustmentRow,
  ShippingMethodTaxLineRow,
};

export function cartFromRow(row: CartRow): {
  id: string;
  currencyCode: string;
  regionId: string | null;
  customerId: string | null;
  salesChannelId: string | null;
  email: string | null;
  locale: string | null;
  metadata: Json;
  completedAt: string | null;
  billingAddress: Address | null;
  shippingAddress: Address | null;
  version: number;
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
} {
  return {
    id: row.id,
    currencyCode: row.currency_code,
    regionId: row.region_id,
    customerId: row.customer_id,
    salesChannelId: row.sales_channel_id,
    email: row.email,
    locale: row.locale,
    metadata: fromJson(row.metadata),
    completedAt: row.completed_at,
    billingAddress: fromJson<Address>(row.billing_address),
    shippingAddress: fromJson<Address>(row.shipping_address),
    version: row.version,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    deletedAt: row.deleted_at,
  };
}

export function lineItemFromRow(
  row: LineItemRow,
  adjustments: LineItemAdjustment[],
  taxLines: LineItemTaxLine[],
): LineItem {
  return {
    id: row.id,
    title: row.title,
    quantity: row.quantity,
    unitPrice: row.unit_price,
    subtitle: row.subtitle,
    thumbnail: row.thumbnail,
    variantId: row.variant_id,
    productId: row.product_id,
    productTitle: row.product_title,
    productDescription: row.product_description,
    productSubtitle: row.product_subtitle,
    productType: row.product_type,
    productTypeId: row.product_type_id,
    productCollection: row.product_collection,
    productHandle: row.product_handle,
    variantSku: row.variant_sku,
    variantBarcode: row.variant_barcode,
    variantTitle: row.variant_title,
    variantOptionValues: fromJson(row.variant_option_values),
    requiresShipping: fromBool(row.requires_shipping),
    isDiscountable: fromBool(row.is_discountable),
    isGiftcard: fromBool(row.is_giftcard),
    isTaxInclusive: fromBool(row.is_tax_inclusive),
    isCustomPrice: fromBool(row.is_custom_price),
    compareAtUnitPrice: row.compare_at_unit_price,
    metadata: fromJson(row.metadata),
    adjustments,
    taxLines,
  };
}

export function shippingMethodFromRow(
  row: ShippingMethodRow,
  adjustments: ShippingMethodAdjustment[],
  taxLines: ShippingMethodTaxLine[],
): ShippingMethod {
  return {
    id: row.id,
    name: row.name,
    amount: row.amount,
    description: fromJson(row.description),
    shippingOptionId: row.shipping_option_id,
    data: fromJson(row.data),
    isTaxInclusive: fromBool(row.is_tax_inclusive),
    metadata: fromJson(row.metadata),
    adjustments,
    taxLines,
  };
}

export function creditLineFromRow(row: CreditLineRow): CreditLine {
  return {
    id: row.id,
    amount: row.amount,
    reference: row.reference,
    referenceId: row.reference_id,
    metadata: fromJson(row.metadata),
  };
}

export function lineItemAdjustmentFromRow(
  row: LineItemAdjustmentRow,
): LineItemAdjustment {
  return {
    id: row.id,
    amount: row.amount,
    code: row.code,
    description: row.description,
    promotionId: row.promotion_id,
    providerId: row.provider_id,
    isTaxInclusive: fromBool(row.is_tax_inclusive),
    metadata: fromJson(row.metadata),
  };
}

export function lineItemTaxLineFromRow(
  row: LineItemTaxLineRow,
): LineItemTaxLine {
  return {
    id: row.id,
    code: row.code,
    rate: row.rate,
    description: row.description,
    providerId: row.provider_id,
    taxRateId: row.tax_rate_id,
    metadata: fromJson(row.metadata),
  };
}

export function shippingMethodAdjustmentFromRow(
  row: ShippingMethodAdjustmentRow,
): ShippingMethodAdjustment {
  return {
    id: row.id,
    amount: row.amount,
    code: row.code,
    description: row.description,
    promotionId: row.promotion_id,
    providerId: row.provider_id,
    metadata: fromJson(row.metadata),
  };
}

export function shippingMethodTaxLineFromRow(
  row: ShippingMethodTaxLineRow,
): ShippingMethodTaxLine {
  return {
    id: row.id,
    code: row.code,
    rate: row.rate,
    description: row.description,
    providerId: row.provider_id,
    taxRateId: row.tax_rate_id,
    metadata: fromJson(row.metadata),
  };
}
