// PATCH 1 — Shopping List Fetch Route
// STRICT: New file only, do not modify existing logic.

import { Router } from "express";
import { db } from "../lib/prisma";

const router = Router();

router.get("/latest", async (req, res) => {
  try {
    const latest = await db().shoppingListV2.findFirst({
      orderBy: { createdAt: "desc" },
    });

    return res.status(200).json(latest || { items: [] });
  } catch (err) {
    console.error("ShoppingList fetch error:", err);
    res.status(500).json({ error: "Failed to fetch shopping list" });
  }
});

export default router;
