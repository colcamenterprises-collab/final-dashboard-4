import express, { Request, Response } from "express";
import { AuthService } from "../../services/auth/authService";

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

  res.json({
    success: true,
    token: result.token,
    user: result.user
  });
});

export default router;
