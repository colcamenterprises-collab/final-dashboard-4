import { PrismaClient } from "@prisma/client";

let prisma: PrismaClient;

export function db() {
  if (!prisma) {
    prisma = new PrismaClient({ 
      log: ["error"]
    });
  }
  return prisma;
}