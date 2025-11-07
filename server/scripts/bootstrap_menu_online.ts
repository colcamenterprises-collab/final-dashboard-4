import { PrismaClient } from "@prisma/client";
import fs from "fs";
import path from "path";

const prisma = new PrismaClient();

async function main() {
  const sqlPath = path.join(process.cwd(), "server/scripts/bootstrap_menu_online.sql");
  const sql = fs.readFileSync(sqlPath, "utf8");
  await prisma.$executeRawUnsafe(sql);
  console.log("✅ menu_*_online tables/columns ensured.");
}

main()
  .then(() => prisma.$disconnect())
  .catch((e) => { console.error(e); process.exit(1); });
