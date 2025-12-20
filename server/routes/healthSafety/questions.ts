import { Router, Request, Response, NextFunction } from "express";
import { prisma } from "../../../lib/prisma";

const router = Router();

function requireOwner(req: Request, res: Response, next: NextFunction) {
  const user = (req as any).user;
  if (user?.role !== "OWNER") {
    return res.status(403).json({ error: "Owner access required" });
  }
  next();
}

router.get("/", async (_req, res) => {
  const questions = await prisma.healthSafetyQuestion.findMany({
    where: { isActive: true },
    orderBy: [{ section: "asc" }, { sortOrder: "asc" }],
  });
  res.json(questions);
});

router.get("/all", async (_req, res) => {
  const questions = await prisma.healthSafetyQuestion.findMany({
    orderBy: [{ section: "asc" }, { sortOrder: "asc" }],
  });
  res.json(questions);
});

router.post("/", requireOwner, async (req, res) => {
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

router.put("/:id", requireOwner, async (req, res) => {
  const { id } = req.params;
  const { section, label, isCritical, isActive, sortOrder } = req.body;

  const question = await prisma.healthSafetyQuestion.update({
    where: { id },
    data: { section, label, isCritical, isActive, sortOrder },
  });

  res.json(question);
});

router.delete("/:id", requireOwner, async (req, res) => {
  const { id } = req.params;

  await prisma.healthSafetyQuestion.update({
    where: { id },
    data: { isActive: false },
  });

  res.json({ success: true });
});

export default router;
