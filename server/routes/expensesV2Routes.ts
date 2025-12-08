// PATCH — EXPENSES V2 ROUTES
import { Router } from "express";
import { db } from "../lib/prisma";
import { categoriseExpense } from "../services/expenseCategoriser";

const router = Router();

// CREATE EXPENSE
router.post("/create", async (req, res) => {
  try {
    const prisma = db();
    const { description, amount, paymentType, vendor } = req.body;

    const { category, subcategory } = categoriseExpense(description);

    const exp = await prisma.expenses_v2.create({
      data: {
        date: new Date(),
        description,
        amount: Number(amount),
        paymentType,
        vendor,
        category,
        subcategory,
      },
    });

    return res.json({ success: true, expense: exp });
  } catch (error) {
    console.error("EXPENSE CREATE ERROR:", error);
    res.status(500).json({ error: "Failed to create expense" });
  }
});

// LIST EXPENSES
router.get("/all", async (req, res) => {
  try {
    const prisma = db();
    const list = await prisma.expenses_v2.findMany({
      orderBy: { createdAt: "desc" },
    });
    res.json(list);
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch expenses" });
  }
});

// SUMMARY FOR DASHBOARD
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

    res.json({ monthlyTotal: total._sum.amount || 0 });
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch summary" });
  }
});

export default router;
