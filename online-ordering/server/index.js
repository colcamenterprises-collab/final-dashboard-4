// server/index.js
import fs from "fs";
import path from "path";
import express from "express";
import cors from "cors";

const app = express();
app.use(cors());
app.use(express.json());

const __dirname = path.dirname(new URL(import.meta.url).pathname);
const dataDir = path.join(__dirname, "data");
const menuPath = path.join(dataDir, "menu.json");
const ordersPath = path.join(dataDir, "orders.json");

function ensureFiles() {
  if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });
  if (!fs.existsSync(menuPath)) fs.writeFileSync(menuPath, JSON.stringify({ categories: [], items: [] }, null, 2));
  if (!fs.existsSync(ordersPath)) fs.writeFileSync(ordersPath, JSON.stringify([], null, 2));
}
ensureFiles();

app.get("/api/health", (_, res) => res.json({ ok: true }));

// Return menu (categories + items)
app.get("/api/menu", (_, res) => {
  const menu = JSON.parse(fs.readFileSync(menuPath, "utf8"));
  res.json(menu);
});

// Create order (stored to JSON file for now)
app.post("/api/orders", (req, res) => {
  const order = req.body;

  // quick validation
  if (!order || !order.items || !order.items.length) {
    return res.status(400).json({ error: "Order must include items." });
  }

  const now = new Date().toISOString();
  const id = "ORD_" + Math.random().toString(36).slice(2, 10).toUpperCase();

  const record = {
    id,
    createdAt: now,
    status: "RECEIVED",
    ...order,
  };

  const existing = JSON.parse(fs.readFileSync(ordersPath, "utf8"));
  existing.push(record);
  fs.writeFileSync(ordersPath, JSON.stringify(existing, null, 2));

  // TODO: send to Loyverse POS here when ready
  // await sendToLoyverse(record)

  res.json({ ok: true, id, createdAt: now });
});

// List orders (for quick testing)
app.get("/api/orders", (_, res) => {
  const orders = JSON.parse(fs.readFileSync(ordersPath, "utf8"));
  res.json(orders.sort((a, b) => b.createdAt.localeCompare(a.createdAt)));
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`API running on http://localhost:${PORT}`);
});
