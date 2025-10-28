# AGENT RULES - ABSOLUTE GUARDRAILS

## 🔒 PROTECTED FILES - DO NOT MODIFY WITHOUT EXPLICIT INSTRUCTION

The following files **CANNOT** be modified without an explicit instruction from Cameron in the same chat message:

1. `schema.prisma` (Prisma database schema)
2. `server/lib/costingEngine.ts` (Recipe costing calculations)
3. `server/routes/ingredients.ts` (Ingredient API routes)
4. `server/jobs/syncIngredientsFromGodFile.ts` (Ingredient sync job)
5. `server/routes/purchasing.ts` (Purchasing API - once created)
6. `server/lib/purchasingPlanner.ts` (Purchasing planner - once created)

## ⛔ PROHIBITED ACTIONS

1. **DO NOT** remove or rename database tables/columns
2. **DO NOT** run manual migrations - only use the provided migration commands
3. **DO NOT** "simplify" by merging portion and purchasing concepts
   - **Portioning is for recipe costing**
   - **Purchasing is for shopping lists**
   - **They are separate by design**
4. **DO NOT** change unit conversion logic
5. **DO NOT** try to convert between mass (g/kg) and volume (ml/L) - they are different families
6. **DO NOT** switch shopping list math to portion units
   - Shopping lists **MUST** be computed exclusively from package sizes (purchase units/quantities)
   - Results must be rounded to whole packs

## ✅ ALLOWED ACTIONS

- Add new routes in `server/routes/` as long as they don't alter behavior of protected files
- Add tests, logging, or comments
- Update UI to read new API responses without changing field meanings

## 🔧 RUN ORDER ONLY (when asked)

When applying migrations, run **ONLY** these commands in order:

```bash
npx prisma generate
npx prisma migrate dev --name add_ingredient_price_history
```

If any step fails, **STOP** and report the exact error. Do not "try fixes".

## 📋 PURCHASING VS PORTIONING SPLIT

### Purchasing Data (Shopping Lists)
- `purchaseUnit` (kg|g|L|ml|each)
- `purchaseQty` (how much per pack)
- `packageCost` (THB cost per pack)
- **Used for**: Shopping list pack quantities

### Portion Data (Recipe Costing)
- `portionUnit` (g|ml|each)
- `portionQty` (e.g., 95 g per burger)
- **Used for**: Recipe cost calculations and pricing

**NEVER** use portion data for shopping lists.
**NEVER** use purchasing data for recipe costing.

## 🎯 DATA INTEGRITY POLICY

- **NO** fake, mock, placeholder, or synthetic data
- **ALWAYS** use authentic data from database or authorized sources
- Creating fake data for testing is **STRICTLY PROHIBITED**

---

**Document Version**: 1.0  
**Last Updated**: October 28, 2025  
**Authority**: Cameron (Project Owner)
