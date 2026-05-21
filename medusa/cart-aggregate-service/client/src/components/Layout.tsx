import React from "react";
import { Link, NavLink, Outlet } from "react-router-dom";
import { useRole } from "../context/RoleContext.js";
import type { Role } from "../api/client.js";

const roleStyles: Record<Role, string> = {
  Customer: "bg-brand-100 text-brand-700",
  Automation: "bg-amber-100 text-amber-700",
  Admin: "bg-emerald-100 text-emerald-700",
};

export const Layout: React.FC = () => {
  const { role, setRole } = useRole();
  return (
    <div className="min-h-full flex flex-col">
      <header className="bg-white border-b border-slate-200">
        <div className="max-w-6xl mx-auto px-6 py-3 flex items-center justify-between gap-6">
          <Link to="/" className="flex items-center gap-2 font-semibold text-slate-900">
            <span className="w-8 h-8 rounded-md bg-brand-500 text-white flex items-center justify-center text-sm">
              CA
            </span>
            <span>Cart Aggregate</span>
          </Link>
          <nav className="flex items-center gap-1 text-sm">
            <NavTab to="/" label="Shop" />
            <NavTab to="/carts" label="Carts" />
            {role === "Admin" && <NavTab to="/admin" label="Admin" />}
            {role === "Automation" && <NavTab to="/automation" label="Automation" />}
          </nav>
          <div className="flex items-center gap-2">
            <span className={"badge " + roleStyles[role]}>Role: {role}</span>
            <select
              className="input !w-auto !py-1 !text-xs"
              value={role}
              onChange={(e) => setRole(e.target.value as Role)}
            >
              <option value="Customer">Customer</option>
              <option value="Automation">Automation</option>
              <option value="Admin">Admin</option>
            </select>
          </div>
        </div>
      </header>
      <main className="flex-1">
        <div className="max-w-6xl mx-auto px-6 py-6">
          <Outlet />
        </div>
      </main>
      <footer className="text-xs text-slate-500 text-center py-6">
        Generated from Qlerify · Cart Aggregate · Bounded Context: Cart
        Management
      </footer>
    </div>
  );
};

const NavTab: React.FC<{ to: string; label: string }> = ({ to, label }) => (
  <NavLink
    to={to}
    end
    className={({ isActive }) =>
      "px-3 py-1.5 rounded-md transition " +
      (isActive
        ? "bg-slate-900 text-white"
        : "text-slate-600 hover:bg-slate-100")
    }
  >
    {label}
  </NavLink>
);
