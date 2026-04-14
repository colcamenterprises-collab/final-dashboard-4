import { Router, Request, Response } from "express";
import bcrypt from "bcryptjs";
import crypto from "crypto";
import { db } from "../db";
import { internalUsers, OWNER_PERMISSIONS, MANAGER_PERMISSIONS, STAFF_PERMISSIONS, type StaffPermissions } from "../../shared/schema";
import { eq } from "drizzle-orm";

const router = Router();

const COOKIE_NAME = "sbb_pin_session";
const COOKIE_MAX_AGE = 12 * 60 * 60 * 1000; // 12 hours
const BCRYPT_ROUNDS = 10;

// ─── Cookie signing ─────────────────────────────────────────────────────────

function getSigningKey(): string {
  return process.env.INTERNAL_APP_PASSWORD || "sbb-pin-default-key-change-in-prod";
}

function signPayload(payload: object): string {
  const json = JSON.stringify(payload);
  const b64 = Buffer.from(json).toString("base64url");
  const sig = crypto.createHmac("sha256", getSigningKey()).update(b64).digest("hex");
  return `${b64}.${sig}`;
}

function verifyAndParseToken(token: string): Record<string, unknown> | null {
  try {
    const [b64, sig] = token.split(".");
    if (!b64 || !sig) return null;
    const expected = crypto.createHmac("sha256", getSigningKey()).update(b64).digest("hex");
    if (sig !== expected) return null;
    const payload = JSON.parse(Buffer.from(b64, "base64url").toString("utf8"));
    if (payload.exp && Date.now() > payload.exp) return null;
    return payload;
  } catch {
    return null;
  }
}

function getCookieValue(req: Request): string | null {
  const raw = req.headers.cookie;
  if (!raw) return null;
  for (const part of raw.split(";")) {
    const [name, ...rest] = part.trim().split("=");
    if (name.trim() === COOKIE_NAME) return decodeURIComponent(rest.join("="));
  }
  return null;
}

export function getPinSessionUser(req: Request): {
  id: number; name: string; role: string; permissions: StaffPermissions;
} | null {
  const raw = getCookieValue(req);
  if (!raw) return null;
  const payload = verifyAndParseToken(raw);
  if (!payload || typeof payload.id !== "number") return null;
  return {
    id: payload.id as number,
    name: payload.name as string,
    role: payload.role as string,
    permissions: (payload.permissions ?? {}) as StaffPermissions,
  };
}

function isManagerOrOwner(role: string): boolean {
  return role === "owner" || role === "manager";
}

// ─── GET /users — list active users for login screen ────────────────────────

router.get("/users", async (_req: Request, res: Response) => {
  try {
    const rows = await db
      .select({ id: internalUsers.id, name: internalUsers.name, role: internalUsers.role })
      .from(internalUsers)
      .where(eq(internalUsers.active, true))
      .orderBy(internalUsers.name);
    res.json({ users: rows });
  } catch (err) {
    console.error("[pinAuth] GET /users error:", err);
    res.status(500).json({ error: "Failed to load users" });
  }
});

// ─── POST /login — verify PIN, set session cookie ───────────────────────────

router.post("/login", async (req: Request, res: Response) => {
  const { userId, pin } = req.body as { userId?: number; pin?: string };
  if (!userId || !pin) {
    return res.status(400).json({ error: "userId and pin are required" });
  }

  try {
    const [user] = await db
      .select()
      .from(internalUsers)
      .where(eq(internalUsers.id, userId))
      .limit(1);

    if (!user || !user.active) {
      return res.status(401).json({ error: "User not found or inactive" });
    }

    const match = await bcrypt.compare(String(pin), user.pinHash);
    if (!match) {
      return res.status(401).json({ error: "Incorrect PIN" });
    }

    const token = signPayload({
      id: user.id,
      name: user.name,
      role: user.role,
      permissions: user.permissions,
      exp: Date.now() + COOKIE_MAX_AGE,
    });

    res.cookie(COOKIE_NAME, token, {
      httpOnly: true,
      sameSite: "lax",
      maxAge: COOKIE_MAX_AGE,
      secure: process.env.NODE_ENV === "production",
    });

    res.json({
      authenticated: true,
      user: { id: user.id, name: user.name, role: user.role, permissions: user.permissions },
    });
  } catch (err) {
    console.error("[pinAuth] POST /login error:", err);
    res.status(500).json({ error: "Login failed" });
  }
});

// ─── GET /me — check current session ────────────────────────────────────────

router.get("/me", (req: Request, res: Response) => {
  const sessionUser = getPinSessionUser(req);
  if (!sessionUser) {
    return res.json({ authenticated: false });
  }
  res.json({ authenticated: true, user: sessionUser });
});

// ─── POST /logout — clear session cookie ────────────────────────────────────

router.post("/logout", (_req: Request, res: Response) => {
  res.clearCookie(COOKIE_NAME, { httpOnly: true, sameSite: "lax" });
  res.json({ ok: true });
});

