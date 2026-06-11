import { seedPhase1TestMenu } from "../services/ordering/orderingService";
import { pool } from "../db";

async function main() {
  const result = await seedPhase1TestMenu("server/scripts/seed_ordering_test_menu.ts");
  console.log(JSON.stringify({
    ok: true,
    category_id: result.category.id,
    item_count: result.items.length,
    item_names: result.items.map((item: any) => item.name_en),
    warning: result.warning,
  }, null, 2));
}

main()
  .catch((error) => {
    console.error(JSON.stringify({ ok: false, error: error?.message || String(error) }, null, 2));
    process.exitCode = 1;
  })
  .finally(async () => {
    await pool?.end();
  });
