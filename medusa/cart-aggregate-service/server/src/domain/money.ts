import Big from "big.js";

export type Money = string;

export const zero: Money = "0";

export function toMoney(value: unknown): Money {
  if (value === null || value === undefined) return "0";
  try {
    return new Big(String(value)).toString();
  } catch {
    throw new Error(`Invalid monetary value: ${String(value)}`);
  }
}

export function add(a: Money, b: Money): Money {
  return new Big(a).plus(new Big(b)).toString();
}

export function sub(a: Money, b: Money): Money {
  return new Big(a).minus(new Big(b)).toString();
}

export function mul(a: Money, n: number | string): Money {
  return new Big(a).times(new Big(String(n))).toString();
}

export function gte(a: Money, b: Money): boolean {
  return new Big(a).gte(new Big(b));
}

export function lt(a: Money, b: Money): boolean {
  return new Big(a).lt(new Big(b));
}

export function isNonNegative(a: Money): boolean {
  return new Big(a).gte(0);
}
