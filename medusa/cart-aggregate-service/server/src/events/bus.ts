import { EventEmitter } from "node:events";

export type DomainEventName =
  | "CartCreated"
  | "CartUpdated"
  | "CartDeleted"
  | "CartRestored"
  | "ShippingAddressSet"
  | "BillingAddressSet"
  | "LineItemAdded"
  | "LineItemUpdated"
  | "LineItemRemoved"
  | "ShippingMethodAdded"
  | "ShippingMethodRemoved"
  | "LineItemAdjustmentsSet"
  | "ShippingMethodAdjustmentsSet"
  | "LineItemTaxLinesSet"
  | "ShippingMethodTaxLinesSet"
  | "CreditLineAdded"
  | "CreditLineRemoved";

export interface DomainEvent<T = unknown> {
  name: DomainEventName;
  cartId: string;
  payload: T;
  occurredAt: string;
}

const emitter = new EventEmitter();
emitter.setMaxListeners(50);

export function publish<T>(event: DomainEvent<T>): void {
  emitter.emit(event.name, event);
  emitter.emit("*", event);
}

export function subscribe<T = unknown>(
  name: DomainEventName | "*",
  handler: (event: DomainEvent<T>) => void,
): () => void {
  emitter.on(name, handler);
  return () => emitter.off(name, handler);
}
