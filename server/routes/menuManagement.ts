import { Router } from "express";
import { getAdminMenuRows } from "../services/productMenuView";

export const menuManagementRouter = Router();

// GET /api/menu-management - Read-only product menu view
menuManagementRouter.get("/", async (_req, res) => {
  try {
    const rows = await getAdminMenuRows();

    const items = rows.map((row) => ({
      id: String(row.id),
      name: row.name,
      category: row.category || "UNMAPPED",
      description: row.description || null,
      imageUrl: row.imageUrl || null,
      isActive: row.active,
      salePrice: row.salePrice,
      totalCost: row.totalCost,
      isOnlineEnabled: row.active,
    }));

    res.json({ ok: true, items });
  } catch (error: any) {
    console.error("Error listing product menu:", error);
    res.status(500).json({ ok: false, error: error.message });
  }
});

const writeBlocked = (_req: any, res: any) => {
  res.status(409).json({
    ok: false,
    error: "Menu management is read-only. Update products and ingredient lines instead.",
  });
};

menuManagementRouter.post("/", writeBlocked);
menuManagementRouter.put("/:id", writeBlocked);
menuManagementRouter.delete("/:id", writeBlocked);
menuManagementRouter.post("/:id/toggle-online", writeBlocked);
menuManagementRouter.post("/upload-image", writeBlocked);
