import { PrismaClient } from "@prisma/client";
const db = new PrismaClient();

export async function recomputeRollsLedgerByShiftDate(shiftDate: string) {
  await db.$executeRaw`SELECT recompute_rolls_ledger(${shiftDate}::date)`;
}
