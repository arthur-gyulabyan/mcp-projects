import type { NextFunction, Request, Response } from "express";
import { ForbiddenError } from "../domain/errors.js";

export type Role = "Customer" | "Automation" | "Admin";

export const ROLES: readonly Role[] = ["Customer", "Automation", "Admin"];

declare module "express-serve-static-core" {
  interface Request {
    role?: Role;
  }
}

export function resolveRole(req: Request): Role {
  const fromHeader = (req.headers["x-role"] as string | undefined)?.trim();
  const fromEnv = process.env.DEFAULT_ROLE?.trim();
  const role = (fromHeader || fromEnv || "Customer") as Role;
  if (!ROLES.includes(role)) {
    throw new ForbiddenError(`Unknown role "${role}"`);
  }
  return role;
}

export function attachRole(req: Request, _res: Response, next: NextFunction): void {
  req.role = resolveRole(req);
  next();
}

export function requireRole(...allowed: Role[]) {
  return (req: Request, _res: Response, next: NextFunction) => {
    const role = req.role ?? resolveRole(req);
    if (!allowed.includes(role)) {
      throw new ForbiddenError(
        `Role "${role}" is not allowed to invoke this command`,
      );
    }
    next();
  };
}
