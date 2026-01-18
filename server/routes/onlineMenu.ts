import type { Express } from "express";
import { getLegacyMenuFromOnlineProducts } from "../services/onlineProductFeed";

export function registerOnlineMenuRoutes(app: Express) {
  // GET /api/menu - Public menu endpoint for ordering page
  app.get("/api/menu", async (_req, res) => {
    try {
      const menu = await getLegacyMenuFromOnlineProducts();
      res.json({ deprecated: true, ...menu });
    } catch (error) {
      console.error("Error fetching menu:", error);
      res.status(500).json({ error: "Failed to fetch menu" });
    }
  });
}
