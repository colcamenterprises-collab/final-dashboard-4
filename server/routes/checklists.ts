import express from "express";
import { db } from "../db";
import { sql } from "drizzle-orm";
import { randomUUID } from "crypto";
import { checklistAssignments } from "../../../shared/schema";

const router = express.Router();

// Get random tasks by zone/phase (Fort Knox: Server-side assignment binding)
router.get("/random", async (req, res) => {
  const { zone = "Kitchen", phase = "End", count = 3, shiftId, managerName } = req.query;
  
  // Validate required fields for assignment binding
  if (!shiftId || !managerName) {
    return res.status(400).json({ error: "shiftId and managerName required for assignment binding" });
  }
  
  // Validate UUID format for shiftId
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  if (!uuidRegex.test(shiftId)) {
    return res.status(400).json({ error: "shiftId must be a valid UUID" });
  }
  
  const { rows } = await db.execute(sql`
    SELECT id, "taskName", "taskDetail", zone, "shiftPhase"
    FROM cleaning_tasks
    WHERE zone = ${zone} AND "shiftPhase" = ${phase} AND active = TRUE
    ORDER BY RANDOM()
    LIMIT ${Number(count)}
  `);
  
  // Store assignment server-side for Fort Knox security
  const assignedTaskIds = rows.map(task => task.id);
  const assignmentId = randomUUID();
  const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours
  
  await db.execute(sql`
    INSERT INTO checklist_assignments (id, shift_id, manager_name, assigned_task_ids, expires_at)
    VALUES (${assignmentId}, ${shiftId}, ${managerName}, ${JSON.stringify(assignedTaskIds)}::jsonb, ${expiresAt})
  `);
  
  res.json({ assignmentId, tasks: rows });
});

// Save completed checklist (Fort Knox: Validate against server-stored assignments)
router.post("/complete", async (req, res) => {
  const { assignmentId, tasksCompleted } = req.body;
  
  // Validate required fields
  if (!assignmentId || !Array.isArray(tasksCompleted)) {
    return res.status(400).json({ error: "Missing required fields: assignmentId and tasksCompleted" });
  }
  
  // Validate UUID format for assignmentId
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  if (!uuidRegex.test(assignmentId)) {
    return res.status(400).json({ error: "assignmentId must be a valid UUID" });
  }
  
  // Fort Knox: Load server-stored assignment (prevents client manipulation)
  const { rows: assignments } = await db.execute(sql`
    SELECT shift_id, manager_name, assigned_task_ids FROM checklist_assignments 
    WHERE id = ${assignmentId} AND expires_at > NOW()
  `);
  
  if (assignments.length === 0) {
    return res.status(400).json({ error: "Invalid or expired assignment" });
  }
  
  const assignment = assignments[0];
  const serverAssignedIds = assignment.assigned_task_ids as number[];
  
  // Validate all tasks completed (Fort Knox requirement)
  if (tasksCompleted.length !== serverAssignedIds.length) {
    return res.status(400).json({ error: "All assigned tasks must be completed" });
  }
  
  // Normalize completed task IDs
  const toIds = (arr: any[]) => arr.map(v => typeof v === 'number' ? v : v?.id).filter(n => Number.isInteger(n));
  const completedIds = toIds(tasksCompleted).sort((a,b) => a-b);
  const assignedIds = [...serverAssignedIds].sort((a,b) => a-b);
  
  // Validate payload integrity
  if (completedIds.length !== tasksCompleted.length) {
    return res.status(400).json({ error: "Invalid task payload; expected IDs or objects with numeric id" });
  }
  
  // Fort Knox: Validate against server-stored assignment (prevents bypass)
  const idsMatch = assignedIds.length === completedIds.length && 
    assignedIds.every((id, index) => id === completedIds[index]);
  
  if (!idsMatch) {
    return res.status(400).json({ error: "Completed tasks must exactly match server-assigned task IDs" });
  }
  
  // Record completion with server-validated data
  await db.execute(sql`
    INSERT INTO manager_checklists
      ("shiftId", "managerName", "tasksAssigned", "tasksCompleted", "signedAt")
    VALUES (${assignment.shift_id}, ${assignment.manager_name}, ${JSON.stringify(serverAssignedIds)}::jsonb, ${JSON.stringify(tasksCompleted)}::jsonb, NOW())
  `);
  
  // Clean up assignment after successful completion
  await db.execute(sql`
    DELETE FROM checklist_assignments WHERE id = ${assignmentId}
  `);
  
  res.json({ ok: true });
});

// History
router.get("/history", async (_req, res) => {
  const { rows } = await db.execute(sql`
    SELECT * FROM manager_checklists ORDER BY "signedAt" DESC LIMIT 50
  `);
  res.json(rows);
});

export default router;