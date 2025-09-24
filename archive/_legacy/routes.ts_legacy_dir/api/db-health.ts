import express from 'express';
import { PrismaClient } from '@prisma/client';

const router = express.Router();
const prisma = new PrismaClient();

router.get('/', async (req, res) => {
  try {
    const [dbInfo] = await prisma.$queryRawUnsafe(`
      SELECT current_database() AS db,
             inet_server_addr() AS host,
             inet_server_port() AS port,
             current_user AS user
    `);

    const [dsExists] = await prisma.$queryRawUnsafe(`
      SELECT to_regclass('public."DailyStock"') AS dailystock_regclass
    `);

    res.status(200).json({ dbInfo, tables: dsExists });
  } catch (e) {
    console.error('db-health error', e);
    res.status(500).json({ error: 'db-health failed' });
  }
});

export default router;