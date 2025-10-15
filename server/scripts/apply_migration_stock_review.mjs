import fs from "fs";
import { Client } from "pg";
const sql = fs.readFileSync("server/migrations/20251015_stock_review.sql","utf8");
const client = new Client({ connectionString: process.env.DATABASE_URL });
await client.connect();
await client.query(sql);
await client.end();
console.log("Applied stock review migration ✅");
