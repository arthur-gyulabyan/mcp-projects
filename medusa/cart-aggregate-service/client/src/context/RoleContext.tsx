import React, { createContext, useContext, useEffect, useState } from "react";
import { getRole, setRole as apiSetRole, type Role } from "../api/client.js";

interface RoleContextValue {
  role: Role;
  setRole: (r: Role) => void;
}

const Ctx = createContext<RoleContextValue | null>(null);

export const RoleProvider: React.FC<React.PropsWithChildren> = ({ children }) => {
  const [role, setRoleState] = useState<Role>(() => {
    const stored = localStorage.getItem("cart-role");
    return (stored as Role) ?? getRole();
  });

  useEffect(() => {
    apiSetRole(role);
    localStorage.setItem("cart-role", role);
  }, [role]);

  return (
    <Ctx.Provider value={{ role, setRole: setRoleState }}>
      {children}
    </Ctx.Provider>
  );
};

export function useRole(): RoleContextValue {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useRole must be used within RoleProvider");
  return ctx;
}
