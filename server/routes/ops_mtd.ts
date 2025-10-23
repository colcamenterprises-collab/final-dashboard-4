import { Router } from "express";
import { startOfMonth, endOfMonth } from "date-fns";
import { PrismaClient } from "@prisma/client";

const router = Router();
const prisma = new PrismaClient();

router.get("/ops/mtd", async (_req, res) => {
  try {
    const start = startOfMonth(new Date());
    const end = endOfMonth(new Date());

    const t1 = await prisma.expense.aggregate({
      _sum: { costCents: true },
      where: {
        shiftDate: { gte: start, lte: end },
        expenseType: "DIRECT"
      },
    });
    
    const t2 = await prisma.expense.aggregate({
      _sum: { costCents: true },
      where: {
        shiftDate: { gte: start, lte: end },
        expenseType: { in: ["STOCK_LODGMENT_ROLLS", "STOCK_LODGMENT_MEAT", "STOCK_LODGMENT_DRINKS"] }
      },
    });

    const table1Total = (t1._sum?.costCents ?? 0);
    const table2Total = (t2._sum?.costCents ?? 0);
    const monthToDate = table1Total + table2Total;

    res.json({ ok: true, table1Total, table2Total, monthToDate });
  } catch (e: any) {
    res.status(500).json({ ok: false, error: e.message });
  }
});

export default router;
