import { Router, Request, Response } from "express";
import bcrypt from "bcryptjs";
import crypto from "crypto";
import { db } from "../db";
import {
  internalUsers,
  rolePermissions,
  OWNER_PERMISSIONS,
  MANAGER_PERMISSIONS,
  CASHIER_PERMISSIONS,
  KITCHEN_STAFF_PERMISSIONS,
  STAFF_PERMISSIONS,
  type StaffPermissions,
} from "../../shared/schema";
import { eq, ilike } from "drizzle-orm";

const router = Router();

const COOKIE_NAME = "sbb_pin_session";
const COOKIE_MAX_AGE = 12 * 60 * 60 * 1000;
const BCRYPT_ROUNDS = 10;

const ROLE_DEFAULTS: Record<string, StaffPermissions> = {
  owner: OWNER_PERMISSIONS,
  manager: MANAGER_PERMISSIONS,
  cashier: CASHIER_PERMISSIONS,
  kitchen_staff: KITCHEN_STAFF_PERMISSIONS,
};

// ─── Cookie signing ──────────────────────────────────────────────────────────

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

function isOwner(role: string): boolean {
  return role === "owner";
}

// Resolve effective permissions: role-level table first, fallback to user-stored
async function resolvePermissions(role: string): Promise<StaffPermissions> {
  try {
    const [row] = await db
      .select({ permissions: rolePermissions.permissions })
      .from(rolePermissions)
      .where(eq(rolePermissions.role, role))
      .limit(1);
    if (row?.permissions && Object.keys(row.permissions).length > 0) {
      return row.permissions;
    }
  } catch {}
  return ROLE_DEFAULTS[role] ?? STAFF_PERMISSIONS;
}

// ─── GET /users — list active users for login screen (legacy, kept for compat) ─

router.get("/users", async (_req: Request, res: Response) => {
  try {
    const rows = await db
      .select({ id: internalUsers.id, name: internalUsers.name, role: internalUsers.role, email: internalUsers.email })
      .from(internalUsers)
      .where(eq(internalUsers.active, true))
      .orderBy(internalUsers.name);
    res.json({ users: rows });
  } catch (err) {
    console.error("[pinAuth] GET /users error:", err);
    res.status(500).json({ error: "Failed to load users" });
  }
});

// ─── POST /login — verify email + PIN or userId + PIN ───────────────────────

