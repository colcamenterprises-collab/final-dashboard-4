import { Router } from "express";
import { db } from "../../lib/prisma";

const router = Router();

router.get("/live", async (req, res) => {
  const prisma = db();
  const items = await prisma.stock_item_live_v1.findMany({
    orderBy: { name: "asc" }
  });
  res.json({ success: true, items });
});

export default router;
