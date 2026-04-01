import express, { Request, Response } from "express";
import { AuthService } from "../../services/auth/authService";
import { AUTH_COOKIE_NAME, attachSessionUser } from "../../middleware/sessionAuth";

const router = express.Router();

router.post("/register", async (req: Request, res: Response) => {
  const { email, password, role = "manager" } = req.body;
  const tenantId = (req as any).tenantId || 1;

  try {
    const created = await AuthService.register({
      email,
      password,
      role,
      tenantId,
    });

    res.json({ success: true, user: { id: created.id, email: created.email, role: created.role } });
  } catch (e: any) {
    res.status(400).json({ error: e.message });
  }
});

router.post("/login", async (req: Request, res: Response) => {
  const { email, password } = req.body;
  const result = await AuthService.login({ email, password });

  if (!result) {
    return res.status(401).json({ error: "Invalid credentials" });
  }

  const isSecure = process.env.NODE_ENV === "production";
  res.cookie(AUTH_COOKIE_NAME, result.token, {
    httpOnly: true,
    sameSite: "lax",
    secure: isSecure,
    path: "/",
    maxAge: 7 * 24 * 60 * 60 * 1000,
  });

  res.json({
    success: true,
    token: result.token,
    user: result.user
  });
});

router.get("/session", async (req: Request, res: Response) => {
  if (!attachSessionUser(req)) {
    return res.status(401).json({ authenticated: false });
  }

  return res.json({
    authenticated: true,
    user: (req as any).user,
  });
});

router.post("/logout", async (_req: Request, res: Response) => {
  res.clearCookie(AUTH_COOKIE_NAME, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
  });

  return res.json({ success: true });
});

export default router;
