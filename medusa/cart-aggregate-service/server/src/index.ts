import { openDb } from "./infrastructure/db.js";
import { buildApp } from "./interface/server.js";
import { subscribe } from "./events/bus.js";

const PORT = Number(process.env.PORT ?? 3002);
const DB_PATH = process.env.DB_PATH ?? "./cart-aggregate.db";

const db = openDb(DB_PATH);
const { app } = buildApp({ db });

subscribe("*", (event) => {
  console.log(`[event] ${event.name} cart=${event.cartId} at=${event.occurredAt}`);
});

app.listen(PORT, () => {
  console.log(`cart-aggregate-service listening on :${PORT}`);
});
