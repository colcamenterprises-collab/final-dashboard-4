import express from "express";
import { db } from "../db";
import { bankImportBatch, bankTxn } from "../../shared/schema";
import { eq, sql } from "drizzle-orm";
import { z } from "zod";
import { getPinSessionUser } from "./pinAuth";
import directorBeneficiaryLoansRouter from "./directorBeneficiaryLoans";

const router = express.Router();
router.use("/director-beneficiary-loans", directorBeneficiaryLoansRouter);

const BUSINESS_EXPENSE_CATEGORIES = [
  "Review",
  "Food & Beverage",
  "Kitchen Supplies & Packaging",
  "Utilities",
  "Rent",
  "Staff Expenses",
  "Repairs & Maintenance",
  "Marketing",
  "Administration",
  "Software & Subscriptions",
  "Bank Fees",
  "Equipment",
  "Fuel & Transport",
  "Other Business Expense",
] as const;

const NON_BUSINESS_CATEGORIES = [
  "Personal / Owner",
  "Deposit / Inflow",
  "Transfer",
  "Ignore / Duplicate",
] as const;

const FAST_REVIEW_CATEGORIES = [...BUSINESS_EXPENSE_CATEGORIES, ...NON_BUSINESS_CATEGORIES] as const;

function requireOwner(req: any, res: any): boolean {
  const user = getPinSessionUser(req);
  if (!user || user.role !== "owner") {
    res.status(403).json({ error: "Owner access required" });
    return false;
  }
  return true;
}

async function resolveBusinessExpenseRestaurantId(req: any): Promise<string | null> {
  const requestedRestaurantId = typeof req.headers["x-restaurant-id"] === "string"
    ? req.headers["x-restaurant-id"].trim()
    : "";

  if (requestedRestaurantId) {
    const { rows } = await db.execute(sql`
      SELECT id FROM restaurants WHERE id = ${requestedRestaurantId} LIMIT 1
    `);
    if (rows?.[0]?.id) return String(rows[0].id);
  }

  const { rows } = await db.execute(sql`
    SELECT e."restaurantId" AS id
    FROM expenses e
    JOIN restaurants r ON r.id = e."restaurantId"
    WHERE COALESCE(e.source, 'DIRECT') NOT IN ('SHIFT_FORM', 'STOCK_LODGMENT')
    ORDER BY e."createdAt" DESC NULLS LAST
    LIMIT 1
  `);

  return rows?.[0]?.id ? String(rows[0].id) : null;
}

function isBusinessCategory(category: string): boolean {
  return BUSINESS_EXPENSE_CATEGORIES.includes(category as (typeof BUSINESS_EXPENSE_CATEGORIES)[number]);
}

// PHASE H HARDENED - All finance routes with safe fallbacks

router.get("/summary", async (_req, res) => {
  try {
    const { rows } = await db.execute(sql`
      SELECT payload
      FROM "daily_sales_v2"
      ORDER BY "createdAt" DESC
      LIMIT 1
    `);
    const payload = rows?.[0]?.payload || {};
    return res.json({ success: true, data: payload.finance_summary || {} });
  } catch (err) {
    console.error('[EXPENSE_SAFE_FAIL] finance/summary:', err);
    return res.status(200).json({
      success: true,
      data: {},
      warning: 'SAFE_FALLBACK_USED'
    });
  }
});

