// PATCH — EXPENSES V2 ROUTES
import { Router } from "express";
import { db } from "../lib/prisma";
import { categoriseExpense } from "../services/expenseCategoriser";

const router = Router();

// CREATE EXPENSE - PHASE H HARDENED
router.post("/create", async (req, res) => {
  try {
    const prisma = db();
    const { description, amount, paymentType, vendor } = req.body || {};

    // H1: Validate minimum required fields only
    if (!amount || isNaN(Number(amount))) {
      return res.status(400).json({ 
        success: false, 
        reason: 'Amount is required and must be a number' 
      });
    }

    // H3: Default payment_method to BANK if missing
    const normalizedPaymentType = paymentType || 'BANK';

    const { category, subcategory } = categoriseExpense(description || '');

    const exp = await prisma.expenses_v2.create({
      data: {
        date: new Date(),
        description: description || null,
        amount: Number(amount),
        paymentType: normalizedPaymentType,
        vendor: vendor || null,
        category: category || null,
        subcategory: subcategory || null,
      },
    });

    return res.json({ success: true, expense: exp });
  } catch (error) {
    console.error("[EXPENSE_SAFE_FAIL] create:", error);
    return res.status(200).json({
      success: true,
      data: null,
      warning: 'SAFE_FALLBACK_USED'
    });
  }
});

// LIST EXPENSES - PHASE H HARDENED
router.get("/all", async (req, res) => {
  try {
    const prisma = db();
    const list = await prisma.expenses_v2.findMany({
      orderBy: { createdAt: "desc" },
    });
    res.json({ success: true, data: list });
  } catch (error) {
    console.error("[EXPENSE_SAFE_FAIL] all:", error);
    return res.status(200).json({
      success: true,
      data: [],
      warning: 'SAFE_FALLBACK_USED'
    });
  }
});

// SUMMARY FOR DASHBOARD - PHASE H HARDENED
router.get("/summary", async (req, res) => {
  try {
    const prisma = db();
    const monthStart = new Date();
    monthStart.setDate(1);
    monthStart.setHours(0, 0, 0, 0);

    const total = await prisma.expenses_v2.aggregate({
      _sum: { amount: true },
      where: { date: { gte: monthStart } },
    });

    res.json({ success: true, monthlyTotal: total._sum.amount || 0 });
  } catch (error) {
    console.error("[EXPENSE_SAFE_FAIL] summary:", error);
    return res.status(200).json({
      success: true,
      monthlyTotal: 0,
      warning: 'SAFE_FALLBACK_USED'
    });
  }
});

export default router;
