import { Router, type NextFunction, type Request, type Response } from "express";
import { attachSessionUser } from "../middleware/sessionAuth";
import {
  confirmManualPayment,
  createCategory,
  createItemModifier,
  createMenuItem,
  createModifierGroup,
  createOrder,
  createVenueTable,
  getMenu,
  getOrder,
  getSettings,
  listOrders,
  listVenueTables,
  orderingBlocker,
  seedPhase1TestMenu,
  updateCategory,
  updateItemModifier,
  updateMenuItem,
  updateModifierGroup,
  updateOrderStatus,
  updateSettings,
} from "../services/ordering/orderingService";

const router = Router();

function sendError(res: any, error: any, where: string, status = 500) {
  const message = error?.message || "Ordering request failed";
  return res.status(status).json({
    ok: false,
    source: "sbb_ordering_os_phase1",
    data: null,
    warnings: [],
    blockers: [orderingBlocker(error?.code || "ORDERING_REQUEST_FAILED", message, where)],
    last_updated: new Date().toISOString(),
  });
}

function requireOrderingAdmin(req: Request, res: Response, next: NextFunction) {
  if (process.env.NODE_ENV !== "production") return next();
  if (attachSessionUser(req)) return next();
  return res.status(401).json({
    ok: false,
    source: "sbb_ordering_os_phase1",
    data: null,
    warnings: [],
    blockers: [orderingBlocker("ORDERING_ADMIN_AUTH_REQUIRED", "Admin ordering endpoint requires an authenticated session.", req.originalUrl || req.path)],
    last_updated: new Date().toISOString(),
  });
}

function requireOrderingSeedAccess(req: Request, res: Response, next: NextFunction) {
  if (process.env.NODE_ENV === "production" && process.env.ORDERING_ADMIN_SEED_ENABLED !== "true") {
    return res.status(403).json({
      ok: false,
      source: "sbb_ordering_os_phase1",
      data: null,
      warnings: [],
      blockers: [orderingBlocker("ORDERING_SEED_DISABLED", "Ordering test menu seed is disabled in production unless ORDERING_ADMIN_SEED_ENABLED=true.", "POST /api/ordering/admin/seed-test-menu")],
      last_updated: new Date().toISOString(),
    });
  }
  return requireOrderingAdmin(req, res, next);
}

router.get("/menu", async (_req, res) => {
  try {
    const menu = await getMenu(false);
    res.json(menu);
  } catch (error) {
    sendError(res, error, "GET /api/ordering/menu");
  }
});

router.post("/orders", async (req, res) => {
  try {
    const order = await createOrder(req.body);
    res.status(201).json({ ok: true, source: "sbb_ordering_os_phase1", data: order, warnings: [], blockers: [], last_updated: new Date().toISOString() });
  } catch (error: any) {
    sendError(res, error, "POST /api/ordering/orders", 400);
  }
});

router.get("/orders/:id", async (req, res) => {
  try {
    const order = await getOrder(req.params.id);
    if (!order) return sendError(res, { message: "Order not found", code: "ORDER_NOT_FOUND" }, "GET /api/ordering/orders/:id", 404);
    res.json({ ok: true, source: "sbb_ordering_os_phase1", data: order, warnings: [], blockers: [], last_updated: new Date().toISOString() });
  } catch (error) {
    sendError(res, error, "GET /api/ordering/orders/:id");
  }
});

router.patch("/orders/:id/status", async (req, res) => {
  try {
    const order = await updateOrderStatus(req.params.id, req.body.status, req.body.actor || "staff", req.body.notes || null);
    res.json({ ok: true, source: "sbb_ordering_os_phase1", data: order, warnings: [], blockers: [], last_updated: new Date().toISOString() });
  } catch (error: any) {
    sendError(res, error, "PATCH /api/ordering/orders/:id/status", error?.message === "Order not found" ? 404 : 400);
  }
});

router.get("/kitchen/orders", async (_req, res) => {
  try {
    const orders = await listOrders({ kitchen: true });
    res.json({ ok: true, source: "sbb_ordering_os_phase1", data: orders, warnings: [], blockers: [], last_updated: new Date().toISOString() });
  } catch (error) {
    sendError(res, error, "GET /api/ordering/kitchen/orders");
  }
});

router.get("/admin/orders", requireOrderingAdmin, async (req, res) => {
  try {
    const orders = await listOrders({ status: typeof req.query.status === "string" ? req.query.status : undefined, limit: 250 });
    res.json({ ok: true, source: "sbb_ordering_os_phase1", data: orders, warnings: [], blockers: [], last_updated: new Date().toISOString() });
  } catch (error) {
    sendError(res, error, "GET /api/ordering/admin/orders");
  }
});

router.post("/payments/manual-confirm", requireOrderingAdmin, async (req, res) => {
  try {
    const payments = await confirmManualPayment(req.body.order_id, req.body);
    res.json({ ok: true, source: "sbb_ordering_os_phase1", data: payments, warnings: [], blockers: [], last_updated: new Date().toISOString() });
  } catch (error) {
    sendError(res, error, "POST /api/ordering/payments/manual-confirm", 400);
  }
});

