import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api, type CartSummary } from "../api/client.js";
import { formatMoney } from "../components/Money.js";

export const CartList: React.FC = () => {
  const [carts, setCarts] = useState<CartSummary[]>([]);
  const [customerId, setCustomerId] = useState("");
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const list = await api.listCarts({
        customerId: customerId || undefined,
        email: email || undefined,
      });
      setCarts(list);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-semibold text-slate-900">Carts</h1>
        <p className="text-sm text-slate-600">
          Browse all carts. Use the filters to narrow by customer or email.
        </p>
      </div>
      <div className="card p-4">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            void load();
          }}
          className="grid grid-cols-1 md:grid-cols-4 gap-3 items-end"
        >
          <div>
            <label className="label">Customer ID</label>
            <input
              className="input"
              value={customerId}
              onChange={(e) => setCustomerId(e.target.value)}
              placeholder="cus_…"
            />
          </div>
          <div>
            <label className="label">Email</label>
            <input
              className="input"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="alice@example.com"
            />
          </div>
          <button type="submit" className="btn-primary" disabled={loading}>
            {loading ? "Loading…" : "Apply filters"}
          </button>
          <button
            type="button"
            className="btn-secondary"
            onClick={() => {
              setCustomerId("");
              setEmail("");
              setTimeout(() => void load(), 0);
            }}
          >
            Clear
          </button>
        </form>
      </div>

      {error && (
        <div className="card p-3 text-sm text-rose-700 bg-rose-50 border-rose-200">
          {error}
        </div>
      )}

      <div className="card overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-slate-600 text-xs uppercase tracking-wide">
            <tr>
              <th className="text-left px-4 py-2">Cart ID</th>
              <th className="text-left px-4 py-2">Customer</th>
              <th className="text-left px-4 py-2">Email</th>
              <th className="text-left px-4 py-2">Updated</th>
              <th className="text-right px-4 py-2">Total</th>
              <th className="text-right px-4 py-2"></th>
            </tr>
          </thead>
          <tbody>
            {carts.length === 0 ? (
              <tr>
                <td colSpan={6} className="text-center text-slate-500 py-6">
                  No carts to show.
                </td>
              </tr>
            ) : (
              carts.map((c) => (
                <tr key={c.id} className="border-t border-slate-100">
                  <td className="px-4 py-2 font-mono text-xs">{c.id}</td>
                  <td className="px-4 py-2">{c.customerId ?? "—"}</td>
                  <td className="px-4 py-2">{c.email ?? "—"}</td>
                  <td className="px-4 py-2 text-slate-500 text-xs">
                    {new Date(c.updatedAt).toLocaleString()}
                  </td>
                  <td className="px-4 py-2 text-right">
                    {formatMoney(c.total, c.currencyCode)}
                  </td>
                  <td className="px-4 py-2 text-right">
                    <Link
                      to={`/carts/${c.id}`}
                      className="text-brand-600 font-medium hover:underline"
                    >
                      Open →
                    </Link>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};
