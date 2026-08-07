import { Router } from "express";
import { PrismaClient } from "@prisma/client";

const router = Router();
const prisma = new PrismaClient();

async function historicalStatus() {
  const [receipts, shifts] = await Promise.all([
    prisma.$queryRaw<any[]>`
      SELECT COUNT(*)::int AS count, MAX(datetime_bkk) AS latest_receipt_at, MAX(created_at) AS latest_sync_at
      FROM lv_receipt
    `.catch(() => []),
    prisma.$queryRaw<any[]>`
      SELECT COUNT(*)::int AS count, MAX(shift_date) AS latest_shift_date
      FROM loyverse_shifts
    `.catch(() => []),
  ]);
  return {
    receipts: {
      count: Number(receipts[0]?.count || 0),
      latestReceiptAt: receipts[0]?.latest_receipt_at ?? null,
      latestSyncAt: receipts[0]?.latest_sync_at ?? null,
    },
    shifts: {
      count: Number(shifts[0]?.count || 0),
      latestShiftDate: shifts[0]?.latest_shift_date ?? null,
    },
  };
}

// Historical archive status only. This endpoint never contacts Loyverse.
router.get("/sync", async (_req, res) => {
  const data = await historicalStatus();
  res.json({
    ok: true,
    disabled: true,
    source: "historical_loyverse_archive",
    liveSourceOfTruth: "sbb_pos_core",
    message: "Loyverse live sync is retired. Historical records are retained read-only.",
    data,
  });
});

// Manual API synchronization is intentionally retired.
router.post("/sync", (_req, res) => {
  res.status(410).json({
    ok: false,
    disabled: true,
    source: "sbb_pos_core",
    error: "Loyverse live sync is retired. Historical data must be loaded through the controlled historical import workflow.",
  });
});

router.get("/sync-health", async (_req, res) => {
  const data = await historicalStatus();
  res.json({
    ok: true,
    disabled: true,
    liveSourceOfTruth: "sbb_pos_core",
    automaticSync: false,
    apiCallsEnabled: false,
    historicalArchive: data,
  });
});

export default router;
