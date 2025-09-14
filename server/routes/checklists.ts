import express from "express";
import { db } from "../db";
import { sql } from "drizzle-orm";
import { cleaningTasks, managerChecklists } from "../../shared/schema";

const router = express.Router();

// Get random tasks (zone + phase)
router.get("/random", async (req, res) => {
  try {
    const { zone = "Kitchen", phase = "End", count = 3 } = req.query;

    const result = await db.execute(sql`
      SELECT id, "taskName", "taskDetail", zone, "shiftPhase"
      FROM cleaning_tasks
      WHERE active = true AND zone = ${zone} AND "shiftPhase" = ${phase}
      ORDER BY random()
      LIMIT ${Number(count)}
    `);

    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching random tasks:', error);
    res.status(500).json({ error: "Failed to fetch tasks" });
  }
});

// Save checklist completion
router.post("/complete", async (req, res) => {
  try {
    const { shiftId, managerName, tasks } = req.body;

    if (!shiftId || !managerName || !Array.isArray(tasks)) {
      return res.status(400).json({ error: "Missing fields: shiftId, managerName, and tasks are required" });
    }

    await db.execute(sql`
      INSERT INTO manager_checklists ("shiftId", "managerName", "tasksAssigned", "tasksCompleted", "createdAt", "signedAt")
      VALUES (
        ${shiftId},
        ${managerName},
        ${JSON.stringify(tasks)}::jsonb,
        ${JSON.stringify(tasks)}::jsonb,
        NOW(),
        NOW()
      )
    `);

    console.log(`Manager checklist completed by ${managerName} for shift ${shiftId} with ${tasks.length} tasks`);
    res.json({ ok: true });
  } catch (error) {
    console.error('Error saving checklist completion:', error);
    res.status(500).json({ error: "Failed to save checklist completion" });
  }
});

// Get all cleaning tasks (for management/seeding)
router.get("/tasks", async (req, res) => {
  try {
    const result = await db.execute(sql`
      SELECT id, "taskName", "taskDetail", zone, "shiftPhase", active
      FROM cleaning_tasks
      ORDER BY zone, "shiftPhase", "taskName"
    `);

    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching all tasks:', error);
    res.status(500).json({ error: "Failed to fetch tasks" });
  }
});

// Get checklist history
router.get("/history", async (req, res) => {
  try {
    const { limit = 20 } = req.query;

    const result = await db.execute(sql`
      SELECT "shiftId", "managerName", "tasksAssigned", "tasksCompleted", "createdAt", "signedAt"
      FROM manager_checklists
      ORDER BY "createdAt" DESC
      LIMIT ${Number(limit)}
    `);

    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching checklist history:', error);
    res.status(500).json({ error: "Failed to fetch checklist history" });
  }
});

export default router;