// src/server/middleware/prismaWriteBlock.ts
// Prisma middleware that throws if any write is attempted while AGENT_READONLY=1
import { Prisma } from "@prisma/client";

export function installPrismaWriteBlock(prisma: any) {
  prisma.$use(async (params: Prisma.MiddlewareParams, next: any) => {
    if (process.env.AGENT_READONLY === "1") {
      const action = params.action.toLowerCase();
      const isWrite = [
        "create", "createMany", "update", "updateMany",
        "upsert", "delete", "deleteMany"
      ].some(a => action.startsWith(a));
      if (isWrite) {
        throw new Error("READ_ONLY_MODE");
      }
    }
    return next(params);
  });
}