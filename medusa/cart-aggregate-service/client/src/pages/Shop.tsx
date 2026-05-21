import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api, type CartView, type CartSummary } from "../api/client.js";
import { catalog, type CatalogProduct } from "../catalog.js";
import { formatMoney, Money } from "../components/Money.js";
import { useToast } from "../context/Toast.js";
import { useRole } from "../context/RoleContext.js";

const ACTIVE_CART_KEY = "cart-active-id";

export const Shop: React.FC = () => {
  const navigate = useNavigate();
  const toast = useToast();
  const { role } = useRole();
  const [activeCart, setActiveCart] = useState<CartView | null>(null);
  const [recentCarts, setRecentCarts] = useState<CartSummary[]>([]);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    void loadActive();
    void loadRecent();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [role]);

  async function loadActive() {
    const stored = localStorage.getItem(ACTIVE_CART_KEY);
    if (!stored) return;
    try {
      const cart = await api.getCart(stored);
      setActiveCart(cart);
    } catch {
      localStorage.removeItem(ACTIVE_CART_KEY);
    }
  }

  async function loadRecent() {
    try {
      const list = await api.listCarts();
      setRecentCarts(list.slice(0, 6));
    } catch (e) {
      console.warn(e);
    }
  }

  async function ensureCart(): Promise<CartView> {
    if (activeCart) return activeCart;
    const cart = await api.createCart({
      currencyCode: "EUR",
      email: "demo@cart-aggregate.test",
      locale: "en-US",
    });
    localStorage.setItem(ACTIVE_CART_KEY, cart.id);
    setActiveCart(cart);
    toast.success(`New cart created (${cart.id.slice(0, 12)}…)`);
    return cart;
  }

  async function addToCart(product: CatalogProduct) {
    if (role !== "Customer") {
      toast.error("Only the Customer role can add items to a cart");
      return;
    }
    setBusy(true);
    try {
      const cart = await ensureCart();
      const updated = await api.addLineItem(cart.id, [
        {
          title: product.productTitle,
          quantity: 1,
          unitPrice: product.unitPrice,
          productId: product.productId,
          productHandle: product.productHandle,
          productTitle: product.productTitle,
          productDescription: product.productDescription,
          productType: product.productType,
          productCollection: product.productCollection,
          variantId: product.variantId,
          variantSku: product.variantSku,
          variantTitle: product.variantTitle,
          thumbnail: product.thumbnail,
          compareAtUnitPrice: product.compareAtUnitPrice ?? null,
          isGiftcard: product.isGiftcard ?? false,
          requiresShipping: product.requiresShipping ?? true,
        },
      ]);
      setActiveCart(updated);
      toast.success(`Added "${product.productTitle}" to cart`);
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      <div className="lg:col-span-2 space-y-4">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">Shop</h1>
          <p className="text-sm text-slate-600">
            Build a cart, then drive it through the full aggregate from the cart
            detail view.
          </p>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {catalog.map((p) => (
            <ProductCard
              key={p.productId}
              product={p}
              currency={activeCart?.currencyCode ?? "EUR"}
              disabled={busy || role !== "Customer"}
              onAdd={() => addToCart(p)}
            />
          ))}
        </div>
      </div>

      <aside className="space-y-4">
        <div className="card p-5">
          <h2 className="font-semibold text-slate-900 mb-2">Your cart</h2>
          {!activeCart ? (
            <div>
              <p className="text-sm text-slate-600 mb-3">No active cart yet.</p>
              <button
                className="btn-primary w-full"
                disabled={role !== "Customer" || busy}
                onClick={() => void ensureCart()}
              >
                Create cart
              </button>
              {role !== "Customer" && (
                <p className="text-xs text-amber-700 mt-2">
                  Switch to the <b>Customer</b> role to create a cart.
                </p>
              )}
            </div>
          ) : (
            <div className="space-y-3">
              <div className="text-xs text-slate-500 font-mono">
                {activeCart.id}
              </div>
              <ul className="space-y-2 max-h-60 overflow-auto">
                {activeCart.items.length === 0 && (
                  <li className="text-sm text-slate-500">Empty</li>
                )}
                {activeCart.items.map((it) => (
                  <li
                    key={it.id}
                    className="flex items-center gap-3 border-b border-slate-100 pb-2 last:border-0"
                  >
                    {it.thumbnail && (
                      <img
                        src={it.thumbnail}
                        alt=""
                        className="w-10 h-10 rounded-md object-cover"
                      />
                    )}
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium truncate">
                        {it.title}
                      </div>
                      <div className="text-xs text-slate-500">
                        × {it.quantity} ·{" "}
                        {formatMoney(it.unitPrice, activeCart.currencyCode)}
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
              <div className="border-t border-slate-200 pt-3 space-y-1 text-sm">
                <Line
                  label="Subtotal"
                  value={
                    <Money
                      amount={activeCart.totals.subtotal}
                      currency={activeCart.currencyCode}
                    />
                  }
                />
                <Line
                  label="Discounts"
                  muted
                  value={
                    <Money
                      amount={activeCart.totals.discountTotal}
                      currency={activeCart.currencyCode}
                    />
                  }
                />
                <Line
                  label="Tax"
                  muted
                  value={
                    <Money
                      amount={activeCart.totals.taxTotal}
                      currency={activeCart.currencyCode}
                    />
                  }
                />
                <Line
                  label="Total"
                  bold
                  value={
                    <Money
                      amount={activeCart.totals.total}
                      currency={activeCart.currencyCode}
                    />
                  }
                />
              </div>
              <button
                className="btn-primary w-full"
                onClick={() => navigate(`/carts/${activeCart.id}`)}
              >
                Open cart detail →
              </button>
            </div>
          )}
        </div>

        <div className="card p-5">
          <h2 className="font-semibold text-slate-900 mb-2">Recent carts</h2>
          {recentCarts.length === 0 ? (
            <p className="text-sm text-slate-500">No carts yet.</p>
          ) : (
            <ul className="space-y-1">
              {recentCarts.map((c) => (
                <li key={c.id}>
                  <button
                    onClick={() => navigate(`/carts/${c.id}`)}
                    className="w-full text-left px-2 py-1.5 rounded-md hover:bg-slate-100 flex justify-between items-center"
                  >
                    <span className="text-xs font-mono text-slate-700 truncate">
                      {c.id.slice(0, 22)}…
                    </span>
                    <span className="text-xs text-slate-500">
                      {formatMoney(c.total, c.currencyCode)}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </aside>
    </div>
  );
};

const Line: React.FC<{
  label: string;
  value: React.ReactNode;
  muted?: boolean;
  bold?: boolean;
}> = ({ label, value, muted, bold }) => (
  <div className="flex justify-between items-center">
    <span className={(muted ? "text-slate-500 " : "text-slate-700 ") + (bold ? "font-semibold" : "")}>
      {label}
    </span>
    <span className={bold ? "font-semibold text-slate-900" : "text-slate-700"}>
      {value}
    </span>
  </div>
);

const ProductCard: React.FC<{
  product: CatalogProduct;
  currency: string;
  disabled?: boolean;
  onAdd: () => void;
}> = ({ product, currency, disabled, onAdd }) => (
  <div className="card overflow-hidden flex flex-col">
    <img
      src={product.thumbnail}
      alt={product.productTitle}
      className="w-full h-40 object-cover"
    />
    <div className="p-4 flex flex-col flex-1">
      <div className="text-xs text-slate-500">{product.productType}</div>
      <h3 className="font-medium text-slate-900 mt-1">{product.productTitle}</h3>
      <p className="text-xs text-slate-500 line-clamp-2 mt-1 flex-1">
        {product.productDescription}
      </p>
      <div className="mt-3 flex items-end justify-between gap-2">
        <div>
          <Money amount={product.unitPrice} currency={currency} />
          {product.compareAtUnitPrice && (
            <span className="ml-2 text-xs">
              <Money
                amount={product.compareAtUnitPrice}
                currency={currency}
                muted
                strike
              />
            </span>
          )}
        </div>
        <button
          className="btn-primary text-xs px-2 py-1.5"
          disabled={disabled}
          onClick={onAdd}
        >
          Add to cart
        </button>
      </div>
    </div>
  </div>
);
