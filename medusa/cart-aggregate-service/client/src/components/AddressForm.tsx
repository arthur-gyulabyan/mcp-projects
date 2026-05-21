import React, { useState } from "react";
import type { Address } from "../api/client.js";

export const AddressForm: React.FC<{
  initial?: Address | null;
  onSubmit: (a: Address) => Promise<void> | void;
  submitting?: boolean;
  submitLabel?: string;
}> = ({ initial, onSubmit, submitting, submitLabel = "Save address" }) => {
  const [a, setA] = useState<Address>(() => ({
    firstName: initial?.firstName ?? "",
    lastName: initial?.lastName ?? "",
    company: initial?.company ?? "",
    address1: initial?.address1 ?? "",
    address2: initial?.address2 ?? "",
    city: initial?.city ?? "",
    province: initial?.province ?? "",
    postalCode: initial?.postalCode ?? "",
    countryCode: initial?.countryCode ?? "",
    phone: initial?.phone ?? "",
  }));

  const change = (k: keyof Address) =>
    (e: React.ChangeEvent<HTMLInputElement>) =>
      setA((prev) => ({ ...prev, [k]: e.target.value }));

  return (
    <form
      onSubmit={async (e) => {
        e.preventDefault();
        await onSubmit(a);
      }}
      className="space-y-3"
    >
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="label">First name</label>
          <input className="input" value={a.firstName ?? ""} onChange={change("firstName")} />
        </div>
        <div>
          <label className="label">Last name</label>
          <input className="input" value={a.lastName ?? ""} onChange={change("lastName")} />
        </div>
      </div>
      <div>
        <label className="label">Company</label>
        <input className="input" value={a.company ?? ""} onChange={change("company")} />
      </div>
      <div>
        <label className="label">Address line 1</label>
        <input className="input" value={a.address1 ?? ""} onChange={change("address1")} />
      </div>
      <div>
        <label className="label">Address line 2</label>
        <input className="input" value={a.address2 ?? ""} onChange={change("address2")} />
      </div>
      <div className="grid grid-cols-3 gap-3">
        <div>
          <label className="label">City</label>
          <input className="input" value={a.city ?? ""} onChange={change("city")} />
        </div>
        <div>
          <label className="label">Province</label>
          <input className="input" value={a.province ?? ""} onChange={change("province")} />
        </div>
        <div>
          <label className="label">Postal code</label>
          <input className="input" value={a.postalCode ?? ""} onChange={change("postalCode")} />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="label">Country (ISO-3166)</label>
          <input className="input" value={a.countryCode ?? ""} onChange={change("countryCode")} placeholder="SE / US / DE" />
        </div>
        <div>
          <label className="label">Phone</label>
          <input className="input" value={a.phone ?? ""} onChange={change("phone")} />
        </div>
      </div>
      <div className="flex justify-end pt-2">
        <button type="submit" className="btn-primary" disabled={submitting}>
          {submitting ? "Saving…" : submitLabel}
        </button>
      </div>
    </form>
  );
};