// GET /api/finance/summary/today - Current Month Sales and Expenses
router.get("/summary/today", async (_req, res) => {
  try {
    const now = new Date();

    // Use Asia/Bangkok business month boundaries from POS shift reports.
    const { rows } = await db.execute(sql`
      WITH month_window AS (
        SELECT
          date_trunc('month', (now() AT TIME ZONE 'Asia/Bangkok'))::date AS month_start,
          (date_trunc('month', (now() AT TIME ZONE 'Asia/Bangkok')) + interval '1 month')::date AS next_month_start
      )
      SELECT
        COALESCE(SUM("netSales"), 0) AS total_sales,
        COUNT(*)::int AS shift_count
      FROM "PosShiftReport", month_window
      WHERE "businessDate" >= month_window.month_start
        AND "businessDate" < month_window.next_month_start
        AND "businessDate" IS NOT NULL
    `);
    
    // Get shift expenses from PosShiftReport for current month
    const expenseResult = await db.execute(sql`
      SELECT 
        COALESCE(SUM("shoppingTotal"), 0) as shopping_total,
        COALESCE(SUM("wagesTotal"), 0) as wages_total,
        COALESCE(SUM("otherExpense"), 0) as other_total
      FROM "PosShiftReport"
      WHERE "businessDate" >= date_trunc('month', (now() AT TIME ZONE 'Asia/Bangkok'))::date
        AND "businessDate" < (date_trunc('month', (now() AT TIME ZONE 'Asia/Bangkok')) + interval '1 month')::date
        AND "businessDate" IS NOT NULL
    `);
    
    // Get business expenses from expenses table for current month (amount stored in cents as costCents)
    const businessExpenseResult = await db.execute(sql`
      SELECT 
        COALESCE(SUM("costCents") / 100.0, 0) as business_total
      FROM expenses
      WHERE ("shiftDate" AT TIME ZONE 'Asia/Bangkok')::date >= date_trunc('month', (now() AT TIME ZONE 'Asia/Bangkok'))::date
        AND ("shiftDate" AT TIME ZONE 'Asia/Bangkok')::date < (date_trunc('month', (now() AT TIME ZONE 'Asia/Bangkok')) + interval '1 month')::date
    `);
    
    const currentMonthSales = parseFloat(rows[0]?.total_sales || '0');
    const shiftCount = parseInt(rows[0]?.shift_count || '0');

    const bangkokNow = new Date(now.toLocaleString('en-US', { timeZone: 'Asia/Bangkok' }));
    const expectedCompletedShifts = Math.max(bangkokNow.getDate() - 1, 0);
    const missingShiftReports = Math.max(expectedCompletedShifts - shiftCount, 0);

    const latestShiftResult = await db.execute(sql`
      SELECT MAX("businessDate") AS latest_business_date
      FROM "PosShiftReport"
      WHERE "businessDate" >= date_trunc('month', (now() AT TIME ZONE 'Asia/Bangkok'))::date
        AND "businessDate" < (date_trunc('month', (now() AT TIME ZONE 'Asia/Bangkok')) + interval '1 month')::date
        AND "businessDate" IS NOT NULL
    `);

    const latestBusinessDate = latestShiftResult.rows[0]?.latest_business_date || null;
    
    const shoppingExpenses = parseFloat(expenseResult.rows[0]?.shopping_total || '0');
    const wagesExpenses = parseFloat(expenseResult.rows[0]?.wages_total || '0');
    const otherExpenses = parseFloat(expenseResult.rows[0]?.other_total || '0');
    const shiftExpensesTotal = shoppingExpenses + wagesExpenses + otherExpenses;
    
    const businessExpenses = parseFloat(businessExpenseResult.rows[0]?.business_total || '0');
    
    const totalExpenses = shiftExpensesTotal + businessExpenses;
    
    return res.json({
      sales: currentMonthSales,
      currentMonthSales,
      shiftCount,
      shiftCoverage: {
        expectedCompletedShifts,
        syncedShiftReports: shiftCount,
        missingShiftReports,
        latestBusinessDate,
        status: missingShiftReports > 0 ? 'MISSING_SHIFT_REPORTS' : 'OK',
      },
      expenses: totalExpenses,
      currentMonthExpenses: totalExpenses,
      expenseBreakdown: {
        shopping: shoppingExpenses,
        wages: wagesExpenses,
        other: otherExpenses,
        business: businessExpenses,
        shiftTotal: shiftExpensesTotal
      },
      month: now.toLocaleString('en-US', { month: 'long', year: 'numeric' }),
      netProfit: currentMonthSales - totalExpenses,
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    console.error('[EXPENSE_SAFE_FAIL] finance/summary/today:', error);
    return res.status(200).json({
      success: true,
      sales: 0,
      currentMonthSales: 0,
      shiftCount: 0,
      shiftCoverage: {
        expectedCompletedShifts: 0,
        syncedShiftReports: 0,
        missingShiftReports: 0,
        latestBusinessDate: null,
        status: 'MISSING_DATA',
      },
      expenses: 0,
      currentMonthExpenses: 0,
      expenseBreakdown: {
        shopping: 0,
        wages: 0,
        other: 0,
        business: 0,
        shiftTotal: 0
      },
      month: new Date().toLocaleString('en-US', { month: 'long', year: 'numeric' }),
      netProfit: 0,
      timestamp: new Date().toISOString(),
      warning: 'SAFE_FALLBACK_USED'
    });
  }
});

// POST /api/finance/bank-imports/:batchId/finalize
// Every imported withdrawal becomes a reporting-ready business expense immediately.
// Deposits remain reconciliation-only. Review is a category, not an approval gate.
router.post("/bank-imports/:batchId/finalize", async (req, res) => {
  try {
    if (!requireOwner(req, res)) return;
    const { batchId } = req.params;
    const restaurantId = await resolveBusinessExpenseRestaurantId(req);
    if (!restaurantId) {
      return res.status(400).json({
        error: "Restaurant context is required before imported withdrawals can become business expenses",
        code: "BANK_IMPORT_RESTAURANT_CONTEXT_MISSING",
      });
    }

    const result = await db.transaction(async (tx) => {
      const insertResult = await tx.execute(sql`
        INSERT INTO expenses (
          id, "restaurantId", "shiftDate", supplier, "costCents", item,
          "expenseType", meta, source, "createdAt"
        )
        SELECT
          'bank_txn:' || transaction.id,
          ${restaurantId},
          transaction.posted_at,
          COALESCE(NULLIF(transaction.supplier, ''), transaction.description),
          ROUND(transaction.amount_thb)::int,
          transaction.description,
          'Review',
          jsonb_build_object(
            'source', 'bank_import',
            'bankTxnId', transaction.id,
            'bankImportBatchId', transaction.batch_id,
            'bankRef', transaction.ref,
            'notes', transaction.notes,
            'dedupeKey', transaction.dedupe_key,
            'amountTHB', transaction.amount_thb,
            'amountUnit', 'THB',
            'autoApprovedOnImport', true
          ),
          'BANK_UPLOAD',
          now()
        FROM bank_txn transaction
        WHERE transaction.batch_id = ${batchId}
          AND transaction.amount_thb > 0
          AND transaction.status = 'pending'
        ON CONFLICT (id) DO NOTHING
        RETURNING id
      `);

      const updatedResult = await tx.execute(sql`
        UPDATE bank_txn transaction
        SET
          status = 'approved',
          category = 'Review',
          supplier = COALESCE(NULLIF(transaction.supplier, ''), transaction.description),
          expense_id = 'bank_txn:' || transaction.id
        WHERE transaction.batch_id = ${batchId}
          AND transaction.amount_thb > 0
          AND transaction.status = 'pending'
        RETURNING transaction.id
      `);

      const [{ count: remainingPending }] = await tx
        .select({ count: sql<number>`count(*)` })
        .from(bankTxn)
        .where(eq(bankTxn.batchId, batchId));

      await tx.update(bankImportBatch)
        .set({ status: Number(remainingPending || 0) === 0 ? 'approved' : 'partially_approved' })
        .where(eq(bankImportBatch.id, batchId));

      return {
        created: insertResult.rows?.length || 0,
        activated: updatedResult.rows?.length || 0,
      };
    });

    return res.json({
      ok: true,
      batchId,
      category: "Review",
      reportingReady: true,
      ...result,
    });
  } catch (error: any) {
    console.error("[FAST_BANK_IMPORT_FINALIZE_FAILED]", error);
    return res.status(500).json({
      error: "Failed to activate imported business expenses",
      reason: error?.message || String(error),
    });
  }
});

const fastBankTxnUpdateSchema = z.object({
  category: z.enum(FAST_REVIEW_CATEGORIES).optional(),
  description: z.string().trim().min(1).max(500).optional(),
  supplier: z.string().max(500).optional(),
  notes: z.string().max(2000).optional(),
});

// PATCH /api/finance/bank-imports/txns/:id
// Lightweight classification/edit endpoint. It synchronizes the linked expense without
// requiring approval and without forcing the client to refetch the full finance dashboard.
router.patch("/bank-imports/txns/:id", async (req, res) => {
  try {
    if (!requireOwner(req, res)) return;
    const { id } = req.params;
    const updates = fastBankTxnUpdateSchema.parse(req.body || {});
    const [currentTxn] = await db.select().from(bankTxn).where(eq(bankTxn.id, id)).limit(1);
    if (!currentTxn) return res.status(404).json({ error: "Transaction not found" });

    const nextCategory = updates.category ?? currentTxn.category ?? "Review";
    const nextDescription = updates.description ?? currentTxn.description;
    const nextSupplier = (updates.supplier ?? currentTxn.supplier ?? nextDescription).trim() || nextDescription;
    const nextNotes = updates.notes ?? currentTxn.notes ?? null;
    const owner = getPinSessionUser(req)!;
    const expenseId = currentTxn.expenseId || `bank_txn:${currentTxn.id}`;
    const shouldBeBusinessExpense = Number(currentTxn.amountTHB) > 0 && isBusinessCategory(nextCategory);

    const updatedTxn = await db.transaction(async (tx) => {
      if (shouldBeBusinessExpense) {
        let restaurantId: string | null = null;
        if (!currentTxn.expenseId) {
          restaurantId = await resolveBusinessExpenseRestaurantId(req);
          if (!restaurantId) throw new Error("Restaurant context is required to restore this transaction as a business expense");
        }

        if (!currentTxn.expenseId) {
          await tx.execute(sql`
            INSERT INTO expenses (
              id, "restaurantId", "shiftDate", supplier, "costCents", item,
              "expenseType", meta, source, "createdAt"
            ) VALUES (
              ${expenseId},
              ${restaurantId},
              ${currentTxn.postedAt},
              ${nextSupplier},
              ${Math.round(Number(currentTxn.amountTHB))},
              ${nextDescription},
              ${nextCategory},
              ${JSON.stringify({
                source: "bank_import",
                bankTxnId: currentTxn.id,
                bankImportBatchId: currentTxn.batchId,
                bankRef: currentTxn.ref || null,
                notes: nextNotes,
                dedupeKey: currentTxn.dedupeKey,
                amountTHB: Number(currentTxn.amountTHB),
                amountUnit: "THB",
                restoredFromReview: true,
              })}::jsonb,
              'BANK_UPLOAD',
              now()
            )
            ON CONFLICT (id) DO NOTHING
          `);
        }

        await tx.execute(sql`
          UPDATE expenses
          SET
            supplier = ${nextSupplier},
            item = ${nextDescription},
            "expenseType" = ${nextCategory},
            meta = COALESCE(meta, '{}'::jsonb) || jsonb_build_object('notes', ${nextNotes}),
            "shiftDate" = ${currentTxn.postedAt}
          WHERE id = ${expenseId}
        `);
      } else {
        await tx.execute(sql`
          DELETE FROM expenses
          WHERE id = ${expenseId}
             OR id = ${`bank_txn:${currentTxn.id}`}
        `);
      }

      const raw = (currentTxn.raw && typeof currentTxn.raw === "object") ? currentTxn.raw as Record<string, unknown> : {};
      const ownerEditAudit = Array.isArray((raw as any).ownerEditAudit) ? (raw as any).ownerEditAudit : [];
      const nextRaw = {
        ...raw,
        ownerEditAudit: [
          ...ownerEditAudit,
          {
            at: new Date().toISOString(),
            by: { id: owner.id, name: owner.name },
            updates,
            fastReview: true,
          },
        ],
      };

      const [row] = await tx.update(bankTxn)
        .set({
          category: nextCategory,
          description: nextDescription,
          supplier: nextSupplier,
          notes: nextNotes,
          status: shouldBeBusinessExpense ? 'approved' : 'pending',
          expenseId: shouldBeBusinessExpense ? expenseId : null,
          raw: nextRaw,
        })
        .where(eq(bankTxn.id, id))
        .returning();

      return row;
    });

    return res.json({
      ok: true,
      reportingIncluded: shouldBeBusinessExpense,
      txn: updatedTxn,
    });
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: "Invalid transaction update", details: error.issues });
    }
    console.error("[FAST_BANK_TXN_UPDATE_FAILED]", error);
    return res.status(500).json({
      error: "Failed to update imported transaction",
      reason: error?.message || String(error),
    });
  }
});

// DELETE /api/finance/bank-imports/txns/:id
// Delete the reporting expense and retain the bank row as an auditable deleted transaction.
router.delete("/bank-imports/txns/:id", async (req, res) => {
  try {
    if (!requireOwner(req, res)) return;
    const { id } = req.params;
    const [currentTxn] = await db.select().from(bankTxn).where(eq(bankTxn.id, id)).limit(1);
    if (!currentTxn) return res.status(404).json({ error: "Transaction not found" });
    const expenseId = currentTxn.expenseId || `bank_txn:${currentTxn.id}`;

    await db.transaction(async (tx) => {
      await tx.execute(sql`DELETE FROM expenses WHERE id = ${expenseId} OR id = ${`bank_txn:${currentTxn.id}`}`);
      await tx.update(bankTxn)
        .set({ status: 'deleted', expenseId: null })
        .where(eq(bankTxn.id, id));
    });

    return res.json({ ok: true, id });
  } catch (error: any) {
    console.error("[FAST_BANK_TXN_DELETE_FAILED]", error);
    return res.status(500).json({ error: "Failed to delete imported transaction", reason: error?.message || String(error) });
  }
});

export default router;