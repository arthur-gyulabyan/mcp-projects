import { Router, type NextFunction, type Request, type Response } from "express";
import { DomainError } from "../domain/errors.js";
import { createCart } from "../application/commands/create-cart.js";
import { updateCart } from "../application/commands/update-cart.js";
import {
  deleteCart,
  restoreCart,
} from "../application/commands/delete-restore-cart.js";
import {
  setBillingAddress,
  setShippingAddress,
} from "../application/commands/addresses.js";
import {
  addLineItem,
  removeLineItem,
  updateLineItem,
} from "../application/commands/line-items.js";
import {
  addShippingMethod,
  removeShippingMethod,
} from "../application/commands/shipping-methods.js";
import {
  setLineItemAdjustments,
  setLineItemTaxLines,
  setShippingMethodAdjustments,
  setShippingMethodTaxLines,
} from "../application/commands/adjustments.js";
import {
  addCreditLine,
  removeCreditLine,
} from "../application/commands/credit-lines.js";
import { listCarts } from "../application/queries/list-carts.js";
import { getCart } from "../application/queries/get-cart.js";
import { computeCartView } from "../application/queries/totals.js";
import type { Cart } from "../domain/types.js";
import type { CartRepository } from "../infrastructure/cart-repository.js";
import { requireRole } from "./auth.js";

const view = (cart: Cart) => computeCartView(cart);

const wrap =
  (fn: (req: Request, res: Response) => unknown | Promise<unknown>) =>
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const result = await fn(req, res);
      if (!res.headersSent && result !== undefined) {
        res.json(result);
      }
    } catch (err) {
      next(err);
    }
  };

export function buildRouter(repo: CartRepository): Router {
  const r = Router();

  // Queries (Customer + Admin can read; Automation may need it for projections)
  r.get(
    "/carts",
    requireRole("Customer", "Admin", "Automation"),
    wrap((req) =>
      listCarts(repo, {
        customerId: (req.query.customerId as string) ?? undefined,
        salesChannelId: (req.query.salesChannelId as string) ?? undefined,
        regionId: (req.query.regionId as string) ?? undefined,
        email: (req.query.email as string) ?? undefined,
        includeDeleted: req.query.includeDeleted === "true",
      }),
    ),
  );

  r.get(
    "/carts/:id",
    requireRole("Customer", "Admin", "Automation"),
    wrap((req) =>
      getCart(repo, req.params.id!, {
        includeDeleted: req.query.includeDeleted === "true",
      }),
    ),
  );

  // CreateCart
  r.post(
    "/carts",
    requireRole("Customer"),
    wrap((req) => view(createCart(repo, req.body ?? {}))),
  );

  // UpdateCart
  r.patch(
    "/carts/:id",
    requireRole("Customer"),
    wrap((req) =>
      view(updateCart(repo, { id: req.params.id!, ...(req.body ?? {}) })),
    ),
  );

  // DeleteCart
  r.delete(
    "/carts/:id",
    requireRole("Admin"),
    wrap((req) => deleteCart(repo, req.params.id!)),
  );

  // RestoreCart
  r.post(
    "/carts/:id/restore",
    requireRole("Admin"),
    wrap((req) => restoreCart(repo, req.params.id!)),
  );

  // SetShippingAddress / SetBillingAddress
  r.put(
    "/carts/:id/shipping-address",
    requireRole("Customer"),
    wrap((req) =>
      view(
        setShippingAddress(
          repo,
          req.params.id!,
          (req.body?.shippingAddress ?? req.body ?? null) as never,
        ),
      ),
    ),
  );

  r.put(
    "/carts/:id/billing-address",
    requireRole("Customer"),
    wrap((req) =>
      view(
        setBillingAddress(
          repo,
          req.params.id!,
          (req.body?.billingAddress ?? req.body ?? null) as never,
        ),
      ),
    ),
  );

  // Line items
  r.post(
    "/carts/:id/line-items",
    requireRole("Customer"),
    wrap((req) => view(addLineItem(repo, req.params.id!, req.body?.items ?? []))),
  );

  r.patch(
    "/carts/:id/line-items",
    requireRole("Customer"),
    wrap((req) => view(updateLineItem(repo, req.params.id!, req.body?.items ?? []))),
  );

  r.delete(
    "/carts/:id/line-items",
    requireRole("Customer"),
    wrap((req) => view(removeLineItem(repo, req.params.id!, req.body?.items ?? []))),
  );

  // Shipping methods
  r.post(
    "/carts/:id/shipping-methods",
    requireRole("Customer"),
    wrap((req) =>
      view(addShippingMethod(repo, req.params.id!, req.body?.shippingMethods ?? [])),
    ),
  );

  r.delete(
    "/carts/:id/shipping-methods",
    requireRole("Customer"),
    wrap((req) =>
      view(
        removeShippingMethod(
          repo,
          req.params.id!,
          req.body?.shippingMethods ?? [],
        ),
      ),
    ),
  );

  // Adjustments
  r.put(
    "/carts/:id/line-item-adjustments",
    requireRole("Automation"),
    wrap((req) =>
      view(setLineItemAdjustments(repo, req.params.id!, req.body?.items ?? [])),
    ),
  );

  r.put(
    "/carts/:id/shipping-method-adjustments",
    requireRole("Automation"),
    wrap((req) =>
      view(
        setShippingMethodAdjustments(
          repo,
          req.params.id!,
          req.body?.shippingMethods ?? [],
        ),
      ),
    ),
  );

  // Tax lines
  r.put(
    "/carts/:id/line-item-tax-lines",
    requireRole("Automation"),
    wrap((req) =>
      view(setLineItemTaxLines(repo, req.params.id!, req.body?.items ?? [])),
    ),
  );

  r.put(
    "/carts/:id/shipping-method-tax-lines",
    requireRole("Automation"),
    wrap((req) =>
      view(
        setShippingMethodTaxLines(
          repo,
          req.params.id!,
          req.body?.shippingMethods ?? [],
        ),
      ),
    ),
  );

  // Credit lines
  r.post(
    "/carts/:id/credit-lines",
    requireRole("Automation"),
    wrap((req) =>
      view(addCreditLine(repo, req.params.id!, req.body?.creditLines ?? [])),
    ),
  );

  r.delete(
    "/carts/:id/credit-lines",
    requireRole("Automation"),
    wrap((req) =>
      view(removeCreditLine(repo, req.params.id!, req.body?.creditLines ?? [])),
    ),
  );

  // Error middleware
  r.use(
    (err: unknown, _req: Request, res: Response, _next: NextFunction) => {
      if (err instanceof DomainError) {
        res
          .status(err.status)
          .json({ code: err.code, message: err.message, field: err.field });
        return;
      }
      const e = err as Error;
      console.error(e);
      res.status(500).json({
        code: "INTERNAL_ERROR",
        message: e.message || "Internal server error",
      });
    },
  );

  return r;
}
