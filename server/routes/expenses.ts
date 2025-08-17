import { Router } from "express";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
export const expensesRouter = Router();

expensesRouter.post("/rolls", async (req, res) => {
  const { amount, timestamp, cost, status } = req.body || {};
  await prisma.shoppingPurchaseV2.create({
    data: {
      item: `Rolls x${amount}`, cost: Number(cost || 0), shop: status || "unpaid",
      salesId: req.body.salesId ?? "standalone" // or null if permitted by schema
    }
  });
  res.json({ ok: true });
});

expensesRouter.post("/meat", async (req, res) => {
  const { weightG, meatType, timestamp } = req.body || {};
  await prisma.otherExpenseV2.create({
    data: {
      label: `Meat ${meatType || ""} ${weightG || 0}g`, amount: 0, salesId: req.body.salesId ?? "standalone"
    }
  });
  res.json({ ok: true });
});

expensesRouter.post("/drinks", async (req, res) => {
  const { drink, qty, timestamp } = req.body || {};
  await prisma.otherExpenseV2.create({
    data: {
      label: `Drinks ${drink} x${qty}`, amount: 0, salesId: req.body.salesId ?? "standalone"
    }
  });
  res.json({ ok: true });
});