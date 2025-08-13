// src/app/api/analysis/[shiftId]/route.ts
import { NextRequest } from "next/server";
import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();

export async function GET(_: NextRequest, { params }: { params: { shiftId: string } }) {
  const shiftId = params.shiftId;

  // Snapshot is the single source of truth if present
  const snap = await prisma.shiftSnapshots.findUnique({ where: { id: shiftId } }).catch(() => null);
  if (!snap) {
    return new Response(JSON.stringify({ ok: false, error: "NO_SNAPSHOT" }), { status: 404 });
  }

  // Staff forms (optional)
  const sales = await prisma.dailySales.findFirst({ where: { shiftId } }).catch(() => null);
  const stock = sales ? await prisma.dailyStock.findFirst({ where: { salesFormId: sales.id } }).catch(() => null) : null;

  const bankingDiff =
    ((sales?.cashBanked ?? 0) + (sales?.qrTransfer ?? 0)) - (snap.total_sales_baht ?? 0);

  return new Response(JSON.stringify({
    ok: true,
    meta: {
      shiftId,
      window: { start: snap.shift_start, end: snap.shift_end },
      computedAt: snap.computed_at,
      source: "snapshot→receipts",
    },
    payments: snap.payments_breakdown,
    totals: {
      receipts: snap.total_receipts,
      salesBaht: snap.total_sales_baht,
    },
    staff: {
      closingCash: sales?.closingCash ?? null,
      cashBanked: sales?.cashBanked ?? null,
      qrTransfer: sales?.qrTransfer ?? null,
    },
    variances: {
      bankingDiff,
    },
  }), { headers: { "content-type": "application/json" } });
}
