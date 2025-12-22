import { prisma } from "../../lib/prisma";

export async function rebuildPnlExpenses() {
  await prisma.pnlExpense.deleteMany();

  let businessCount = 0;
  let shiftCount = 0;

  /** -------------------------
   * BUSINESS EXPENSES (BANK)
   * Using expenses_v2 table
   * ------------------------*/
  const expenses = await prisma.expenses_v2.findMany();

  for (const exp of expenses) {
    await prisma.pnlExpense.create({
      data: {
        sourceType: "BUSINESS",
        sourceId: exp.id,
        date: exp.date,
        shiftId: null,
        amount: exp.amount,
        category: exp.category ?? "Uncategorised",
        paymentMethod: exp.paymentType === "CASH" ? "CASH" : "BANK"
      }
    });
    businessCount++;
  }

  /** -------------------------
   * SHIFT EXPENSES (CASH)
   * ------------------------*/

  // Shopping purchases
  const shopping = await prisma.shoppingPurchase.findMany({
    include: { sales: true }
  });
  for (const s of shopping) {
    await prisma.pnlExpense.create({
      data: {
        sourceType: "SHIFT",
        sourceId: s.id,
        date: s.createdAt,
        shiftId: s.sales?.shiftDate ?? null,
        amount: s.cost,
        category: "Shopping",
        paymentMethod: "CASH"
      }
    });
    shiftCount++;
  }

  // Wages
  const wages = await prisma.wageEntry.findMany({
    include: { sales: true }
  });
  for (const w of wages) {
    await prisma.pnlExpense.create({
      data: {
        sourceType: "SHIFT",
        sourceId: w.id,
        date: w.createdAt,
        shiftId: w.sales?.shiftDate ?? null,
        amount: w.amount,
        category: "Wages",
        paymentMethod: "CASH"
      }
    });
    shiftCount++;
  }

  // Other shift expenses
  const others = await prisma.otherExpense.findMany({
    include: { sales: true }
  });
  for (const o of others) {
    await prisma.pnlExpense.create({
      data: {
        sourceType: "SHIFT",
        sourceId: o.id,
        date: o.createdAt,
        shiftId: o.sales?.shiftDate ?? null,
        amount: o.amount,
        category: "Other",
        paymentMethod: "CASH"
      }
    });
    shiftCount++;
  }

  return { businessCount, shiftCount, total: businessCount + shiftCount };
}