router.get("/settings", async (_req, res) => {
  try {
    res.json({ ok: true, source: "sbb_ordering_os_phase1", data: await getSettings(), warnings: [], blockers: [], last_updated: new Date().toISOString() });
  } catch (error) {
    sendError(res, error, "GET /api/ordering/settings");
  }
});

router.patch("/settings", requireOrderingAdmin, async (req, res) => {
  try {
    res.json({ ok: true, source: "sbb_ordering_os_phase1", data: await updateSettings(req.body), warnings: [], blockers: [], last_updated: new Date().toISOString() });
  } catch (error) {
    sendError(res, error, "PATCH /api/ordering/settings", 400);
  }
});

router.get("/admin/menu", requireOrderingAdmin, async (_req, res) => {
  try {
    res.json(await getMenu(true));
  } catch (error) {
    sendError(res, error, "GET /api/ordering/admin/menu");
  }
});
function adminAction(handler: (req: Request, res: Response) => Promise<void>, where: string) {
  return async (req: Request, res: Response) => {
    try {
      await handler(req, res);
    } catch (error) {
      sendError(res, error, where, 400);
    }
  };
}

router.post("/admin/categories", requireOrderingAdmin, adminAction(async (req, res) => {
  res.status(201).json({ ok: true, source: "sbb_ordering_os_phase1", data: await createCategory(req.body), warnings: [], blockers: [], last_updated: new Date().toISOString() });
}, "POST /api/ordering/admin/categories"));

router.patch("/admin/categories/:id", requireOrderingAdmin, adminAction(async (req, res) => {
  res.json({ ok: true, source: "sbb_ordering_os_phase1", data: await updateCategory(req.params.id, req.body), warnings: [], blockers: [], last_updated: new Date().toISOString() });
}, "PATCH /api/ordering/admin/categories/:id"));

router.post("/admin/items", requireOrderingAdmin, adminAction(async (req, res) => {
  res.status(201).json({ ok: true, source: "sbb_ordering_os_phase1", data: await createMenuItem(req.body), warnings: [], blockers: [], last_updated: new Date().toISOString() });
}, "POST /api/ordering/admin/items"));

router.patch("/admin/items/:id", requireOrderingAdmin, adminAction(async (req, res) => {
  res.json({ ok: true, source: "sbb_ordering_os_phase1", data: await updateMenuItem(req.params.id, req.body), warnings: [], blockers: [], last_updated: new Date().toISOString() });
}, "PATCH /api/ordering/admin/items/:id"));

router.post("/admin/modifier-groups", requireOrderingAdmin, adminAction(async (req, res) => {
  res.status(201).json({ ok: true, source: "sbb_ordering_os_phase1", data: await createModifierGroup(req.body), warnings: [], blockers: [], last_updated: new Date().toISOString() });
}, "POST /api/ordering/admin/modifier-groups"));

router.patch("/admin/modifier-groups/:id", requireOrderingAdmin, adminAction(async (req, res) => {
  res.json({ ok: true, source: "sbb_ordering_os_phase1", data: await updateModifierGroup(req.params.id, req.body), warnings: [], blockers: [], last_updated: new Date().toISOString() });
}, "PATCH /api/ordering/admin/modifier-groups/:id"));

router.post("/admin/item-modifiers", requireOrderingAdmin, adminAction(async (req, res) => {
  res.status(201).json({ ok: true, source: "sbb_ordering_os_phase1", data: await createItemModifier(req.body), warnings: [], blockers: [], last_updated: new Date().toISOString() });
}, "POST /api/ordering/admin/item-modifiers"));

router.patch("/admin/item-modifiers/:id", requireOrderingAdmin, adminAction(async (req, res) => {
  res.json({ ok: true, source: "sbb_ordering_os_phase1", data: await updateItemModifier(req.params.id, req.body), warnings: [], blockers: [], last_updated: new Date().toISOString() });
}, "PATCH /api/ordering/admin/item-modifiers/:id"));

router.get("/admin/tables", requireOrderingAdmin, adminAction(async (_req, res) => {
  res.json({ ok: true, source: "sbb_ordering_os_phase1", data: await listVenueTables(), warnings: [], blockers: [], last_updated: new Date().toISOString() });
}, "GET /api/ordering/admin/tables"));

router.post("/admin/tables", requireOrderingAdmin, adminAction(async (req, res) => {
  res.status(201).json({ ok: true, source: "sbb_ordering_os_phase1", data: await createVenueTable(req.body), warnings: [], blockers: [], last_updated: new Date().toISOString() });
}, "POST /api/ordering/admin/tables"));

router.post("/admin/seed-test-menu", requireOrderingSeedAccess, adminAction(async (req, res) => {
  const seeded = await seedPhase1TestMenu(req.body?.actor || "admin");
  res.status(201).json({
    ok: true,
    source: "sbb_ordering_os_phase1",
    data: seeded,
    warnings: [seeded.warning],
    blockers: [],
    last_updated: new Date().toISOString(),
  });
}, "POST /api/ordering/admin/seed-test-menu"));

export default router;
