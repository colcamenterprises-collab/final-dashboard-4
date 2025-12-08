// PATCH 2 — SHOPPING LIST PROTECTION & TRIPWIRES
// ONLY retrieval is allowed via this route.
// Mutation is strictly forbidden.

import { Router } from "express";
import { db } from "../lib/prisma";

const router = Router();

// Tripwire — Block all non-GET methods
router.use((req, res, next) => {
  if (req.method !== "GET") {
    console.error("BLOCKED: Unauthorized shopping list mutation attempt.");
    return res.status(403).json({
      error: "Shopping List is protected. Only GET operations are permitted.",
    });
  }
  next();
});

router.get("/latest", async (req, res) => {
  try {
    const prisma = db();
    const latest = await prisma.shoppingListV2.findFirst({
      orderBy: { createdAt: "desc" },
    });

    return res.status(200).json(latest || { items: [] });
  } catch (err) {
    console.error("ShoppingList fetch error:", err);
    res.status(500).json({ error: "Failed to fetch shopping list" });
  }
});

export default router;
