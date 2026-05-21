import React, { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { api, type CartView, type LineItemView, type ShippingMethodView } from "../api/client.js";
import { formatMoney, Money } from "../components/Money.js";
import { Modal } from "../components/Modal.js";
import { AddressForm } from "../components/AddressForm.js";
import { useToast } from "../context/Toast.js";
import { useRole } from "../context/RoleContext.js";
import { sampleCoupons, shippingOptions } from "../catalog.js";

export const CartDetail: React.FC = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { role } = useRole();
  const toast = useToast();
  const [cart, setCart] = useState<CartView | null>(null);
  const [busy, setBusy] = useState(false);
  const [showShipping, setShowShipping] = useState(false);
  const [showBilling, setShowBilling] = useState(false);

  useEffect(() => {
    if (!id) return;
    void reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  async function reload() {
    if (!id) return;
    try {
      const view = await api.getCart(id);
      setCart(view);
    } catch (e) {
      toast.error((e as Error).message);
    }
  }

  async function run<T>(label: string, fn: () => Promise<T>): Promise<T | null> {
    setBusy(true);
    try {
      const result = await fn();
      toast.success(label);
      await reload();
      return result;
    } catch (e) {
      toast.error((e as Error).message);
      return null;
    } finally {
      setBusy(false);
    }
  }

  if (!cart) {
    return (
      <div className="card p-6 text-sm text-slate-600">Loading cart…</div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">Cart detail</h1>
          <div className="text-xs text-slate-500 font-mono mt-1">{cart.id}</div>
          <div className="flex gap-2 mt-2">
            <span className="badge-blue">{cart.currencyCode.toUpperCase()}</span>
            {cart.deletedAt && <span className="badge-amber">Soft-deleted</span>}
            {cart.completedAt && <span className="badge-green">Completed</span>}
            <span className="badge-slate">v{cart.version}</span>
          </div>
        </div>
        <div className="flex gap-2 flex-wrap justify-end">
          <button
            className="btn-secondary"
            onClick={() => navigate("/")}
          >
            Continue shopping
          </button>
          {role === "Admin" &&
            (cart.deletedAt ? (
              <button
                className="btn-primary"
                disabled={busy}
                onClick={() =>
                  run("Cart restored", () => api.restoreCart(cart.id))
                }
              >
                Restore cart
              </button>
            ) : (
              <button
                className="btn-danger"
                disabled={busy}
                onClick={() => {
                  if (confirm("Soft-delete this cart?")) {
                    void run("Cart deleted", () => api.deleteCart(cart.id));
                  }
                }}
              >
                Delete cart
              </button>
            ))}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          {/* Cart header */}
          <CartHeaderSection
            cart={cart}
            busy={busy}
            role={role}
            onSaved={() => run("Cart updated", () => Promise.resolve())}
            run={run}
          />

          {/* Line items */}
          <LineItemsSection cart={cart} busy={busy} role={role} run={run} />

          {/* Shipping methods */}
          <ShippingMethodsSection cart={cart} busy={busy} role={role} run={run} />

          {/* Automation panels */}
          {role === "Automation" && (
            <>
              <AdjustmentsSection cart={cart} busy={busy} run={run} />
              <TaxLinesSection cart={cart} busy={busy} run={run} />
              <CreditLinesSection cart={cart} busy={busy} run={run} />
            </>
          )}
        </div>

        {/* Sidebar: addresses + totals */}
        <aside className="space-y-4">
          <div className="card p-5 space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold text-slate-900">Shipping address</h3>
              {role === "Customer" && (
                <button
                  className="text-xs text-brand-600 hover:underline"
                  onClick={() => setShowShipping(true)}
                >
                  {cart.shippingAddress ? "Edit" : "Set"}
                </button>
              )}
            </div>
            <AddressSummary value={cart.shippingAddress} />
          </div>
          <div className="card p-5 space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold text-slate-900">Billing address</h3>
              {role === "Customer" && (
                <button
                  className="text-xs text-brand-600 hover:underline"
                  onClick={() => setShowBilling(true)}
                >
                  {cart.billingAddress ? "Edit" : "Set"}
                </button>
              )}
            </div>
            <AddressSummary value={cart.billingAddress} />
          </div>

          <div className="card p-5 space-y-2 text-sm">
            <h3 className="font-semibold text-slate-900 mb-2">Totals</h3>
            <Row label="Subtotal" value={<Money amount={cart.totals.subtotal} currency={cart.currencyCode} />} />
            <Row label="Discounts" muted value={<Money amount={cart.totals.discountTotal} currency={cart.currencyCode} />} />
            <Row label="Tax" muted value={<Money amount={cart.totals.taxTotal} currency={cart.currencyCode} />} />
            <Row label="Shipping" muted value={<Money amount={cart.totals.shippingTotal} currency={cart.currencyCode} />} />
            <Row label="Credit lines" muted value={<Money amount={cart.totals.creditLineTotal} currency={cart.currencyCode} />} />
            <div className="border-t border-slate-200 pt-2">
              <Row label="Total" bold value={<Money amount={cart.totals.total} currency={cart.currencyCode} />} />
            </div>
          </div>
        </aside>
      </div>

      <Modal
        open={showShipping}
        onClose={() => setShowShipping(false)}
        title="Set shipping address"
      >
        <AddressForm
          initial={cart.shippingAddress}
          submitting={busy}
          onSubmit={async (a) => {
            const result = await run("Shipping address set", () =>
              api.setShippingAddress(cart.id, a),
            );
            if (result) setShowShipping(false);
          }}
        />
      </Modal>
      <Modal
        open={showBilling}
        onClose={() => setShowBilling(false)}
        title="Set billing address"
      >
        <AddressForm
          initial={cart.billingAddress}
          submitting={busy}
          onSubmit={async (a) => {
            const result = await run("Billing address set", () =>
              api.setBillingAddress(cart.id, a),
            );
            if (result) setShowBilling(false);
          }}
        />
      </Modal>
    </div>
  );
};

const Row: React.FC<{
  label: string;
  value: React.ReactNode;
  muted?: boolean;
  bold?: boolean;
}> = ({ label, value, muted, bold }) => (
  <div className="flex justify-between items-center text-sm">
    <span className={(muted ? "text-slate-500 " : "text-slate-700 ") + (bold ? "font-semibold" : "")}>{label}</span>
    <span className={bold ? "font-semibold text-slate-900" : "text-slate-700"}>{value}</span>
  </div>
);

const AddressSummary: React.FC<{ value?: import("../api/client.js").Address | null }> = ({ value }) => {
  if (!value) {
    return <p className="text-sm text-slate-500">No address set.</p>;
  }
  return (
    <div className="text-sm text-slate-700">
      <div>{[value.firstName, value.lastName].filter(Boolean).join(" ")}</div>
      {value.company && <div>{value.company}</div>}
      {value.address1 && <div>{value.address1}</div>}
      {value.address2 && <div>{value.address2}</div>}
      <div>
        {[value.postalCode, value.city, value.province].filter(Boolean).join(", ")}
      </div>
      {value.countryCode && <div className="text-xs text-slate-500">{value.countryCode}</div>}
      {value.phone && <div className="text-xs text-slate-500">{value.phone}</div>}
    </div>
  );
};

const CartHeaderSection: React.FC<{
  cart: CartView;
  busy: boolean;
  role: import("../api/client.js").Role;
  onSaved: () => void;
  run: <T>(label: string, fn: () => Promise<T>) => Promise<T | null>;
}> = ({ cart, busy, role, run }) => {
  const [email, setEmail] = useState(cart.email ?? "");
  const [locale, setLocale] = useState(cart.locale ?? "");
  const [customerId, setCustomerId] = useState(cart.customerId ?? "");
  const [regionId, setRegionId] = useState(cart.regionId ?? "");
  const [salesChannelId, setSalesChannelId] = useState(cart.salesChannelId ?? "");
  const disabled = role !== "Customer";

  useEffect(() => {
    setEmail(cart.email ?? "");
    setLocale(cart.locale ?? "");
    setCustomerId(cart.customerId ?? "");
    setRegionId(cart.regionId ?? "");
    setSalesChannelId(cart.salesChannelId ?? "");
  }, [cart.id, cart.updatedAt]);

  return (
    <div className="card p-5 space-y-3">
      <h2 className="font-semibold text-slate-900">Cart header</h2>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <label className="label">Email</label>
          <input className="input" value={email} onChange={(e) => setEmail(e.target.value)} disabled={disabled} />
        </div>
        <div>
          <label className="label">Locale</label>
          <input className="input" value={locale} onChange={(e) => setLocale(e.target.value)} disabled={disabled} />
        </div>
        <div>
          <label className="label">Customer ID</label>
          <input className="input" value={customerId} onChange={(e) => setCustomerId(e.target.value)} disabled={disabled} />
        </div>
        <div>
          <label className="label">Region ID</label>
          <input className="input" value={regionId} onChange={(e) => setRegionId(e.target.value)} disabled={disabled} />
        </div>
        <div>
          <label className="label">Sales channel ID</label>
          <input className="input" value={salesChannelId} onChange={(e) => setSalesChannelId(e.target.value)} disabled={disabled} />
        </div>
      </div>
      <div className="flex justify-end">
        <button
          className="btn-primary"
          disabled={busy || disabled}
          onClick={() =>
            run("Cart updated", () =>
              api.updateCart(cart.id, {
                email: email || null,
                locale: locale || null,
                customerId: customerId || null,
                regionId: regionId || null,
                salesChannelId: salesChannelId || null,
              }),
            )
          }
        >
          Update cart
        </button>
      </div>
    </div>
  );
};

const LineItemsSection: React.FC<{
  cart: CartView;
  busy: boolean;
  role: import("../api/client.js").Role;
  run: <T>(label: string, fn: () => Promise<T>) => Promise<T | null>;
}> = ({ cart, busy, role, run }) => {
  const isCustomer = role === "Customer";
  return (
    <div className="card p-5 space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="font-semibold text-slate-900">Line items</h2>
        <span className="text-xs text-slate-500">{cart.items.length} items</span>
      </div>
      {cart.items.length === 0 ? (
        <p className="text-sm text-slate-500">
          No line items. Add some from the shop.
        </p>
      ) : (
        <ul className="space-y-3">
          {cart.items.map((item) => (
            <LineItemRow
              key={item.id}
              cart={cart}
              item={item}
              busy={busy}
              isCustomer={isCustomer}
              run={run}
            />
          ))}
        </ul>
      )}
    </div>
  );
};

const LineItemRow: React.FC<{
  cart: CartView;
  item: LineItemView;
  busy: boolean;
  isCustomer: boolean;
  run: <T>(label: string, fn: () => Promise<T>) => Promise<T | null>;
}> = ({ cart, item, busy, isCustomer, run }) => {
  const [qty, setQty] = useState<number>(item.quantity);
  useEffect(() => setQty(item.quantity), [item.quantity]);

  return (
    <li className="flex gap-4 items-start border-b border-slate-100 pb-3 last:border-0">
      {item.thumbnail && (
        <img
          src={item.thumbnail}
          alt=""
          className="w-16 h-16 rounded-md object-cover"
        />
      )}
      <div className="flex-1">
        <div className="font-medium text-slate-900">{item.title}</div>
        <div className="text-xs text-slate-500">
          {formatMoney(item.unitPrice, cart.currencyCode)} each
        </div>
        {item.adjustments && item.adjustments.length > 0 && (
          <div className="text-xs text-emerald-700 mt-1">
            Promo: -{formatMoney(item.discountTotal, cart.currencyCode)}
            {item.adjustments[0]?.code && ` (${item.adjustments[0].code})`}
          </div>
        )}
        {item.taxLines && item.taxLines.length > 0 && (
          <div className="text-xs text-slate-500 mt-1">
            Tax: {item.taxLines.map((t) => `${t.code} ${t.rate}%`).join(", ")}
          </div>
        )}
      </div>
      <div className="flex items-center gap-2">
        <input
          type="number"
          min={1}
          value={qty}
          className="input !w-16 text-center"
          disabled={!isCustomer || busy}
          onChange={(e) => setQty(Math.max(1, Number(e.target.value || 1)))}
        />
        <button
          className="btn-secondary text-xs"
          disabled={!isCustomer || busy || qty === item.quantity}
          onClick={() =>
            run("Line item updated", () =>
              api.updateLineItem(cart.id, [{ id: item.id, quantity: qty }]),
            )
          }
        >
          Update
        </button>
        <button
          className="btn-danger text-xs"
          disabled={!isCustomer || busy}
          onClick={() =>
            run("Line item removed", () =>
              api.removeLineItem(cart.id, [{ id: item.id }]),
            )
          }
        >
          Remove
        </button>
      </div>
      <div className="w-24 text-right font-medium text-slate-900">
        {formatMoney(item.total, cart.currencyCode)}
      </div>
    </li>
  );
};

const ShippingMethodsSection: React.FC<{
  cart: CartView;
  busy: boolean;
  role: import("../api/client.js").Role;
  run: <T>(label: string, fn: () => Promise<T>) => Promise<T | null>;
}> = ({ cart, busy, role, run }) => {
  const isCustomer = role === "Customer";
  return (
    <div className="card p-5 space-y-3">
      <h2 className="font-semibold text-slate-900">Shipping methods</h2>
      {cart.shippingMethods.length === 0 ? (
        <p className="text-sm text-slate-500">No shipping methods selected.</p>
      ) : (
        <ul className="space-y-2">
          {cart.shippingMethods.map((m) => (
            <li
              key={m.id}
              className="flex items-center justify-between border border-slate-200 rounded-lg px-3 py-2"
            >
              <div>
                <div className="font-medium text-slate-900">{m.name}</div>
                <div className="text-xs text-slate-500">
                  {m.shippingOptionId ?? "—"}
                </div>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-sm">{formatMoney(m.amount, cart.currencyCode)}</span>
                <button
                  className="btn-danger text-xs"
                  disabled={!isCustomer || busy}
                  onClick={() =>
                    run("Shipping method removed", () =>
                      api.removeShippingMethod(cart.id, [{ id: m.id }]),
                    )
                  }
                >
                  Remove
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 pt-2">
        {shippingOptions.map((opt) => (
          <button
            key={opt.shippingOptionId}
            className="btn-secondary text-sm"
            disabled={!isCustomer || busy}
            onClick={() =>
              run("Shipping method added", () =>
                api.addShippingMethod(cart.id, [
                  {
                    name: opt.name,
                    amount: opt.amount,
                    shippingOptionId: opt.shippingOptionId,
                  },
                ]),
              )
            }
          >
            + {opt.name} ({formatMoney(opt.amount, cart.currencyCode)})
          </button>
        ))}
      </div>
    </div>
  );
};

const AdjustmentsSection: React.FC<{
  cart: CartView;
  busy: boolean;
  run: <T>(label: string, fn: () => Promise<T>) => Promise<T | null>;
}> = ({ cart, busy, run }) => {
  const [selectedItemId, setSelectedItemId] = useState<string>(cart.items[0]?.id ?? "");
  const [code, setCode] = useState("");
  const [amount, setAmount] = useState("");
  const [selectedMethodId, setSelectedMethodId] = useState<string>(
    cart.shippingMethods[0]?.id ?? "",
  );
  const [shipCode, setShipCode] = useState("");
  const [shipAmount, setShipAmount] = useState("");

  useEffect(() => {
    if (!selectedItemId && cart.items[0]) setSelectedItemId(cart.items[0].id);
    if (!selectedMethodId && cart.shippingMethods[0])
      setSelectedMethodId(cart.shippingMethods[0].id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cart.id]);

  return (
    <div className="card p-5 space-y-4">
      <h2 className="font-semibold text-slate-900">
        Automation · Adjustments (promotions)
      </h2>
      <p className="text-xs text-slate-500">
        Set-replacement semantics. Submitting an empty list clears all
        adjustments for that line.
      </p>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="space-y-2">
          <div className="font-medium text-sm">Line item</div>
          <select
            className="input"
            value={selectedItemId}
            onChange={(e) => setSelectedItemId(e.target.value)}
            disabled={cart.items.length === 0}
          >
            {cart.items.map((i) => (
              <option key={i.id} value={i.id}>
                {i.title}
              </option>
            ))}
          </select>
          <div className="grid grid-cols-2 gap-2">
            <input
              className="input"
              placeholder="Code (e.g. WELCOME10)"
              value={code}
              onChange={(e) => setCode(e.target.value)}
            />
            <input
              className="input"
              placeholder="Amount"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
            />
          </div>
          <div className="flex flex-wrap gap-2">
            {sampleCoupons.map((c) => (
              <button
                key={c.code}
                className="text-xs btn-secondary"
                disabled={busy || !selectedItemId}
                onClick={() => {
                  setCode(c.code);
                  setAmount(c.amount);
                }}
              >
                {c.code} · {c.description}
              </button>
            ))}
          </div>
          <div className="flex gap-2">
            <button
              className="btn-primary"
              disabled={busy || !selectedItemId || !amount}
              onClick={() =>
                run("Line-item adjustments set", () =>
                  api.setLineItemAdjustments(cart.id, [
                    {
                      id: selectedItemId,
                      adjustments: [
                        { amount, code: code || null, description: code || null },
                      ],
                    },
                  ]),
                )
              }
            >
              Apply adjustment
            </button>
            <button
              className="btn-secondary"
              disabled={busy || !selectedItemId}
              onClick={() =>
                run("Line-item adjustments cleared", () =>
                  api.setLineItemAdjustments(cart.id, [
                    { id: selectedItemId, adjustments: [] },
                  ]),
                )
              }
            >
              Clear adjustments
            </button>
          </div>
        </div>

        <div className="space-y-2">
          <div className="font-medium text-sm">Shipping method</div>
          <select
            className="input"
            value={selectedMethodId}
            onChange={(e) => setSelectedMethodId(e.target.value)}
            disabled={cart.shippingMethods.length === 0}
          >
            {cart.shippingMethods.map((m) => (
              <option key={m.id} value={m.id}>
                {m.name}
              </option>
            ))}
          </select>
          <div className="grid grid-cols-2 gap-2">
            <input
              className="input"
              placeholder="Code (e.g. FREESHIP)"
              value={shipCode}
              onChange={(e) => setShipCode(e.target.value)}
            />
            <input
              className="input"
              placeholder="Amount"
              value={shipAmount}
              onChange={(e) => setShipAmount(e.target.value)}
            />
          </div>
          <div className="flex gap-2">
            <button
              className="btn-primary"
              disabled={busy || !selectedMethodId || !shipAmount}
              onClick={() =>
                run("Shipping-method adjustments set", () =>
                  api.setShippingMethodAdjustments(cart.id, [
                    {
                      id: selectedMethodId,
                      adjustments: [
                        {
                          amount: shipAmount,
                          code: shipCode || null,
                          description: shipCode || null,
                        },
                      ],
                    },
                  ]),
                )
              }
            >
              Apply adjustment
            </button>
            <button
              className="btn-secondary"
              disabled={busy || !selectedMethodId}
              onClick={() =>
                run("Shipping-method adjustments cleared", () =>
                  api.setShippingMethodAdjustments(cart.id, [
                    { id: selectedMethodId, adjustments: [] },
                  ]),
                )
              }
            >
              Clear adjustments
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

const TaxLinesSection: React.FC<{
  cart: CartView;
  busy: boolean;
  run: <T>(label: string, fn: () => Promise<T>) => Promise<T | null>;
}> = ({ cart, busy, run }) => {
  const [selectedItemId, setSelectedItemId] = useState<string>(cart.items[0]?.id ?? "");
  const [code, setCode] = useState("VAT_SE");
  const [rate, setRate] = useState("25");
  const [shipMethodId, setShipMethodId] = useState<string>(
    cart.shippingMethods[0]?.id ?? "",
  );
  const [shipCode, setShipCode] = useState("VAT_SE");
  const [shipRate, setShipRate] = useState("25");

  return (
    <div className="card p-5 space-y-4">
      <h2 className="font-semibold text-slate-900">Automation · Tax lines</h2>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="space-y-2">
          <div className="font-medium text-sm">Line item</div>
          <select
            className="input"
            value={selectedItemId}
            onChange={(e) => setSelectedItemId(e.target.value)}
            disabled={cart.items.length === 0}
          >
            {cart.items.map((i) => (
              <option key={i.id} value={i.id}>
                {i.title}
              </option>
            ))}
          </select>
          <div className="grid grid-cols-2 gap-2">
            <input className="input" placeholder="Code" value={code} onChange={(e) => setCode(e.target.value)} />
            <input className="input" placeholder="Rate %" value={rate} onChange={(e) => setRate(e.target.value)} />
          </div>
          <div className="flex gap-2">
            <ShipTaxButton
              busy={busy}
              disabled={!selectedItemId}
              label="Apply tax line"
              onClick={() =>
                run("Line-item tax lines set", () =>
                  api.setLineItemTaxLines(cart.id, [
                    { id: selectedItemId, taxLines: [{ code, rate }] },
                  ]),
                )
              }
            />
            <ShipTaxButton
              variant="secondary"
              busy={busy}
              disabled={!selectedItemId}
              label="Clear tax lines"
              onClick={() =>
                run("Line-item tax lines cleared", () =>
                  api.setLineItemTaxLines(cart.id, [
                    { id: selectedItemId, taxLines: [] },
                  ]),
                )
              }
            />
          </div>
        </div>

        <div className="space-y-2">
          <div className="font-medium text-sm">Shipping method</div>
          <select
            className="input"
            value={shipMethodId}
            onChange={(e) => setShipMethodId(e.target.value)}
            disabled={cart.shippingMethods.length === 0}
          >
            {cart.shippingMethods.map((m) => (
              <option key={m.id} value={m.id}>
                {m.name}
              </option>
            ))}
          </select>
          <div className="grid grid-cols-2 gap-2">
            <input className="input" placeholder="Code" value={shipCode} onChange={(e) => setShipCode(e.target.value)} />
            <input className="input" placeholder="Rate %" value={shipRate} onChange={(e) => setShipRate(e.target.value)} />
          </div>
          <div className="flex gap-2">
            <ShipTaxButton
              busy={busy}
              disabled={!shipMethodId}
              label="Apply tax line"
              onClick={() =>
                run("Shipping-method tax lines set", () =>
                  api.setShippingMethodTaxLines(cart.id, [
                    { id: shipMethodId, taxLines: [{ code: shipCode, rate: shipRate }] },
                  ]),
                )
              }
            />
            <ShipTaxButton
              variant="secondary"
              busy={busy}
              disabled={!shipMethodId}
              label="Clear tax lines"
              onClick={() =>
                run("Shipping-method tax lines cleared", () =>
                  api.setShippingMethodTaxLines(cart.id, [
                    { id: shipMethodId, taxLines: [] },
                  ]),
                )
              }
            />
          </div>
        </div>
      </div>
    </div>
  );
};

const ShipTaxButton: React.FC<{
  busy: boolean;
  disabled: boolean;
  label: string;
  onClick: () => void;
  variant?: "primary" | "secondary";
}> = ({ busy, disabled, label, onClick, variant = "primary" }) => (
  <button
    className={variant === "primary" ? "btn-primary" : "btn-secondary"}
    disabled={busy || disabled}
    onClick={onClick}
  >
    {label}
  </button>
);

const CreditLinesSection: React.FC<{
  cart: CartView;
  busy: boolean;
  run: <T>(label: string, fn: () => Promise<T>) => Promise<T | null>;
}> = ({ cart, busy, run }) => {
  const [amount, setAmount] = useState("");
  const [reference, setReference] = useState("refund");
  const [referenceId, setReferenceId] = useState("");
  return (
    <div className="card p-5 space-y-4">
      <h2 className="font-semibold text-slate-900">
        Automation · Credit lines
      </h2>
      <ul className="space-y-2">
        {cart.creditLines.length === 0 && (
          <li className="text-sm text-slate-500">No credit lines.</li>
        )}
        {cart.creditLines.map((cl) => (
          <li
            key={cl.id}
            className="flex items-center justify-between border border-slate-200 rounded-lg px-3 py-2"
          >
            <div>
              <div className="text-sm font-medium">
                {cl.reference} {cl.referenceId ? `· ${cl.referenceId}` : ""}
              </div>
              <div className="text-xs text-slate-500">{cl.id}</div>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-sm">{formatMoney(cl.amount, cart.currencyCode)}</span>
              <button
                className="btn-danger text-xs"
                disabled={busy}
                onClick={() =>
                  run("Credit line removed", () =>
                    api.removeCreditLine(cart.id, [{ id: cl.id }]),
                  )
                }
              >
                Remove
              </button>
            </div>
          </li>
        ))}
      </ul>
      <div className="grid grid-cols-3 gap-2">
        <input className="input" placeholder="Reference (refund)" value={reference} onChange={(e) => setReference(e.target.value)} />
        <input className="input" placeholder="Reference ID" value={referenceId} onChange={(e) => setReferenceId(e.target.value)} />
        <input className="input" placeholder="Amount" value={amount} onChange={(e) => setAmount(e.target.value)} />
      </div>
      <div className="flex justify-end">
        <button
          className="btn-primary"
          disabled={busy || !amount}
          onClick={() =>
            run("Credit line added", () =>
              api.addCreditLine(cart.id, [
                {
                  amount,
                  reference: reference || null,
                  referenceId: referenceId || null,
                },
              ]),
            )
          }
        >
          Add credit line
        </button>
      </div>
    </div>
  );
};
