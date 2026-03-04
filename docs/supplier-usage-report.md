# Supplier Usage Report (Repo-wide)

## Scope and search terms
- Searched `server`, `client`, `shared`, and `schema.prisma` for:
  - `supplier`
  - `purchasingItem.supplier`
  - `supplierId`
  - `model Supplier` / `model suppliers`

## Raw hit volume
- Command: `rg -n "supplier|purchasingItem\.supplier|supplierId|model Supplier|model suppliers" server client shared schema.prisma --glob '!**/node_modules/**'`
- Total matches: **1064**

## High-signal files proving active supplier usage

### Purchasing + Form 2 path
- `schema.prisma`
  - `PurchasingItem` includes `supplier` and `supplierName` fields.【F:schema.prisma†L1672-L1680】
- `server/routes/purchasingItems.ts`
  - Form 2 sync endpoint maps supplier-facing value from `supplierName` in transformed payload.【F:server/routes/purchasingItems.ts†L408-L418】
  - Catalog population writes supplier values into `supplierName` from source data.【F:server/routes/purchasingItems.ts†L521-L539】
- `client/src/pages/operations/DailyStock.tsx`
  - Form 2 maps supplier from purchasing payload and uses purchasing APIs for sync/load flow.【F:client/src/pages/operations/DailyStock.tsx†L178-L189】【F:client/src/pages/operations/DailyStock.tsx†L211-L244】

### Purchasing analytics / shopping / downstream ops
- `server/routes/purchasingAnalytics.ts`
  - Aggregates by supplier for analytics grouping/reporting.【F:server/routes/purchasingAnalytics.ts†L101-L109】
- `server/routes/shoppingListNew.ts`
  - Emits supplier in shopping list rows and exports.【F:server/routes/shoppingListNew.ts†L332-L341】【F:server/routes/shoppingListNew.ts†L405-L414】
- `client/src/pages/ShoppingList.tsx`
  - Displays supplier for shopping lines and table rows.【F:client/src/pages/ShoppingList.tsx†L150-L156】【F:client/src/pages/ShoppingList.tsx†L314-L322】

### Ingredient management + costing
- `server/routes/ingredients.ts`
  - Reads/writes supplier across ingredient APIs and DTO mapping.【F:server/routes/ingredients.ts†L322-L329】【F:server/routes/ingredients.ts†L398-L408】
- `server/services/ingredientService.ts`
  - Persists supplier in ingredient create/update service logic.【F:server/services/ingredientService.ts†L61-L69】【F:server/services/ingredientService.ts†L126-L134】
- `server/routes/costing.ts`
  - Uses supplier in costing response shaping.【F:server/routes/costing.ts†L48-L51】【F:server/routes/costing.ts†L136-L143】

### Expense workflows
- `shared/schema.ts`
  - Supplier appears in expense and supplier-linked schema definitions (`supplier_lkp`, `suppliers`, defaults).【F:shared/schema.ts†L279-L326】【F:shared/schema.ts†L379-L387】
- `server/routes/expenses-import.ts`
  - Supplier defaults and supplier-based matching are used in import flow.【F:server/routes/expenses-import.ts†L527-L571】【F:server/routes/expenses-import.ts†L852-L919】
- `client/src/pages/Expenses.tsx`
  - Supplier-driven detection/defaulting and display in UI workflows.【F:client/src/pages/Expenses.tsx†L262-L361】【F:client/src/pages/Expenses.tsx†L768-L800】

## Conclusion
- Supplier is actively used across multiple domains (purchasing, shopping list, analytics, ingredients, expenses).
- For the `purchasing_items.supplier` mismatch specifically, the lowest-risk unblock is to avoid selecting that legacy Prisma field in Form 2-related reads while preserving existing supplier-facing behavior via `supplierName`.
