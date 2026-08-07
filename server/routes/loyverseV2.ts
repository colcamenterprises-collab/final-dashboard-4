import { Router, type Request, type Response, type NextFunction } from "express";
import { PrismaClient } from "@prisma/client";
import { attachSessionUser, requireSessionAuth } from "../middleware/sessionAuth.js";
import { getPinSessionUser } from "./pinAuth.js";

const router = Router();
const prisma = new PrismaClient();

function requireArchiveAuth(req: Request, res: Response, next: NextFunction) {
  if (res.locals.isBotRequest) return next();
  if (attachSessionUser(req)) return next();
  const pinUser = getPinSessionUser(req);
  if (pinUser?.role === "owner") return next();
  return res.status(401).json({ ok: false, error: "Unauthorized" });
}

async function archiveDiagnostic() {
  const [receipts, items, modifiers, shifts] = await Promise.all([
    prisma.$queryRaw<any[]>`SELECT COUNT(*)::int AS total, MAX(datetime_bkk) AS latest_receipt, MAX(created_at) AS latest_sync FROM lv_receipt`.catch(() => []),
    prisma.$queryRaw<any[]>`SELECT COUNT(*)::int AS total, MAX(created_at) AS latest_sync FROM lv_line_item`.catch(() => []),
    prisma.$queryRaw<any[]>`SELECT COUNT(*)::int AS total, MAX(created_at) AS latest_sync FROM lv_modifier`.catch(() => []),
    prisma.$queryRaw<any[]>`SELECT COUNT(*)::int AS total, MAX(shift_date) AS latest_shift FROM loyverse_shifts`.catch(() => []),
  ]);

  return {
    status: "archive",
    disabled: true,
    liveSourceOfTruth: "sbb_pos_core",
    automaticSync: false,
    apiCallsEnabled: false,
    latestSyncAt: receipts[0]?.latest_sync ?? null,
    latestReceiptDate: receipts[0]?.latest_receipt ?? null,
    latestShiftDate: shifts[0]?.latest_shift ?? null,
    canonicalTables: {
      lv_receipt: { rows: Number(receipts[0]?.total || 0), latestReceipt: receipts[0]?.latest_receipt ?? null },
      lv_line_item: { rows: Number(items[0]?.total || 0) },
      lv_modifier: { rows: Number(modifiers[0]?.total || 0) },
      loyverse_shifts: { rows: Number(shifts[0]?.total || 0), latestShift: shifts[0]?.latest_shift ?? null },
    },
    receiptCounts: { historical: Number(receipts[0]?.total || 0) },
    integrity: { mode: "read_only_archive" },
    paymentMapping: { mappedPayments: [], unmappedPayments: [], rules: {} },
    latestShiftComparison: null,
    sevenDayComparison: [],
    mismatches: [],
    blockers: [],
    sourceMap: {
      live: "ordering_orders / ordering_order_items / ordering_order_item_modifiers / pos_shifts",
      historical: "lv_receipt / lv_line_item / lv_modifier / loyverse_shifts",
    },
  };
}

router.get("/loyverse/mirror-diagnostic", requireArchiveAuth, async (_req, res) => {
  res.json(await archiveDiagnostic());
});

router.get("/loyverse/mirror-ui-data", requireSessionAuth, async (_req, res) => {
  res.json(await archiveDiagnostic());
});

const retiredSync = (_req: Request, res: Response) => res.status(410).json({
  ok: false,
  disabled: true,
  liveSourceOfTruth: "sbb_pos_core",
  error: "Loyverse live synchronization is retired. Use the controlled historical import workflow for archive data.",
});

router.post("/loyverse/sync", retiredSync);
router.post("/loyverse/sync-missing-shifts", retiredSync);

export default router;
