import { Router } from "express";
import { prisma } from "../../../lib/prisma";

const router = Router();

router.post("/", async (req, res) => {
  const { managerName, items, notes } = req.body;

  const criticalIds = await prisma.healthSafetyQuestion.findMany({
    where: { isCritical: true, isActive: true },
    select: { id: true },
  });

  const criticalSet = new Set(criticalIds.map(q => q.id));

  let status: "PASS" | "FAIL" = "PASS";

  for (const item of items) {
    if (criticalSet.has(item.questionId) && item.checked === false) {
      status = "FAIL";
      break;
    }
  }

  const audit = await prisma.healthSafetyAudit.create({
    data: {
      managerName,
      status,
      notes,
      items: {
        create: items.map((i: any) => ({
          questionId: i.questionId,
          checked: i.checked,
        })),
      },
    },
  });

  res.json(audit);
});

router.get("/", async (_req, res) => {
  const audits = await prisma.healthSafetyAudit.findMany({
    orderBy: { completedAt: "desc" },
    include: {
      items: {
        include: { question: true },
      },
    },
  });

  res.json(audits);
});

export default router;
