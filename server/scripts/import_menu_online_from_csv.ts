import fs from "fs";
import path from "path";
import crypto from "crypto";
import { parse } from "csv-parse/sync";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const cuid = () => "c" + crypto.randomBytes(15).toString("hex");
const slugify = (s: string) =>
  s.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
const toNumber = (v: any) => {
  if (v === null || v === undefined) return 0;
  if (typeof v === "number") return v;
  const n = parseFloat(String(v).replace(/[^\d.,-]/g, "").replace(/,/g, ""));
  return isNaN(n) ? 0 : n;
};

async function upsertCategory(name: string, position: number) {
  const slug = slugify(name);
  const row = await prisma.$queryRawUnsafe<any[]>(
    `SELECT id FROM menu_categories_online WHERE slug=$1 LIMIT 1`, slug
  );
  const id = row?.[0]?.id || cuid();
  await prisma.$executeRawUnsafe(
    `INSERT INTO menu_categories_online (id,name,slug,position)
     VALUES ($1,$2,$3,$4)
     ON CONFLICT (slug) DO UPDATE SET name=EXCLUDED.name, position=EXCLUDED.position`,
    id, name, slug, position
  );
  const again = await prisma.$queryRawUnsafe<any[]>(
    `SELECT id FROM menu_categories_online WHERE slug=$1 LIMIT 1`, slug
  );
  return { id: again?.[0]?.id as string, slug };
}

async function upsertItem(row: any, categoryId: string, position: number) {
  const name = (row["Item Name"] ?? row["name"] ?? "").toString().trim();
  if (!name) return;
  const slug = slugify(name);
  const sku = (row["SKU"] ?? row["sku"] ?? null) as string | null;
  const description = (row["Description"] ?? row["description"] ?? null) as string | null;
  const price = toNumber(row["Price"] ?? row["price"]);
  const imageUrl = (row["Image"] ?? row["image_url"] ?? null) as string | null;

  // Use existing camelCase column names (categoryId, imageUrl) not snake_case
  await prisma.$executeRawUnsafe(
    `INSERT INTO menu_items_online (id,name,slug,sku,description,price,"imageUrl",position,available,"categoryId")
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
     ON CONFLICT (slug) DO UPDATE SET
       name=EXCLUDED.name, sku=EXCLUDED.sku, description=EXCLUDED.description,
       price=EXCLUDED.price, "imageUrl"=EXCLUDED."imageUrl", position=EXCLUDED.position,
       available=EXCLUDED.available, "categoryId"=EXCLUDED."categoryId"`,
    cuid(), name, slug, sku, description, price, imageUrl, position, true, categoryId
  );
}

async function main() {
  const csvPath = path.join(process.cwd(), "data", "menu.csv");
  if (!fs.existsSync(csvPath)) {
    throw new Error(
      `CSV not found: ${csvPath}. Expected headers: Category, Item Name, SKU, Description, Price, Image`
    );
  }
  const raw = fs.readFileSync(csvPath, "utf8");
  const rows = parse(raw, { columns: true, skip_empty_lines: true, trim: true }) as any[];

  // Group rows by Category and preserve file order
  const byCat = new Map<string, any[]>();
  for (const r of rows) {
    const cat = (r["Category"] ?? "Uncategorized").toString().trim();
    if (!byCat.has(cat)) byCat.set(cat, []);
    byCat.get(cat)!.push(r);
  }

  let cIndex = 0;
  for (const [cat, items] of byCat) {
    const { id: categoryId } = await upsertCategory(cat, cIndex++);
    for (let i = 0; i < items.length; i++) {
      await upsertItem(items[i], categoryId, i);
    }
  }

  console.log("✅ Online menu import complete.");
}

main()
  .then(() => prisma.$disconnect())
  .catch((e) => { console.error(e); process.exit(1); });
