#!/usr/bin/env bash
set -euo pipefail

cd /opt/apps/sbb-app-production

python3 <<'PY'
from pathlib import Path

path = Path("server/routes/pinAuth.ts")
text = path.read_text()
marker = "// ─── PATCH /staff/:id/pin — reset a staff PIN (owner only) ──────────────────"
route = r'''
// ─── DELETE /staff/:id — permanently delete staff access (owner only) ────────

router.delete("/staff/:id", async (req: Request, res: Response) => {
  if (!requireOwner(req, res)) return;
  const sessionUser = getPinSessionUser(req);
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id <= 0) {
    return res.status(400).json({ error: "Invalid staff account" });
  }
  if (sessionUser?.id === id) {
    return res.status(409).json({ error: "You cannot delete the account currently signed in" });
  }

  try {
    const [target] = await db
      .select({ id: internalUsers.id, name: internalUsers.name, role: internalUsers.role, active: internalUsers.active })
      .from(internalUsers)
      .where(eq(internalUsers.id, id))
      .limit(1);
    if (!target) return res.status(404).json({ error: "Staff account not found" });

    if (target.role === "owner" && target.active) {
      const users = await db
        .select({ id: internalUsers.id, role: internalUsers.role, active: internalUsers.active })
        .from(internalUsers);
      const activeOwnerCount = users.filter((user) => user.role === "owner" && user.active).length;
      if (activeOwnerCount <= 1) {
        return res.status(409).json({ error: "The final active owner account cannot be deleted" });
      }
    }

    const [deleted] = await db
      .delete(internalUsers)
      .where(eq(internalUsers.id, id))
      .returning({ id: internalUsers.id, name: internalUsers.name, username: internalUsers.username });
    if (!deleted) return res.status(404).json({ error: "Staff account not found" });
    res.json({ ok: true, deleted });
  } catch (err: any) {
    console.error("[pinAuth] DELETE /staff/:id error:", err);
    if (err?.code === "23503") {
      return res.status(409).json({ error: "This account is linked to historical records and cannot be permanently deleted" });
    }
    res.status(500).json({ error: "Failed to delete staff account" });
  }
});

'''

if 'router.delete("/staff/:id"' not in text:
    if marker not in text:
        raise SystemExit("Could not locate the staff PIN route anchor")
    text = text.replace(marker, route + marker, 1)
    path.write_text(text)
    print("Added protected DELETE /api/pin-auth/staff/:id route")
else:
    print("Staff deletion route already present")
PY

NODE_OPTIONS=--max-old-space-size=4096 npm run build
systemctl restart sbb-production
sleep 5
systemctl is-active --quiet sbb-production
curl -fsS http://127.0.0.1:8081/api/pin-auth/me

echo
echo "Staff Access permanent deletion deployed successfully."
