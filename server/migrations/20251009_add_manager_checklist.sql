CREATE TABLE IF NOT EXISTS "ManagerChecklist" (
  "id" SERIAL PRIMARY KEY,
  "shiftId" TEXT NOT NULL,
  "managerName" TEXT NOT NULL,
  "tasksAssigned" JSONB NOT NULL,
  "tasksCompleted" JSONB NOT NULL,
  "createdAt" TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  "signedAt" TIMESTAMP WITH TIME ZONE
);
CREATE INDEX IF NOT EXISTS "idx_manager_checklist_shift" ON "ManagerChecklist"("shiftId");
