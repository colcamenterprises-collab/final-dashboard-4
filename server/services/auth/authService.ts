import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { db } from "../../lib/prisma";

const JWT_SECRET = process.env.JWT_SECRET || "sbb_default_secret_change_in_production";

interface RegisterParams {
  email: string;
  password: string;
  role?: string;
  tenantId: number;
}

interface LoginParams {
  email: string;
  password: string;
}

export const AuthService = {
  async register({ email, password, role = "manager", tenantId }: RegisterParams) {
    const prisma = db();
    const passwordHash = await bcrypt.hash(password, 10);

    return prisma.saas_tenant_users.create({
      data: {
        email,
        passwordHash,
        role,
        tenantId,
      }
    });
  },

  async login({ email, password }: LoginParams) {
    const prisma = db();
    const user = await prisma.saas_tenant_users.findUnique({
      where: { email }
    });
    if (!user) return null;

    const match = await bcrypt.compare(password, user.passwordHash);
    if (!match) return null;

    const token = jwt.sign(
      {
        uid: user.id,
        tenantId: user.tenantId,
        role: user.role,
      },
      JWT_SECRET,
      { expiresIn: "7d" }
    );

    return { token, user: { id: user.id, email: user.email, role: user.role, tenantId: user.tenantId } };
  },

  verify(token: string) {
    try {
      return jwt.verify(token, JWT_SECRET) as { uid: number; tenantId: number; role: string };
    } catch {
      return null;
    }
  }
};
