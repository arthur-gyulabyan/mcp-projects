import Big from "big.js";
import { add, mul, sub, toMoney, zero, type Money } from "../../domain/money.js";
import type {
  Cart,
  LineItem,
  LineItemAdjustment,
  LineItemTaxLine,
  ShippingMethod,
  ShippingMethodAdjustment,
  ShippingMethodTaxLine,
} from "../../domain/types.js";

export interface LineItemProjection extends LineItem {
  subtotal: Money;
  total: Money;
  taxTotal: Money;
  discountTotal: Money;
  discountTaxTotal: Money;
  originalTotal: Money;
  originalSubtotal: Money;
  originalTaxTotal: Money;
  itemTotal: Money;
  itemSubtotal: Money;
  itemTaxTotal: Money;
}

export interface ShippingMethodProjection extends ShippingMethod {
  subtotal: Money;
  total: Money;
  taxTotal: Money;
  discountTotal: Money;
  discountTaxTotal: Money;
  originalTotal: Money;
  originalSubtotal: Money;
  originalTaxTotal: Money;
}

export interface CartTotals {
  itemTotal: Money;
  itemSubtotal: Money;
  itemTaxTotal: Money;
  originalItemTotal: Money;
  originalItemSubtotal: Money;
  originalItemTaxTotal: Money;
  shippingTotal: Money;
  shippingSubtotal: Money;
  shippingTaxTotal: Money;
  originalShippingTotal: Money;
  originalShippingSubtotal: Money;
  originalShippingTaxTotal: Money;
  discountTotal: Money;
  discountTaxTotal: Money;
  taxTotal: Money;
  subtotal: Money;
  total: Money;
  originalTotal: Money;
  originalSubtotal: Money;
  originalTaxTotal: Money;
  giftCardTotal: Money;
  giftCardTaxTotal: Money;
  creditLineTotal: Money;
  creditLineSubtotal: Money;
  creditLineTaxTotal: Money;
}

export interface CartView extends Omit<Cart, "items" | "shippingMethods"> {
  items: LineItemProjection[];
  shippingMethods: ShippingMethodProjection[];
  totals: CartTotals;
}

function sumAdjustments(
  adjustments: LineItemAdjustment[] | ShippingMethodAdjustment[] | undefined,
): Money {
  let sum: Money = zero;
  for (const adj of adjustments ?? []) sum = add(sum, toMoney(adj.amount));
  return sum;
}

function computeTaxAmount(
  baseAmount: Money,
  taxLines: LineItemTaxLine[] | ShippingMethodTaxLine[] | undefined,
): Money {
  let total: Money = zero;
  for (const tl of taxLines ?? []) {
    const ratePct = new Big(String(tl.rate)).div(100);
    const tax = new Big(baseAmount).times(ratePct).toString();
    total = add(total, tax);
  }
  return total;
}

function clampToZero(v: Money): Money {
  return new Big(v).gte(0) ? v : zero;
}

function projectLineItem(item: LineItem): LineItemProjection {
  const lineRaw: Money = mul(toMoney(item.unitPrice), item.quantity);
  const discount = sumAdjustments(item.adjustments);
  const subtotalAfterDiscount = clampToZero(sub(lineRaw, discount));
  const tax = computeTaxAmount(subtotalAfterDiscount, item.taxLines);
  const originalTax = computeTaxAmount(lineRaw, item.taxLines);

  return {
    ...item,
    subtotal: subtotalAfterDiscount,
    total: add(subtotalAfterDiscount, tax),
    taxTotal: tax,
    discountTotal: discount,
    discountTaxTotal: sub(originalTax, tax),
    originalTotal: add(lineRaw, originalTax),
    originalSubtotal: lineRaw,
    originalTaxTotal: originalTax,
    itemTotal: subtotalAfterDiscount,
    itemSubtotal: subtotalAfterDiscount,
    itemTaxTotal: tax,
  };
}

function projectShippingMethod(method: ShippingMethod): ShippingMethodProjection {
  const rawAmount = toMoney(method.amount);
  const discount = sumAdjustments(method.adjustments);
  const subtotalAfterDiscount = clampToZero(sub(rawAmount, discount));
  const tax = computeTaxAmount(subtotalAfterDiscount, method.taxLines);
  const originalTax = computeTaxAmount(rawAmount, method.taxLines);
  return {
    ...method,
    subtotal: subtotalAfterDiscount,
    total: add(subtotalAfterDiscount, tax),
    taxTotal: tax,
    discountTotal: discount,
    discountTaxTotal: sub(originalTax, tax),
    originalTotal: add(rawAmount, originalTax),
    originalSubtotal: rawAmount,
    originalTaxTotal: originalTax,
  };
}

