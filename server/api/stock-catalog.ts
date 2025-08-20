import { Router } from "express";
import { loadCatalogFromCSV } from "../lib/stockCatalog";

const router = Router();

router.get("/", (_req, res) => {
  const items = loadCatalogFromCSV();
  // Sort server‑side for stability
  items.sort((a, b) => a.category.localeCompare(b.category) || a.name.localeCompare(b.name));
  res.json({ items });
});

export default router;