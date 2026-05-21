import { CartRepository } from "../../infrastructure/cart-repository.js";
import { computeCartView, type CartView } from "./totals.js";

export interface ListCartsFilters {
  customerId?: string | null;
  salesChannelId?: string | null;
  regionId?: string | null;
  email?: string | null;
  includeDeleted?: boolean;
  limit?: number;
  offset?: number;
}

export interface ListCartsRow {
  id: string;
  currencyCode: string;
  customerId: string | null;
  salesChannelId: string | null;
  regionId: string | null;
  email: string | null;
  completedAt: string | null;
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
  total: string;
  subtotal: string;
}

export function listCarts(
  repo: CartRepository,
  filters: ListCartsFilters = {},
): ListCartsRow[] {
  const where: string[] = [];
  const params: unknown[] = [];
  if (!filters.includeDeleted) where.push("deleted_at IS NULL");
  if (filters.customerId) {
    where.push("customer_id = ?");
    params.push(filters.customerId);
  }
  if (filters.salesChannelId) {
    where.push("sales_channel_id = ?");
    params.push(filters.salesChannelId);
  }
  if (filters.regionId) {
    where.push("region_id = ?");
    params.push(filters.regionId);
  }
  if (filters.email) {
    where.push("email = ?");
    params.push(filters.email);
  }
  const sql =
    `SELECT id FROM cart` +
    (where.length ? ` WHERE ${where.join(" AND ")}` : ``) +
    ` ORDER BY created_at DESC LIMIT ? OFFSET ?`;
  params.push(filters.limit ?? 100);
  params.push(filters.offset ?? 0);
  const rows = repo.raw.prepare(sql).all(...params) as Array<{ id: string }>;

  const out: ListCartsRow[] = [];
  for (const r of rows) {
    const view: CartView = computeCartView(
      repo.loadCart(r.id, { includeDeleted: filters.includeDeleted }),
    );
    out.push({
      id: view.id,
      currencyCode: view.currencyCode,
      customerId: view.customerId ?? null,
      salesChannelId: view.salesChannelId ?? null,
      regionId: view.regionId ?? null,
      email: view.email ?? null,
      completedAt: view.completedAt ?? null,
      createdAt: view.createdAt,
      updatedAt: view.updatedAt,
      deletedAt: view.deletedAt ?? null,
      total: view.totals.total,
      subtotal: view.totals.subtotal,
    });
  }
  return out;
}
