import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api, type CartSummary } from "../api/client.js";
import { formatMoney } from "../components/Money.js";

export const AutomationInbox: React.FC = () => {
  const [carts, setCarts] = useState<CartSummary[]>([]);

  useEffect(() => {
    void api.listCarts().then(setCarts);
  }, []);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-slate-900">
          Automation · Pricing inbox
        </h1>
        <p className="text-sm text-slate-600">
          Apply promotions, taxes, and credit lines against any cart. All
          operations use the model's set-replacement semantics.
        </p>
      </div>
      <div className="card overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-xs uppercase text-slate-500">
            <tr>
              <th className="text-left px-4 py-2">Cart</th>
              <th className="text-left px-4 py-2">Customer</th>
              <th className="text-right px-4 py-2">Items</th>
              <th className="text-right px-4 py-2">Shipping</th>
              <th className="text-right px-4 py-2">Total</th>
              <th className="text-right px-4 py-2"></th>
            </tr>
          </thead>
          <tbody>
            {carts.map((c) => (
              <tr key={c.id} className="border-t border-slate-100">
                <td className="px-4 py-2 font-mono text-xs">{c.id}</td>
                <td className="px-4 py-2">{c.email ?? c.customerId ?? "—"}</td>
                <td className="px-4 py-2 text-right">{formatMoney(c.subtotal, c.currencyCode)}</td>
                <td className="px-4 py-2 text-right text-slate-500 text-xs">—</td>
                <td className="px-4 py-2 text-right font-medium">{formatMoney(c.total, c.currencyCode)}</td>
                <td className="px-4 py-2 text-right">
                  <Link to={`/carts/${c.id}`} className="text-brand-600 text-xs hover:underline">
                    Open
                  </Link>
                </td>
              </tr>
            ))}
            {carts.length === 0 && (
              <tr>
                <td colSpan={6} className="text-center text-slate-500 py-6">
                  No carts in queue.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};
