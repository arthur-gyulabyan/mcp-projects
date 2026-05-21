import React from "react";

export const formatMoney = (value: string, currency: string): string => {
  const n = Number(value);
  if (!Number.isFinite(n)) return value;
  try {
    return new Intl.NumberFormat(undefined, {
      style: "currency",
      currency: currency.toUpperCase(),
      maximumFractionDigits: 2,
    }).format(n);
  } catch {
    return `${value} ${currency.toUpperCase()}`;
  }
};

export const Money: React.FC<{ amount: string; currency: string; muted?: boolean; strike?: boolean }> = ({
  amount,
  currency,
  muted,
  strike,
}) => (
  <span
    className={
      (muted ? "text-slate-500 " : "") + (strike ? "line-through " : "") + "tabular-nums"
    }
  >
    {formatMoney(amount, currency)}
  </span>
);
