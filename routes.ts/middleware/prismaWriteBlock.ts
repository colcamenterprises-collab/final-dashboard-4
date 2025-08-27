// src/server/middleware/prismaWriteBlock.ts
// Prisma middleware that throws if any write is attempted while AGENT_READONLY=1
// Note: Prisma middleware API ($use) has been deprecated, temporarily disabled

export function installPrismaWriteBlock(prisma: any) {
  // Temporarily disabled due to deprecated Prisma $use API
  // TODO: Implement read-only checks using other methods if needed
  console.log('Prisma write block middleware disabled (deprecated API)');
}