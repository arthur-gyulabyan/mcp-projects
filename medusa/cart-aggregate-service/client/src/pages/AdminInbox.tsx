import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api, type CartSummary } from "../api/client.js";
import { formatMoney } from "../components/Money.js";
import { useToast } from "../context/Toast.js";

export const AdminInbox: React.FC = () => {
  const [carts, setCarts] = useState<CartSummary[]>([]);
  const [deleted, setDeleted] = useState<CartSummary[]>([]);
  const toast = useToast();
  const [busy, setBusy] = useState(false);

  async function load() {
    try {
      setCarts(await api.listCarts());
      setDeleted(await api.listCarts({ includeDeleted: "true" }));
    } catch (e) {
      toast.error((e as Error).message);
    }
  }
  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const onlyDeleted = deleted.filter((d) => d.deletedAt);

  async function handleDelete(id: string) {
    if (!confirm("Soft-delete this cart?")) return;
    setBusy(true);
    try {
      await api.deleteCart(id);
      toast.success("Cart deleted");
      await load();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function handleRestore(id: string) {
    setBusy(true);
    try {
      await api.restoreCart(id);
      toast.success("Cart restored");
      await load();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-slate-900">Admin · Inbox</h1>
        <p className="text-sm text-slate-600">
          Manage active and soft-deleted carts.
        </p>
      </div>
      <div className="card overflow-hidden">
        <div className="px-4 py-3 border-b border-slate-200 font-semibold">
          Active carts ({carts.length})
        </div>
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-xs uppercase text-slate-500">
            <tr>
              <th className="text-left px-4 py-2">Cart</th>
              <th className="text-left px-4 py-2">Customer</th>
              <th className="text-right px-4 py-2">Total</th>
              <th className="text-right px-4 py-2"></th>
            </tr>
          </thead>
          <tbody>
            {carts.map((c) => (
              <tr key={c.id} className="border-t border-slate-100">
                <td className="px-4 py-2 font-mono text-xs">{c.id}</td>
                <td className="px-4 py-2">{c.email ?? c.customerId ?? "—"}</td>
                <td className="px-4 py-2 text-right">{formatMoney(c.total, c.currencyCode)}</td>
                <td className="px-4 py-2 text-right space-x-2">
                  <Link to={`/carts/${c.id}`} className="text-brand-600 text-xs hover:underline">
                    Open
                  </Link>
                  <button
                    className="btn-danger text-xs"
                    onClick={() => handleDelete(c.id)}
                    disabled={busy}
                  >
                    Delete
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="card overflow-hidden">
        <div className="px-4 py-3 border-b border-slate-200 font-semibold">
          Soft-deleted carts ({onlyDeleted.length})
        </div>
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-xs uppercase text-slate-500">
            <tr>
              <th className="text-left px-4 py-2">Cart</th>
              <th className="text-left px-4 py-2">Customer</th>
              <th className="text-left px-4 py-2">Deleted</th>
              <th className="text-right px-4 py-2"></th>
            </tr>
          </thead>
          <tbody>
            {onlyDeleted.length === 0 ? (
              <tr>
                <td colSpan={4} className="text-center text-slate-500 py-6">
                  Nothing in the trash.
                </td>
              </tr>
            ) : (
              onlyDeleted.map((c) => (
                <tr key={c.id} className="border-t border-slate-100">
                  <td className="px-4 py-2 font-mono text-xs">{c.id}</td>
                  <td className="px-4 py-2">{c.email ?? c.customerId ?? "—"}</td>
                  <td className="px-4 py-2 text-slate-500 text-xs">
                    {c.deletedAt ? new Date(c.deletedAt).toLocaleString() : ""}
                  </td>
                  <td className="px-4 py-2 text-right">
                    <button
                      className="btn-primary text-xs"
                      onClick={() => handleRestore(c.id)}
                      disabled={busy}
                    >
                      Restore
                    </button>
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
