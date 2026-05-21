import { InvalidDataError } from "../errors.js";
import { isNonNegative, toMoney } from "../money.js";
import type {
  Address,
  CreditLine,
  LineItem,
  LineItemAdjustment,
  LineItemTaxLine,
  ShippingMethod,
  ShippingMethodAdjustment,
  ShippingMethodTaxLine,
} from "../types.js";

const required = (value: unknown, field: string): void => {
  if (value === undefined || value === null || value === "") {
    throw new InvalidDataError(`Field "${field}" is required`, field);
  }
};

export function assertCurrencyCode(code: unknown): string {
  required(code, "currencyCode");
  if (typeof code !== "string") {
    throw new InvalidDataError("currencyCode must be a string", "currencyCode");
  }
  const normalized = code.trim().toLowerCase();
  if (!/^[a-z]{3}$/.test(normalized)) {
    throw new InvalidDataError(
      "currencyCode must be a valid ISO-4217 3-letter code",
      "currencyCode",
    );
  }
  return normalized;
}

export function assertLineItem(
  input: Partial<LineItem>,
  context = "items",
): void {
  required(input.title, `${context}.title`);
  required(input.quantity, `${context}.quantity`);
  required(input.unitPrice, `${context}.unitPrice`);
  if (typeof input.title !== "string" || input.title.length === 0) {
    throw new InvalidDataError(
      "title must be a non-empty string",
      `${context}.title`,
    );
  }
  if (
    typeof input.quantity !== "number" ||
    !Number.isFinite(input.quantity) ||
    input.quantity <= 0
  ) {
    throw new InvalidDataError(
      "quantity must be a positive number",
      `${context}.quantity`,
    );
  }
  const unitPrice = toMoney(input.unitPrice);
  if (!isNonNegative(unitPrice)) {
    throw new InvalidDataError(
      "unitPrice must be a non-negative monetary value",
      `${context}.unitPrice`,
    );
  }
}

export function assertShippingMethod(
  input: Partial<ShippingMethod>,
  context = "shippingMethods",
): void {
  required(input.name, `${context}.name`);
  required(input.amount, `${context}.amount`);
  if (typeof input.name !== "string" || input.name.length === 0) {
    throw new InvalidDataError(
      "name must be a non-empty string",
      `${context}.name`,
    );
  }
  const amount = toMoney(input.amount);
  if (!isNonNegative(amount)) {
    throw new InvalidDataError(
      "amount must be greater than or equal to 0",
      `${context}.amount`,
    );
  }
}

export function assertLineItemAdjustment(
  input: Partial<LineItemAdjustment>,
  context = "adjustments",
): void {
  required(input.amount, `${context}.amount`);
  const amount = toMoney(input.amount);
  if (!isNonNegative(amount)) {
    throw new InvalidDataError(
      "adjustment amount must be greater than or equal to 0",
      `${context}.amount`,
    );
  }
}

export function assertShippingMethodAdjustment(
  input: Partial<ShippingMethodAdjustment>,
  context = "adjustments",
): void {
  required(input.amount, `${context}.amount`);
  const amount = toMoney(input.amount);
  if (!isNonNegative(amount)) {
    throw new InvalidDataError(
      "adjustment amount must be greater than or equal to 0",
      `${context}.amount`,
    );
  }
}

export function assertLineItemTaxLine(
  input: Partial<LineItemTaxLine>,
  context = "taxLines",
): void {
  required(input.code, `${context}.code`);
  required(input.rate, `${context}.rate`);
}

export function assertShippingMethodTaxLine(
  input: Partial<ShippingMethodTaxLine>,
  context = "taxLines",
): void {
  required(input.code, `${context}.code`);
  required(input.rate, `${context}.rate`);
}

export function assertCreditLine(
  input: Partial<CreditLine>,
  context = "creditLines",
): void {
  required(input.amount, `${context}.amount`);
  // CreditLine amounts may be negative (surcharge), so no non-negative check.
  toMoney(input.amount);
}

export function normalizeAddress(input: Partial<Address> | null | undefined): Address | null {
  if (input === null || input === undefined) return null;
  return {
    firstName: input.firstName ?? null,
    lastName: input.lastName ?? null,
    company: input.company ?? null,
    address1: input.address1 ?? null,
    address2: input.address2 ?? null,
    city: input.city ?? null,
    province: input.province ?? null,
    postalCode: input.postalCode ?? null,
    countryCode: input.countryCode ?? null,
    phone: input.phone ?? null,
    customerId: input.customerId ?? null,
    metadata: (input.metadata as Address["metadata"]) ?? null,
  };
}
