import { pool } from "../db.ts";

const DRINKS = [
  "Coke",
  "Coke Zero",
  "Sprite",
  "Schweppes Manow",
  "Red Fanta",
  "Orange Fanta",
  "Red Singha",
  "Yellow Singha",
  "Pink Singha",
  "Soda Water"
];

async function run() {
  for (const name of DRINKS) {
    await pool.query(
      `INSERT INTO drink_brand (name, unit) VALUES ($1, 'can')
         ON CONFLICT (name) DO UPDATE SET unit = EXCLUDED.unit`,
      [name]
    );
  }
  console.log("Seeded drink_brand:", DRINKS.length, "brands");
  process.exit(0);
}

run().catch(err => { console.error(err); process.exit(1); });
