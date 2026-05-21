import { CartRepository } from "../../infrastructure/cart-repository.js";
import { computeCartView, type CartView } from "./totals.js";

export function getCart(
  repo: CartRepository,
  id: string,
  opts: { includeDeleted?: boolean } = {},
): CartView {
  const cart = repo.loadCart(id, opts);
  return computeCartView(cart);
}
