# Building the Online Ordering Client

## Prerequisites
You need Node.js and npm installed.

## Build Steps

1. **Install Dependencies**
   ```bash
   cd online-ordering/client
   npm install
   ```

2. **Build for Production**
   ```bash
   npm run build
   ```
   
   This creates a `dist/` folder with the optimized production build.

3. **Access the Ordering System**
   
   Once built, the ordering system is available at:
   - **Customer ordering page:** https://your-app.replit.app/online-ordering
   - **Menu API:** https://your-app.replit.app/api/ordering/menu
   - **Orders API:** https://your-app.replit.app/api/ordering/orders

## Development Mode

To run the client in development mode:

```bash
cd online-ordering/client
npm run dev
```

This starts Vite dev server on port 5173 with hot reload.

## Quick Test (Without Building)

You can test the API endpoints directly:

```bash
# Get menu
curl http://localhost:5000/api/ordering/menu

# Create order
curl -X POST http://localhost:5000/api/ordering/orders \
  -H "Content-Type: application/json" \
  -d '{
    "items": [
      {"id": "single_smash", "name": "Single Smash Burger", "unitPrice": 140, "qty": 2, "categoryId": "original_burgers"}
    ],
    "subtotal": 280,
    "serviceFee": 0,
    "total": 280,
    "currency": "THB"
  }'

# List orders
curl http://localhost:5000/api/ordering/orders
```

## What's Included

- **Black/Yellow Vev-style UI** - Modern, mobile-first design
- **Cart System** - Add items, quantities, special notes
- **Local Storage** - Cart persists across page reloads
- **Order Submission** - Saves to JSON file (ready for Loyverse integration)
- **Modal Checkout** - Clean checkout flow with customer info

## Next Steps

1. **Build the client** (run `npm run build` in `online-ordering/client`)
2. **Restart your main server** to serve the built files
3. **Test the ordering flow** at `/online-ordering`
4. **Connect to Loyverse** when ready (modify POST `/api/ordering/orders` to call Loyverse API)
5. **Add Stripe** for payments (optional)