export function computeCartView(cart: Cart): CartView {
  const items = cart.items.map(projectLineItem);
  const shippingMethods = cart.shippingMethods.map(projectShippingMethod);

  const itemSubtotalRaw = items.reduce((acc, i) => add(acc, i.subtotal), zero);
  const itemTaxTotal = items.reduce((acc, i) => add(acc, i.taxTotal), zero);
  const itemTotal = items.reduce((acc, i) => add(acc, i.subtotal), zero);
  const originalItemSubtotal = items.reduce(
    (acc, i) => add(acc, i.originalSubtotal),
    zero,
  );
  const originalItemTaxTotal = items.reduce(
    (acc, i) => add(acc, i.originalTaxTotal),
    zero,
  );
  const originalItemTotal = add(originalItemSubtotal, originalItemTaxTotal);

  const shippingSubtotal = shippingMethods.reduce(
    (acc, s) => add(acc, s.subtotal),
    zero,
  );
  const shippingTaxTotal = shippingMethods.reduce(
    (acc, s) => add(acc, s.taxTotal),
    zero,
  );
  const shippingTotal = shippingSubtotal;
  const originalShippingSubtotal = shippingMethods.reduce(
    (acc, s) => add(acc, s.originalSubtotal),
    zero,
  );
  const originalShippingTaxTotal = shippingMethods.reduce(
    (acc, s) => add(acc, s.originalTaxTotal),
    zero,
  );
  const originalShippingTotal = add(
    originalShippingSubtotal,
    originalShippingTaxTotal,
  );

  const itemsDiscount = items.reduce((acc, i) => add(acc, i.discountTotal), zero);
  const shippingDiscount = shippingMethods.reduce(
    (acc, s) => add(acc, s.discountTotal),
    zero,
  );
  const discountTotal = add(itemsDiscount, shippingDiscount);
  const itemsDiscountTax = items.reduce(
    (acc, i) => add(acc, i.discountTaxTotal),
    zero,
  );
  const shippingDiscountTax = shippingMethods.reduce(
    (acc, s) => add(acc, s.discountTaxTotal),
    zero,
  );
  const discountTaxTotal = add(itemsDiscountTax, shippingDiscountTax);

  const taxTotal = add(itemTaxTotal, shippingTaxTotal);
  // subtotal is the pre-discount, pre-tax sum of raw line + shipping subtotals
  // (matches the documented GWT: items 500 + shipping 10 => subtotal 510).
  const subtotal = add(originalItemSubtotal, originalShippingSubtotal);

  const giftCardTotal = cart.items.reduce((acc, i) => {
    if (!i.isGiftcard) return acc;
    return add(acc, mul(toMoney(i.unitPrice), i.quantity));
  }, zero as Money);

  const creditLineTotal = cart.creditLines.reduce(
    (acc, cl) => add(acc, toMoney(cl.amount)),
    zero as Money,
  );

  // Final payable amount: subtotal (pre-discount) − discounts + tax − credit lines.
  const total = sub(
    sub(add(subtotal, taxTotal), discountTotal),
    creditLineTotal,
  );

  const totals: CartTotals = {
    itemTotal,
    itemSubtotal: itemSubtotalRaw,
    itemTaxTotal,
    originalItemTotal,
    originalItemSubtotal,
    originalItemTaxTotal,
    shippingTotal,
    shippingSubtotal,
    shippingTaxTotal,
    originalShippingTotal,
    originalShippingSubtotal,
    originalShippingTaxTotal,
    discountTotal,
    discountTaxTotal,
    taxTotal,
    subtotal,
    total,
    originalTotal: add(originalItemTotal, originalShippingTotal),
    originalSubtotal: add(originalItemSubtotal, originalShippingSubtotal),
    originalTaxTotal: add(originalItemTaxTotal, originalShippingTaxTotal),
    giftCardTotal,
    giftCardTaxTotal: zero,
    creditLineTotal,
    creditLineSubtotal: creditLineTotal,
    creditLineTaxTotal: zero,
  };

  return {
    ...cart,
    items,
    shippingMethods,
    totals,
  };
}