router.post("/login", async (req: Request, res: Response) => {
  const { email, userId, pin } = req.body as { email?: string; userId?: number; pin?: string };
  if (!pin) {
    return res.status(400).json({ error: "pin is required" });
  }
  if (!email && !userId) {
    return res.status(400).json({ error: "email or userId is required" });
  }

  try {
    let userRow: (typeof internalUsers.$inferSelect) | undefined;

    if (email) {
      // Try email match first
      const [byEmail] = await db
        .select()
        .from(internalUsers)
        .where(ilike(internalUsers.email, email.trim()))
        .limit(1);
      userRow = byEmail;

      // Fallback: match by name (supports existing accounts with no email set)
      if (!userRow) {
        const [byName] = await db
          .select()
          .from(internalUsers)
          .where(ilike(internalUsers.name, email.trim()))
          .limit(1);
        userRow = byName;
      }
    } else {
      const [found] = await db
        .select()
        .from(internalUsers)
        .where(eq(internalUsers.id, Number(userId)))
        .limit(1);
      userRow = found;
    }

    if (!userRow || !userRow.active) {
      return res.status(401).json({ error: "Account not found. Enter your email or name, then your PIN." });
    }

    const match = await bcrypt.compare(String(pin), userRow.pinHash);
    if (!match) {
      return res.status(401).json({ error: "Incorrect PIN" });
    }

    const permissions = await resolvePermissions(userRow.role);

    const token = signPayload({
      id: userRow.id,
      name: userRow.name,
      role: userRow.role,
      permissions,
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
      user: { id: userRow.id, name: userRow.name, role: userRow.role, permissions },
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

// ─── GET /me/profile ─────────────────────────────────────────────────────────

router.get("/me/profile", async (req: Request, res: Response) => {
  const sessionUser = getPinSessionUser(req);
  if (!sessionUser && process.env.NODE_ENV !== "development") {
    return res.status(401).json({ error: "Not authenticated" });
  }
  const userId = sessionUser?.id ?? 1;
  try {
    const [user] = await db
      .select({
        id: internalUsers.id,
        name: internalUsers.name,
        role: internalUsers.role,
        active: internalUsers.active,
        permissions: internalUsers.permissions,
        avatarUrl: internalUsers.avatarUrl,
        createdAt: internalUsers.createdAt,
      })
      .from(internalUsers)
      .where(eq(internalUsers.id, userId))
      .limit(1);
    if (!user) return res.status(404).json({ error: "User not found" });
    res.json({ user });
  } catch {
    res.status(500).json({ error: "Failed to load profile" });
  }
});

// ─── PATCH /me/profile — update own avatar ───────────────────────────────────

router.patch("/me/profile", async (req: Request, res: Response) => {
  const sessionUser = getPinSessionUser(req);
  if (!sessionUser && process.env.NODE_ENV !== "development") {
    return res.status(401).json({ error: "Not authenticated" });
  }
  const userId = sessionUser?.id ?? 1;
  const { avatarUrl } = req.body as { avatarUrl?: string | null };
  try {
    const [updated] = await db
      .update(internalUsers)
      .set({ avatarUrl: avatarUrl ?? null })
      .where(eq(internalUsers.id, userId))
      .returning({ id: internalUsers.id, name: internalUsers.name, avatarUrl: internalUsers.avatarUrl });
    if (!updated) return res.status(404).json({ error: "User not found" });
    res.json({ ok: true, user: updated });
  } catch {
    res.status(500).json({ error: "Failed to update profile" });
  }
});

// ─── PATCH /me/pin — change own PIN ─────────────────────────────────────────

router.patch("/me/pin", async (req: Request, res: Response) => {
  const sessionUser = getPinSessionUser(req);
  if (!sessionUser) return res.status(401).json({ error: "Not authenticated" });
  const { currentPin, newPin } = req.body as { currentPin?: string; newPin?: string };
  if (!currentPin || !newPin) {
    return res.status(400).json({ error: "currentPin and newPin are required" });
  }
  if (String(newPin).length < 4 || String(newPin).length > 8) {
    return res.status(400).json({ error: "New PIN must be 4–8 digits" });
  }
  try {
    const [user] = await db.select().from(internalUsers).where(eq(internalUsers.id, sessionUser.id)).limit(1);
    if (!user) return res.status(404).json({ error: "User not found" });
    const match = await bcrypt.compare(String(currentPin), user.pinHash);
    if (!match) return res.status(401).json({ error: "Current PIN is incorrect" });
    const pinHash = await bcrypt.hash(String(newPin), BCRYPT_ROUNDS);
    await db.update(internalUsers).set({ pinHash }).where(eq(internalUsers.id, sessionUser.id));
    res.json({ ok: true });
  } catch {
    res.status(500).json({ error: "Failed to change PIN" });
  }
});

// ─── POST /logout ────────────────────────────────────────────────────────────

router.post("/logout", (_req: Request, res: Response) => {
  res.clearCookie(COOKIE_NAME, { httpOnly: true, sameSite: "lax" });
  res.json({ ok: true });
});

// ─── Auth guard — owner only ─────────────────────────────────────────────────

function requireOwner(req: Request, res: Response): boolean {
  if (process.env.NODE_ENV === "development") return true;
  const user = getPinSessionUser(req);
  if (!user || !isOwner(user.role)) {
    res.status(403).json({ error: "Owner access required" });
    return false;
  }
  return true;
}

// ─── GET /staff — full staff list (owner only) ───────────────────────────────

router.get("/staff", async (req: Request, res: Response) => {
  if (!requireOwner(req, res)) return;
  try {
    const rows = await db
      .select({
        id: internalUsers.id,
        name: internalUsers.name,
        role: internalUsers.role,
        email: internalUsers.email,
        contactNumber: internalUsers.contactNumber,
        active: internalUsers.active,
        permissions: internalUsers.permissions,
        avatarUrl: internalUsers.avatarUrl,
        createdAt: internalUsers.createdAt,
      })
      .from(internalUsers)
      .orderBy(internalUsers.name);
    res.json({ users: rows });
  } catch (err) {
    res.status(500).json({ error: "Failed to load staff" });
  }
});

// ─── POST /staff — create staff (owner only) ────────────────────────────────

router.post("/staff", async (req: Request, res: Response) => {
  if (!requireOwner(req, res)) return;
  const { name, role, email, contactNumber, pin, avatarUrl } = req.body as {
    name?: string; role?: string; email?: string; contactNumber?: string;
    pin?: string; avatarUrl?: string;
  };
  if (!name || !role || !pin) {
    return res.status(400).json({ error: "name, role, and pin are required" });
  }
  if (String(pin).length < 4 || String(pin).length > 8) {
    return res.status(400).json({ error: "PIN must be 4–8 digits" });
  }
  if (email) {
    const [existing] = await db.select({ id: internalUsers.id }).from(internalUsers).where(ilike(internalUsers.email, email.trim())).limit(1);
    if (existing) return res.status(400).json({ error: "A staff member with that email already exists" });
  }

  const permissions = await resolvePermissions(role);

  try {
    const pinHash = await bcrypt.hash(String(pin), BCRYPT_ROUNDS);
    const [created] = await db.insert(internalUsers).values({
      name: String(name).trim(),
      role,
      email: email?.trim().toLowerCase() || null,
      contactNumber: contactNumber?.trim() || null,
      pinHash,
      active: true,
      permissions,
      avatarUrl: avatarUrl || null,
    }).returning();
    res.json({ user: { id: created.id, name: created.name, role: created.role } });
  } catch (err) {
    res.status(500).json({ error: "Failed to create user" });
  }
});

// ─── PUT /staff/:id — update staff (owner only) ──────────────────────────────

router.put("/staff/:id", async (req: Request, res: Response) => {
  if (!requireOwner(req, res)) return;
  const id = Number(req.params.id);
  const { name, role, email, contactNumber, active, avatarUrl } = req.body as {
    name?: string; role?: string; email?: string; contactNumber?: string;
    active?: boolean; avatarUrl?: string | null;
  };
  try {
    const updates: Partial<typeof internalUsers.$inferInsert> = {};
    if (name !== undefined) updates.name = String(name).trim();
    if (role !== undefined) {
      updates.role = role;
      updates.permissions = await resolvePermissions(role);
    }
    if (email !== undefined) updates.email = email?.trim().toLowerCase() || null;
    if (contactNumber !== undefined) updates.contactNumber = contactNumber?.trim() || null;
    if (active !== undefined) updates.active = Boolean(active);
    if (avatarUrl !== undefined) updates.avatarUrl = avatarUrl;

    const [updated] = await db.update(internalUsers).set(updates).where(eq(internalUsers.id, id)).returning();
    if (!updated) return res.status(404).json({ error: "User not found" });
    res.json({ user: updated });
  } catch (err) {
    res.status(500).json({ error: "Failed to update user" });
  }
});

// ─── PATCH /staff/:id/pin — reset a staff PIN (owner only) ──────────────────

router.patch("/staff/:id/pin", async (req: Request, res: Response) => {
  if (!requireOwner(req, res)) return;
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
  } catch {
    res.status(500).json({ error: "Failed to reset PIN" });
  }
});

// ─── GET /role-permissions — list permissions per role (owner only) ──────────

router.get("/role-permissions", async (req: Request, res: Response) => {
  if (!requireOwner(req, res)) return;
  try {
    const rows = await db.select().from(rolePermissions).orderBy(rolePermissions.role);
    // Ensure all 4 roles exist in response
    const roles = ["owner", "manager", "cashier", "kitchen_staff"];
    const map = Object.fromEntries(rows.map((r) => [r.role, r]));
    const result = roles.map((role) => map[role] ?? { id: null, role, permissions: ROLE_DEFAULTS[role] ?? {}, updatedAt: null });
    res.json({ rolePermissions: result });
  } catch (err) {
    res.status(500).json({ error: "Failed to load role permissions" });
  }
});

// ─── PUT /role-permissions/:role — update permissions for a role (owner only) ─

router.put("/role-permissions/:role", async (req: Request, res: Response) => {
  if (!requireOwner(req, res)) return;
  const { role } = req.params;
  const validRoles = ["owner", "manager", "cashier", "kitchen_staff"];
  if (!validRoles.includes(role)) {
    return res.status(400).json({ error: "Invalid role" });
  }
  const { permissions } = req.body as { permissions?: StaffPermissions };
  if (!permissions || typeof permissions !== "object") {
    return res.status(400).json({ error: "permissions object is required" });
  }
  try {
    const [existing] = await db.select({ id: rolePermissions.id }).from(rolePermissions).where(eq(rolePermissions.role, role)).limit(1);
    if (existing) {
      await db.update(rolePermissions).set({ permissions, updatedAt: new Date() }).where(eq(rolePermissions.role, role));
    } else {
      await db.insert(rolePermissions).values({ role, permissions });
    }
    // Also update all users of this role so their cookie reflects new perms on next login
    await db.update(internalUsers).set({ permissions }).where(eq(internalUsers.role, role));
    res.json({ ok: true, role, permissions });
  } catch (err) {
    res.status(500).json({ error: "Failed to update role permissions" });
  }
});

// ─── Seed helper ─────────────────────────────────────────────────────────────

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
