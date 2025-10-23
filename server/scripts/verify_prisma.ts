// server/scripts/verify_prisma.ts
import { PrismaClient, Prisma } from "@prisma/client";

async function main() {
  const prisma = new PrismaClient();
  const openssl = process.versions.openssl;
  const versions = Prisma.prismaVersion;

  const ping = await prisma.$queryRaw`SELECT 1 as ok`;

  console.log("=== Prisma Verification ===");
  console.log("OpenSSL:", openssl);
  console.log("Prisma Client version:", versions.client);
  console.log("Prisma Engine version:", versions.engine);
  console.log("DB Ping:", ping);

  await prisma.$disconnect();
}

main().catch((e) => {
  console.error("Prisma verification failed:", e);
  process.exit(1);
});
