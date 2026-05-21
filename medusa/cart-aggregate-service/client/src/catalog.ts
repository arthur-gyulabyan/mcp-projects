export interface CatalogProduct {
  productId: string;
  productHandle: string;
  productTitle: string;
  productDescription: string;
  productType: string;
  productCollection: string;
  variantId: string;
  variantSku: string;
  variantTitle: string;
  unitPrice: string;
  compareAtUnitPrice?: string;
  thumbnail: string;
  isDiscountable?: boolean;
  isGiftcard?: boolean;
  requiresShipping?: boolean;
}

const img = (seed: string) => `https://picsum.photos/seed/${seed}/600/450`;

export const catalog: CatalogProduct[] = [
  {
    productId: "prod_wool_sweater",
    productHandle: "wool-sweater",
    productTitle: "Merino Wool Sweater",
    productDescription:
      "Beautifully soft merino wool, knit in Portugal. Cut for an effortless layered look.",
    productType: "Apparel",
    productCollection: "Winter 2026",
    variantId: "var_wool_m",
    variantSku: "WS-M-CHAR",
    variantTitle: "Size M / Charcoal",
    unitPrice: "129",
    compareAtUnitPrice: "169",
    thumbnail: img("wool-sweater"),
  },
  {
    productId: "prod_leather_belt",
    productHandle: "leather-belt",
    productTitle: "Italian Leather Belt",
    productDescription:
      "Vegetable-tanned leather with a hand-burnished brass buckle. Built to outlast the trend cycle.",
    productType: "Accessory",
    productCollection: "Essentials",
    variantId: "var_belt_l",
    variantSku: "LB-L-COG",
    variantTitle: "Size L / Cognac",
    unitPrice: "89",
    thumbnail: img("leather-belt"),
  },
  {
    productId: "prod_cotton_tee",
    productHandle: "cotton-tee",
    productTitle: "Heavyweight Cotton Tee",
    productDescription:
      "240gsm long-staple cotton — the kind of t-shirt you reach for first.",
    productType: "Apparel",
    productCollection: "Essentials",
    variantId: "var_tee_m_white",
    variantSku: "CT-M-WHT",
    variantTitle: "Size M / Optic White",
    unitPrice: "45",
    thumbnail: img("cotton-tee"),
  },
  {
    productId: "prod_chelsea_boot",
    productHandle: "chelsea-boot",
    productTitle: "Goodyear-Welted Chelsea Boot",
    productDescription:
      "Resoleable, water-resistant, made the slow way in Northampton.",
    productType: "Footwear",
    productCollection: "Winter 2026",
    variantId: "var_boot_42",
    variantSku: "CB-42-BLK",
    variantTitle: "EU 42 / Black",
    unitPrice: "349",
    compareAtUnitPrice: "399",
    thumbnail: img("chelsea-boot"),
  },
  {
    productId: "prod_canvas_tote",
    productHandle: "canvas-tote",
    productTitle: "18oz Canvas Tote",
    productDescription:
      "Built to carry more than it should. Reinforced base, riveted handles.",
    productType: "Bag",
    productCollection: "Essentials",
    variantId: "var_tote_natural",
    variantSku: "CV-T-NAT",
    variantTitle: "Natural",
    unitPrice: "39",
    thumbnail: img("canvas-tote"),
  },
  {
    productId: "prod_gift_card",
    productHandle: "gift-card",
    productTitle: "Gift Card — €50",
    productDescription: "Delivered instantly by email. Never expires.",
    productType: "Gift Card",
    productCollection: "Gift Cards",
    variantId: "var_gc_50",
    variantSku: "GC-50",
    variantTitle: "€50",
    unitPrice: "50",
    thumbnail: img("gift-card"),
    isGiftcard: true,
    requiresShipping: false,
  },
];

export const shippingOptions = [
  {
    shippingOptionId: "so_std",
    name: "Standard (3-5 days)",
    amount: "5",
  },
  {
    shippingOptionId: "so_exp",
    name: "Express (1-2 days)",
    amount: "15",
  },
  {
    shippingOptionId: "so_overnight",
    name: "Overnight",
    amount: "35",
  },
];

export const sampleCoupons = [
  { code: "WELCOME10", description: "10% off your first order", amount: "10" },
  { code: "VIP25", description: "VIP discount", amount: "25" },
  { code: "FLASH50", description: "Flash sale", amount: "50" },
];
