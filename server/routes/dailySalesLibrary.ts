import { Router } from "express";
import { PrismaClient } from "@prisma/client";
import { sendDailySalesEmail } from "../services/salesEmail";

const prisma = new PrismaClient();
const r = Router();

r.get("/", async (req, res) => {
  try {
    const { from, to, staff, variance, hasAttach, page="1", pageSize="50" } = req.query as Record<string,string>;
    const pageN = Math.max(1, parseInt(page)), ps = Math.min(200, Math.max(10, parseInt(pageSize)));
    const skip = (pageN-1)*ps;

    const where: any = {};
    if (from) where.createdAt = { gte: new Date(from) };
    if (to) where.createdAt = { ...where.createdAt, lte: new Date(to) };
    if (staff) where.completedBy = { contains: staff, mode: 'insensitive' };

    const rows = await prisma.dailySalesV2.findMany({
      where,
      include: {
        stock: true,
        shopping: true,
        wages: true,
        others: true
      },
      orderBy: [
        { createdAt: 'desc' },
        { id: 'desc' }
      ],
      skip,
      take: ps
    });

    // compute variance & optionally filter variance-only
    const out = rows.map((r: any) => {
      const sumShopping = r.shoppingTotal || 0;
      const expectedClose = (r.startingCash || 0) + (r.cashSales || 0) - sumShopping;
      const variance = (r.endingCash || 0) - expectedClose;
      return { ...r, variance };
    });
    const filtered = variance==="only" ? out.filter(x => Math.abs(x.variance) > 20) : out;

    res.json({ ok: true, rows: filtered, page: pageN, pageSize: ps });
  } catch (e: any) {
    console.error("LIBRARY_ERR", e.code, e.message);
    res.status(500).json({ error: "Failed to fetch daily sales records" });
  }
});

r.get("/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const row = await prisma.dailySalesV2.findUnique({
      where: { id },
      include: {
        stock: true,
        shopping: true,
        wages: true,
        others: true
      }
    });
    if (!row) return res.status(404).json({ error: "Not found" });
    
    // add computed variance
    const sumShopping = row.shoppingTotal || 0;
    const expectedClose = (row.startingCash || 0) + (row.cashSales || 0) - sumShopping;
    const variance = (row.endingCash || 0) - expectedClose;
    
    res.json({ ok: true, ...row, variance });
  } catch (e: any) {
    console.error("LIBRARY_ERR", e.code, e.message);
    res.status(500).json({ error: "Failed to fetch daily sales record" });
  }
});

r.delete("/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const result = await prisma.dailySalesV2.delete({
      where: { id }
    });
    res.json({ ok: true, message: "Daily sales record deleted successfully" });
  } catch (error: any) {
    console.error("Error deleting daily sales record:", error);
    if (error.code === 'P2025') {
      return res.status(404).json({ error: "Daily sales record not found" });
    }
    res.status(500).json({ error: "Failed to delete daily sales record" });
  }
});

r.post("/:id/resend-email", async (req, res) => {
  try {
    const { id } = req.params;
    const row = await prisma.dailySalesV2.findUnique({
      where: { id },
      include: {
        stock: true,
        shopping: true,
        wages: true,
        others: true
      }
    });
    if (!row) return res.status(404).json({ error: "Not found" });
    await sendDailySalesEmail(row);
    res.json({ ok: true });
  } catch (e: any) {
    console.error("LIBRARY_ERR", e.code, e.message);
    res.status(500).json({ error: "Failed to resend email" });
  }
});

r.post("/:id/lock", async (req, res) => {
  try {
    const { id } = req.params;
    await prisma.dailySalesV2.update({
      where: { id },
      data: { deletedAt: new Date() } // Using deletedAt as a soft delete equivalent to LOCKED
    });
    res.json({ ok: true });
  } catch (e: any) {
    console.error("LIBRARY_ERR", e.code, e.message);
    res.status(500).json({ error: "Failed to lock record" });
  }
});

r.post("/:id/unlock", async (req, res) => {
  try {
    const { id } = req.params;
    await prisma.dailySalesV2.update({
      where: { id },
      data: { deletedAt: null } // Unlocking by removing soft delete
    });
    res.json({ ok: true });
  } catch (e: any) {
    console.error("LIBRARY_ERR", e.code, e.message);
    res.status(500).json({ error: "Failed to unlock record" });
  }
});

export default r;