// ─── Staff management — owner/manager only ───────────────────────────────────

function requireManagerOrOwner(req: Request, res: Response): boolean {
  // Dev bypass
  if (process.env.NODE_ENV === "development") return true;
  const user = getPinSessionUser(req);
  if (!user || !isManagerOrOwner(user.role)) {
    res.status(403).json({ error: "Manager or owner access required" });
    return false;
  }
  return true;
}

router.get("/staff", async (req: Request, res: Response) => {
  if (!requireManagerOrOwner(req, res)) return;
  try {
    const rows = await db
      .select({
        id: internalUsers.id,
        name: internalUsers.name,
        role: internalUsers.role,
        active: internalUsers.active,
        permissions: internalUsers.permissions,
        createdAt: internalUsers.createdAt,
      })
      .from(internalUsers)
      .orderBy(internalUsers.name);
    res.json({ users: rows });
  } catch (err) {
    res.status(500).json({ error: "Failed to load staff" });
  }
});

router.post("/staff", async (req: Request, res: Response) => {
  if (!requireManagerOrOwner(req, res)) return;
  const { name, role, pin, permissions } = req.body as {
    name?: string; role?: string; pin?: string; permissions?: StaffPermissions;
  };
  if (!name || !role || !pin) {
    return res.status(400).json({ error: "name, role, and pin are required" });
  }
  if (String(pin).length < 4 || String(pin).length > 8) {
    return res.status(400).json({ error: "PIN must be 4-8 digits" });
  }

  const defaultPerms =
    role === "owner" ? OWNER_PERMISSIONS :
    role === "manager" ? MANAGER_PERMISSIONS : STAFF_PERMISSIONS;

  try {
    const pinHash = await bcrypt.hash(String(pin), BCRYPT_ROUNDS);
    const [created] = await db.insert(internalUsers).values({
      name: String(name).trim(),
      role,
      pinHash,
      active: true,
      permissions: permissions ?? defaultPerms,
    }).returning();
    res.json({ user: { id: created.id, name: created.name, role: created.role } });
  } catch (err) {
    res.status(500).json({ error: "Failed to create user" });
  }
});

router.put("/staff/:id", async (req: Request, res: Response) => {
  if (!requireManagerOrOwner(req, res)) return;
  const id = Number(req.params.id);
  const { name, role, active, permissions } = req.body as {
    name?: string; role?: string; active?: boolean; permissions?: StaffPermissions;
  };
  try {
    const updates: Partial<typeof internalUsers.$inferInsert> = {};
    if (name !== undefined) updates.name = String(name).trim();
    if (role !== undefined) updates.role = role;
    if (active !== undefined) updates.active = Boolean(active);
    if (permissions !== undefined) updates.permissions = permissions;

    const [updated] = await db.update(internalUsers).set(updates).where(eq(internalUsers.id, id)).returning();
    if (!updated) return res.status(404).json({ error: "User not found" });
    res.json({ user: { id: updated.id, name: updated.name, role: updated.role, active: updated.active, permissions: updated.permissions } });
  } catch (err) {
    res.status(500).json({ error: "Failed to update user" });
  }
});

router.patch("/staff/:id/pin", async (req: Request, res: Response) => {
  if (!requireManagerOrOwner(req, res)) return;
  const id = Number(req.params.id);
  const { pin } = req.body as { pin?: string };
  if (!pin || String(pin).length < 4) {
    return res.status(400).json({ error: "PIN must be at least 4 digits" });
  }
  try {
    const pinHash = await bcrypt.hash(String(pin), BCRYPT_ROUNDS);
    const [updated] = await db.update(internalUsers).set({ pinHash }).where(eq(internalUsers.id, id)).returning();
    if (!updated) return res.status(404).json({ error: "User not found" });
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: "Failed to reset PIN" });
  }
});

// ─── Seed helper — exposed for dev bootstrap ────────────────────────────────

router.post("/seed-owner", async (req: Request, res: Response) => {
  if (process.env.NODE_ENV === "production") {
    return res.status(403).json({ error: "Not available in production" });
  }
  const { name, pin } = req.body as { name?: string; pin?: string };
  if (!name || !pin) return res.status(400).json({ error: "name and pin required" });

  try {
    const existing = await db.select().from(internalUsers).where(eq(internalUsers.role, "owner")).limit(1);
    if (existing.length > 0) return res.json({ message: "Owner already exists", user: { name: existing[0].name } });

    const pinHash = await bcrypt.hash(String(pin), BCRYPT_ROUNDS);
    const [created] = await db.insert(internalUsers).values({
      name: String(name).trim(),
      role: "owner",
      pinHash,
      active: true,
      permissions: OWNER_PERMISSIONS,
    }).returning();
    res.json({ created: true, user: { id: created.id, name: created.name } });
  } catch (err) {
    res.status(500).json({ error: "Seed failed" });
  }
});

export default router;
