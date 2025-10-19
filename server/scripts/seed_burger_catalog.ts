import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import { BURGER_SKU_MAP, NAME_BY_SKU } from '../services/burgerSkuMap';

const db = new PrismaClient();

(async () => {
  console.log('Seeding item_catalog with burger SKUs...');
  
  let count = 0;
  for (const [sku, rule] of Object.entries(BURGER_SKU_MAP)) {
    const name = NAME_BY_SKU[sku] || `Item ${sku}`;
    const category = 'burger';
    const kind = rule.kind;
    const pattiesPer = rule.kind === 'beef' ? rule.pattiesPer : null;
    const gramsPer = rule.kind === 'chicken' ? rule.gramsPer : null;
    const rollsPer = rule.rollsPer;

    await db.$executeRaw`
      INSERT INTO item_catalog (sku, name, category, kind, patties_per, grams_per, rolls_per)
      VALUES (${sku}, ${name}, ${category}, ${kind}, ${pattiesPer}, ${gramsPer}, ${rollsPer})
      ON CONFLICT (sku)
      DO UPDATE SET name=EXCLUDED.name, category=EXCLUDED.category, kind=EXCLUDED.kind,
                    patties_per=EXCLUDED.patties_per, grams_per=EXCLUDED.grams_per,
                    rolls_per=EXCLUDED.rolls_per, updated_at=now()`;
    count++;
  }

  console.log(`✅ Seeded ${count} burger SKUs into item_catalog`);
  await db.$disconnect();
})().catch(e => { 
  console.error('❌ Seed failed:', e); 
  process.exit(1); 
});
