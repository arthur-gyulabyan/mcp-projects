import { publish } from "../../events/bus.js";
import { InvalidDataError } from "../../domain/errors.js";
import type { Cart } from "../../domain/types.js";
import { CartRepository, toJson } from "../../infrastructure/cart-repository.js";

export interface UpdateCartInput {
  id: string;
  regionId?: string | null;
  customerId?: string | null;
  salesChannelId?: string | null;
  email?: string | null;
  locale?: string | null;
  metadata?: Record<string, unknown> | null;
}

export function updateCart(repo: CartRepository, input: UpdateCartInput): Cart {
  if (!input.id) {
    throw new InvalidDataError(`Field "id" is required`, "id");
  }
  // Force load (raises NotFoundError if absent or soft-deleted).
  const existing = repo.loadCart(input.id);
  const now = new Date().toISOString();

  repo.withTransaction(() => {
    const sets: string[] = [];
    const params: Record<string, unknown> = { id: input.id };
    const apply = (col: string, key: string, value: unknown) => {
      sets.push(`${col} = @${key}`);
      params[key] = value;
    };
    if (input.regionId !== undefined) apply("region_id", "region_id", input.regionId);
    if (input.customerId !== undefined)
      apply("customer_id", "customer_id", input.customerId);
    if (input.salesChannelId !== undefined)
      apply("sales_channel_id", "sales_channel_id", input.salesChannelId);
    if (input.email !== undefined) apply("email", "email", input.email);
    if (input.locale !== undefined) apply("locale", "locale", input.locale);
    if (input.metadata !== undefined)
      apply("metadata", "metadata", toJson(input.metadata));
    if (sets.length === 0) return;
    const stmt = repo.raw.prepare(
      `UPDATE cart SET ${sets.join(", ")} WHERE id = @id`,
    );
    stmt.run(params);
    repo.bumpVersion(input.id, existing.version, now);
  });

  const updated = repo.loadCart(input.id);
  publish({
    name: "CartUpdated",
    cartId: input.id,
    payload: updated,
    occurredAt: now,
  });
  return updated;
}
