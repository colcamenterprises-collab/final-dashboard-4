import { Router } from "express";
import { prisma } from "../../../lib/prisma";

const router = Router();

router.get("/", async (_req, res) => {
  const questions = await prisma.healthSafetyQuestion.findMany({
    where: { isActive: true },
    orderBy: [{ section: "asc" }, { sortOrder: "asc" }],
  });
  res.json(questions);
});

router.post("/", async (req, res) => {
  const { section, label, isCritical, sortOrder } = req.body;

  const question = await prisma.healthSafetyQuestion.create({
    data: {
      section,
      label,
      isCritical,
      sortOrder,
    },
  });

  res.json(question);
});

router.put("/:id", async (req, res) => {
  const { id } = req.params;
  const { section, label, isCritical, isActive, sortOrder } = req.body;

  const question = await prisma.healthSafetyQuestion.update({
    where: { id },
    data: { section, label, isCritical, isActive, sortOrder },
  });

  res.json(question);
});

router.delete("/:id", async (req, res) => {
  const { id } = req.params;

  await prisma.healthSafetyQuestion.update({
    where: { id },
    data: { isActive: false },
  });

  res.json({ success: true });
});

export default router;
