import express from "express";
import { db } from "../db";
import { vendorRule } from "../../shared/schema";
import { eq, sql } from "drizzle-orm";
import { z } from "zod";
import { getPinSessionUser } from "./pinAuth";

const router = express.Router();

const RULE_CATEGORIES = [
  "Food & Beverage",
  "Kitchen Supplies & Packaging",
  "Utilities",
  "Rent",
  "Staff Expenses",
  "Repairs & Maintenance",
  "Marketing",
  "Administration",
  "Software & Subscriptions",
  "Bank Fees",
  "Equipment",
  "Fuel & Transport",
  "Other Business Expense",
] as const;

function requireOwner(req: any, res: any): boolean {
  const user = getPinSessionUser(req);
  if (!user || user.role !== "owner") {
    res.status(403).json({ error: "Owner access required" });
    return false;
  }
  return true;
}

const duplicateResolutionSchema = z.object({
  pairKey: z.string().trim().min(3).max(1000),
  leftRef: z.string().trim().min(1).max(500),
  rightRef: z.string().trim().min(1).max(500),
  outcome: z.enum(["keep_both", "removed_left", "removed_right", "personal_left", "personal_right"]),
  note: z.string().trim().max(1000).optional().nullable(),
});

router.get("/duplicate-resolutions", async (req, res) => {
  try {
    if (!requireOwner(req, res)) return;
    const result = await db.execute(sql`
      SELECT
        id,
        pair_key AS "pairKey",
        left_ref AS "leftRef",
        right_ref AS "rightRef",
        outcome,
        reviewed_by AS "reviewedBy",
        reviewed_at AS "reviewedAt",
        note
      FROM finance_duplicate_resolution
      ORDER BY reviewed_at DESC
      LIMIT 5000
    `);
    return res.json({ ok: true, resolutions: result.rows || [] });
  } catch (error: any) {
    console.error("[FINANCE_DUPLICATE_RESOLUTION_LIST_FAILED]", error);
    return res.status(500).json({ error: "Failed to load duplicate resolutions", reason: error?.message || String(error) });
  }
});

router.post("/duplicate-resolutions", async (req, res) => {
  try {
    if (!requireOwner(req, res)) return;
    const parsed = duplicateResolutionSchema.parse(req.body || {});
    const owner = getPinSessionUser(req)!;
    const reviewedBy = `${owner.name || "Owner"}${owner.id != null ? ` (${owner.id})` : ""}`;
    const result = await db.execute(sql`
      INSERT INTO finance_duplicate_resolution (
        pair_key, left_ref, right_ref, outcome, reviewed_by, reviewed_at, note
      ) VALUES (
        ${parsed.pairKey}, ${parsed.leftRef}, ${parsed.rightRef}, ${parsed.outcome}, ${reviewedBy}, now(), ${parsed.note || null}
      )
      ON CONFLICT (pair_key) DO UPDATE SET
        left_ref = EXCLUDED.left_ref,
        right_ref = EXCLUDED.right_ref,
        outcome = EXCLUDED.outcome,
        reviewed_by = EXCLUDED.reviewed_by,
        reviewed_at = now(),
        note = EXCLUDED.note
      RETURNING
        id,
        pair_key AS "pairKey",
        left_ref AS "leftRef",
        right_ref AS "rightRef",
        outcome,
        reviewed_by AS "reviewedBy",
        reviewed_at AS "reviewedAt",
        note
    `);
    return res.json({ ok: true, resolution: result.rows?.[0] || null });
  } catch (error: any) {
    if (error instanceof z.ZodError) return res.status(400).json({ error: "Invalid duplicate resolution", details: error.issues });
    console.error("[FINANCE_DUPLICATE_RESOLUTION_SAVE_FAILED]", error);
    return res.status(500).json({ error: "Failed to save duplicate resolution", reason: error?.message || String(error) });
  }
});

const ruleSchema = z.object({
  matchText: z.string().trim().min(2).max(500),
  supplier: z.string().trim().min(1).max(500),
  category: z.enum(RULE_CATEGORIES),
});

router.get("/vendor-rules", async (req, res) => {
  try {
    if (!requireOwner(req, res)) return;
    const rules = await db.select().from(vendorRule).orderBy(vendorRule.createdAt);
    return res.json({ ok: true, rules });
  } catch (error: any) {
    console.error("[FINANCE_VENDOR_RULE_LIST_FAILED]", error);
    return res.status(500).json({ error: "Failed to load expense category rules", reason: error?.message || String(error) });
  }
});

router.post("/vendor-rules", async (req, res) => {
  try {
    if (!requireOwner(req, res)) return;
    const parsed = ruleSchema.parse(req.body || {});
    const existing = await db.execute(sql`
      SELECT id FROM vendor_rule WHERE lower(trim(match_text)) = lower(trim(${parsed.matchText})) LIMIT 1
    `);
    if (existing.rows?.length) {
      return res.status(409).json({ error: "A rule for this supplier/match text already exists", existingRuleId: existing.rows[0].id });
    }
    const [rule] = await db.insert(vendorRule).values(parsed).returning();
    return res.status(201).json({ ok: true, rule });
  } catch (error: any) {
    if (error instanceof z.ZodError) return res.status(400).json({ error: "Invalid expense category rule", details: error.issues });
    console.error("[FINANCE_VENDOR_RULE_CREATE_FAILED]", error);
    return res.status(500).json({ error: "Failed to create expense category rule", reason: error?.message || String(error) });
  }
});

router.patch("/vendor-rules/:id", async (req, res) => {
  try {
    if (!requireOwner(req, res)) return;
    const parsed = ruleSchema.parse(req.body || {});
    const [rule] = await db.update(vendorRule)
      .set(parsed)
      .where(eq(vendorRule.id, req.params.id))
      .returning();
    if (!rule) return res.status(404).json({ error: "Expense category rule not found" });
    return res.json({ ok: true, rule });
  } catch (error: any) {
    if (error instanceof z.ZodError) return res.status(400).json({ error: "Invalid expense category rule", details: error.issues });
    console.error("[FINANCE_VENDOR_RULE_UPDATE_FAILED]", error);
    return res.status(500).json({ error: "Failed to update expense category rule", reason: error?.message || String(error) });
  }
});

router.delete("/vendor-rules/:id", async (req, res) => {
  try {
    if (!requireOwner(req, res)) return;
    const [rule] = await db.delete(vendorRule).where(eq(vendorRule.id, req.params.id)).returning();
    if (!rule) return res.status(404).json({ error: "Expense category rule not found" });
    return res.json({ ok: true, id: req.params.id });
  } catch (error: any) {
    console.error("[FINANCE_VENDOR_RULE_DELETE_FAILED]", error);
    return res.status(500).json({ error: "Failed to delete expense category rule", reason: error?.message || String(error) });
  }
});

export default router;
