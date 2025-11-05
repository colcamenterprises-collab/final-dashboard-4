import { PrismaClient } from "@prisma/client";
import fs from "fs";
import path from "path";

const prisma = new PrismaClient();

type SeedCategory = {
  name: string;
  slug: string;
  items: {
    name: string;
    sku?: string;
    description?: string;
    price?: number;
    slug: string;
    imageUrl?: string;
    position?: number;
    available?: boolean;
    category?: string;
  }[];
};

type SeedPayload = {
  generatedAt: string;
  categories: SeedCategory[];
};

function thbToInt(v: any): number {
  if (v === null || v === undefined || v === "") return 0;
  const n = Number(v);
  if (Number.isFinite(n)) return Math.round(n);
  return Math.round(parseFloat(String(v).replace(/[^\d.]/g, "")) || 0);
}

async function main() {
  const file = path.join(process.cwd(), "data", "menu_seed.json");
  const raw = fs.readFileSync(file, "utf8");
  const payload = JSON.parse(raw) as SeedPayload;

  for (const [catIndex, cat] of payload.categories.entries()) {
    const category = await prisma.menuCategory.upsert({
      where: { slug: cat.slug },
      update: { name: cat.name, position: catIndex },
      create: { name: cat.name, slug: cat.slug, position: catIndex },
    });

    for (const [i, it] of cat.items.entries()) {
      if (!it.sku) {
        console.warn(`Skipping item ${it.name} - no SKU`);
        continue;
      }
      
      await prisma.menuItem_Online.upsert({
        where: { sku: it.sku },
        update: {
          name: it.name,
          description: it.description || null,
          price: thbToInt(it.price),
          imageUrl: it.imageUrl || null,
          position: i,
          available: it.available ?? true,
          categoryId: category.id,
        },
        create: {
          name: it.name,
          sku: it.sku,
          description: it.description || null,
          price: thbToInt(it.price),
          imageUrl: it.imageUrl || null,
          position: i,
          available: it.available ?? true,
          categoryId: category.id,
        },
      });
    }
  }

  console.log("✅ Menu import complete");
}

main()
  .then(async () => { await prisma.$disconnect(); })
  .catch(async (e) => { console.error(e); await prisma.$disconnect(); process.exit(1); });
