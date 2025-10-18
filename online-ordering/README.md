# Online Ordering System - Smash Brothers Burgers

**Status:** ✅ Fully Integrated & API Tested  
**Design:** Black/Yellow Vev-style, Mobile-first  
**Stack:** Express + React + Vite + TypeScript

---

## 🎯 What's Been Built

A complete online ordering system integrated into your main Replit app with:

- **Modern UI** - Black background, yellow price pills, sticky tabs
- **Cart System** - Add items, adjust quantities, add special notes
- **Customer Info** - Name, phone, special instructions
- **Order Submission** - JSON storage (ready for Loyverse integration)
- **Scheduled Pickup** - Optional datetime picker
- **LocalStorage** - Cart persists across page reloads

---

## 📁 File Structure

```
online-ordering/
├── server/
│   ├── index.js          # Standalone server (optional)
│   └── data/
│       ├── menu.json     # 5 categories, 16 items
│       └── orders.json   # Order storage
└── client/
    ├── package.json
    ├── vite.config.ts
    ├── index.html
    └── src/
        ├── App.tsx       # Main app with cart logic
        ├── types.ts      # TypeScript definitions
        ├── styles.css    # Black/yellow theme
        └── main.tsx      # Entry point
```

---

## ✅ API Endpoints (Integrated)

All endpoints are **live** and **tested** on your main server:

### 1. Get Menu
```bash
GET /api/ordering/menu
```
Returns: `{ categories: [...], items: [...] }`

**Test Result:** ✅ 5 categories, 16 items

### 2. Create Order
```bash
POST /api/ordering/orders
Content-Type: application/json

{
  "customer": { "name": "...", "phone": "..." },
  "items": [...],
  "subtotal": 340,
  "serviceFee": 0,
  "total": 340,
  "currency": "THB"
}
```
Returns: `{ ok: true, id: "ORD_XXXXX", createdAt: "..." }`

**Test Result:** ✅ Order created successfully

### 3. List Orders
```bash
GET /api/ordering/orders
```
Returns: Array of orders (newest first)

**Test Result:** ✅ Returns all orders

### 4. Customer Ordering Page  
```bash
GET /online-ordering
```
Serves the React SPA (requires build step - see below)

---

## 🏗️ Build Instructions

The client needs to be built before customers can access it:

```bash
# Navigate to client directory
cd online-ordering/client

# Install dependencies
npm install

# Build for production
npm run build
```

This creates `online-ordering/client/dist/` which your main server already serves at `/online-ordering`.

**After building, restart your main server to serve the built files.**

---

## 🧪 Testing

### Test Menu API
```bash
curl http://localhost:5000/api/ordering/menu | jq .
```

### Test Order Creation
```bash
curl -X POST http://localhost:5000/api/ordering/orders \
  -H "Content-Type: application/json" \
  -d '{
    "customer": {"name": "John Doe", "phone": "081-234-5678"},
    "items": [
      {"id": "single_smash", "name": "Single Smash Burger", "unitPrice": 140, "qty": 2, "categoryId": "original_burgers"}
    ],
    "subtotal": 280,
    "serviceFee": 0,
    "total": 280,
    "currency": "THB"
  }'
```

### View Orders
```bash
curl http://localhost:5000/api/ordering/orders | jq .
```

---

## 🎨 Menu Customization

Edit `online-ordering/server/data/menu.json` to:

- Add/remove categories
- Update item names, descriptions, prices
- Change image paths (optional - graceful fallback if missing)

**Example Item:**
```json
{
  "id": "single_smash",
  "categoryId": "original_burgers",
  "name": "Single Smash Burger",
  "desc": "Signature sauce, 100% Australian beef...",
  "price": 140,
  "image": "/images/single.png"
}
```

---

## 🔗 Loyverse Integration (Next Step)

To send orders to Loyverse POS, modify the POST handler in `server/routes.ts`:

```typescript
app.post("/api/ordering/orders", async (req, res) => {
  const p = path.join(process.cwd(), "online-ordering/server/data/orders.json");
  try {
    const orders = JSON.parse(fs.readFileSync(p, "utf8"));
    const id = "ORD_" + Math.random().toString(36).slice(2, 10).toUpperCase();
    const createdAt = new Date().toISOString();
    const order = { id, createdAt, status: "RECEIVED", ...req.body };
    
    // Save to JSON (backup/audit)
    orders.push(order);
    fs.writeFileSync(p, JSON.stringify(orders, null, 2));
    
    // TODO: Send to Loyverse
    // await sendToLoyversePOS(order);
    
    res.json({ ok: true, id, createdAt });
  } catch (e) {
    res.status(500).json({ error: "Failed to create order" });
  }
});
```

---

## 💳 Stripe Integration (Optional)

To add payments:

1. Install Stripe: `npm install stripe @stripe/stripe-js`
2. Create checkout session endpoint
3. Add payment modal before order submission

---

## 📱 Features

### Customer Experience
- Browse menu by category (tabs)
- View item details with image/description
- Add to cart with quantity selector
- Add special notes per item
- Review cart before checkout
- Submit order with customer info
- Optional scheduled pickup time

### Admin Features  
- View all orders: `/api/ordering/orders`
- Edit menu: `online-ordering/server/data/menu.json`
- Order history stored in JSON

---

## 🚀 Go Live Checklist

- [ ] Build the client (`npm run build` in `online-ordering/client`)
- [ ] Restart main server
- [ ] Test ordering flow at `https://your-app.replit.app/online-ordering`
- [ ] Add real product images (or remove image references)
- [ ] Connect to Loyverse POS
- [ ] Add Stripe payments (optional)
- [ ] Share ordering URL with customers

---

## 📊 Current Menu

**5 Categories:**
1. Burger Meal Sets (3 items)
2. Side Orders (4 items)
3. Original Smash Burgers (4 items)
4. Kids Menu (1 item)
5. Drinks (4 items)

**16 Items Total** - All with Thai baht (THB) pricing

---

## ⚡ Performance

- LocalStorage cart persistence
- Optimized Vite build
- Static asset caching
- Mobile-first responsive design
- Works offline (after first load)

---

## 🎯 Integration Points

The online ordering system is fully integrated with your main app:

- **Routes:** `/api/ordering/*` (menu, orders)
- **Static Serving:** `/online-ordering` (React SPA)
- **Storage:** `online-ordering/server/data/` (JSON files)
- **Main Server:** `server/routes.ts` (lines 1047-1088)

No conflicts with existing routes!

---

## 📞 Support

Need help? Check:
- `BUILD.md` - Detailed build instructions
- `README.md` (this file) - Complete guide
- Main server logs - Check for API errors
- Browser console - Check for client errors

---

**Built with ❤️ for Smash Brothers Burgers (Rawai)**
