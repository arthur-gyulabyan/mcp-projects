import Database from "better-sqlite3";
import { initSchema } from "../src/infrastructure/schema.js";
import { CartRepository } from "../src/infrastructure/cart-repository.js";
import { subscribe, type DomainEvent, type DomainEventName } from "../src/events/bus.js";

export function makeRepo(): { repo: CartRepository; close: () => void } {
  const db = new Database(":memory:");
  initSchema(db);
  return {
    repo: new CartRepository(db),
    close: () => db.close(),
  };
}

export function captureEvent<T = unknown>(
  name: DomainEventName,
): { events: DomainEvent<T>[]; unsubscribe: () => void } {
  const events: DomainEvent<T>[] = [];
  const unsubscribe = subscribe<T>(name, (e) => events.push(e));
  return { events, unsubscribe };
}
