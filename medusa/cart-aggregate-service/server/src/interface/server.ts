import cors from "cors";
import express from "express";
import type Database from "better-sqlite3";
import { CartRepository } from "../infrastructure/cart-repository.js";
import { attachRole } from "./auth.js";
import { buildRouter } from "./routes.js";

export interface AppDeps {
  db: Database.Database;
}

export function buildApp(deps: AppDeps) {
  const repo = new CartRepository(deps.db);
  const app = express();
  app.use(cors());
  app.use(express.json({ limit: "1mb" }));
  app.use(attachRole);
  app.get("/health", (_req, res) => res.json({ ok: true }));
  app.use("/api/v1", buildRouter(repo));
  return { app, repo };
}
