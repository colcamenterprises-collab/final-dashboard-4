import { Router } from "express";
import { PrismaClient, Prisma } from "@prisma/client";
const router = Router();
const prisma = new PrismaClient();

router.get("/health", async (_req, res) => {
  try {
    const ping = await prisma.$queryRaw`SELECT 1 as ok`;
    res.json({
      ok: true,
      openssl: process.versions.openssl,
      prisma: Prisma.prismaVersion,
      db: ping,
      env: {
        node_env: process.env.NODE_ENV,
        database_url_set: Boolean(process.env.DATABASE_URL),
      },
    });
  } catch (e: any) {
    res.status(500).json({ ok: false, error: e.message });
  }
});

export default router;
