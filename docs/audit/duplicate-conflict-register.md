# Duplicate / Conflict Register

Focused register after Replit second-sign-off: runtime conflicts only; archive/assets tracked separately.

## 1. `drinksLedger.ts`
- exact files: `server/routes/drinksLedger.ts`, `server/services/drinksLedger.ts`
- impact: potential implementation overlap; verify active import/mount path.
- disposition: keep canonical mounted route/service; mark others as legacy only if unreferenced.

## 2. `email.ts`
- exact files: `server/lib/email.ts`, `server/services/email.ts`
- impact: potential implementation overlap; verify active import/mount path.
- disposition: keep canonical mounted route/service; mark others as legacy only if unreferenced.

## 3. `ensureShift.ts`
- exact files: `server/routes/ensureShift.ts`, `server/services/ensureShift.ts`
- impact: potential implementation overlap; verify active import/mount path.
- disposition: keep canonical mounted route/service; mark others as legacy only if unreferenced.

## 4. `finance.ts`
- exact files: `server/routes/finance.ts`, `server/api/finance.ts`
- impact: potential implementation overlap; verify active import/mount path.
- disposition: keep canonical mounted route/service; mark others as legacy only if unreferenced.

## 5. `forms.ts`
- exact files: `server/routes/forms.ts`, `server/api/forms.ts`
- impact: potential implementation overlap; verify active import/mount path.
- disposition: keep canonical mounted route/service; mark others as legacy only if unreferenced.

## 6. `ingredientAuthority.ts`
- exact files: `server/routes/ingredientAuthority.ts`, `server/routes/admin/ingredientAuthority.ts`, `server/lib/ingredientAuthority.ts`
- impact: potential implementation overlap; verify active import/mount path.
- disposition: keep canonical mounted route/service; mark others as legacy only if unreferenced.

## 7. `ingredients.ts`
- exact files: `server/routes/ingredients.ts`, `server/forms/ingredients.ts`
- impact: potential implementation overlap; verify active import/mount path.
- disposition: keep canonical mounted route/service; mark others as legacy only if unreferenced.

## 8. `loyverse.js`
- exact files: `server/services/pos-ingestion/loyverse.js`, `server/utils/loyverse.js`
- impact: potential implementation overlap; verify active import/mount path.
- disposition: keep canonical mounted route/service; mark others as legacy only if unreferenced.

## 9. `loyverse.ts`
- exact files: `server/services/loyverse.ts`, `server/utils/loyverse.ts`
- impact: potential implementation overlap; verify active import/mount path.
- disposition: keep canonical mounted route/service; mark others as legacy only if unreferenced.

## 10. `meatLedger.ts`
- exact files: `server/routes/meatLedger.ts`, `server/services/meatLedger.ts`
- impact: potential implementation overlap; verify active import/mount path.
- disposition: keep canonical mounted route/service; mark others as legacy only if unreferenced.

## 11. `pdf.ts`
- exact files: `server/routes/healthSafety/pdf.ts`, `server/lib/pdf.ts`, `server/services/pdf.ts`
- impact: potential implementation overlap; verify active import/mount path.
- disposition: keep canonical mounted route/service; mark others as legacy only if unreferenced.

## 12. `primeCost.ts`
- exact files: `server/routes/primeCost.ts`, `server/services/primeCost.ts`
- impact: potential implementation overlap; verify active import/mount path.
- disposition: keep canonical mounted route/service; mark others as legacy only if unreferenced.

## 13. `qrRoutes.ts`
- exact files: `server/routes/qrRoutes.ts`, `server/routes/payments/qrRoutes.ts`
- impact: potential implementation overlap; verify active import/mount path.
- disposition: keep canonical mounted route/service; mark others as legacy only if unreferenced.

## 14. `recipeService.ts`
- exact files: `server/services/recipeService.ts`, `server/services/menu/recipeService.ts`
- impact: potential implementation overlap; verify active import/mount path.
- disposition: keep canonical mounted route/service; mark others as legacy only if unreferenced.

## 15. `rollsLedger.ts`
- exact files: `server/routes/rollsLedger.ts`, `server/services/rollsLedger.ts`
- impact: potential implementation overlap; verify active import/mount path.
- disposition: keep canonical mounted route/service; mark others as legacy only if unreferenced.

## 16. `seedExpenses.ts`
- exact files: `server/seedExpenses.ts`, `server/scripts/seedExpenses.ts`
- impact: potential implementation overlap; verify active import/mount path.
- disposition: keep canonical mounted route/service; mark others as legacy only if unreferenced.

## 17. `seedIngredients.ts`
- exact files: `server/scripts/seedIngredients.ts`, `server/lib/seedIngredients.ts`
- impact: potential implementation overlap; verify active import/mount path.
- disposition: keep canonical mounted route/service; mark others as legacy only if unreferenced.

## 18. `shiftWindow.ts`
- exact files: `server/lib/shiftWindow.ts`, `server/services/time/shiftWindow.ts`, `server/utils/shiftWindow.ts`
- impact: potential implementation overlap; verify active import/mount path.
- disposition: keep canonical mounted route/service; mark others as legacy only if unreferenced.

## 19. `shoppingList.ts`
- exact files: `server/shoppingList.ts`, `server/routes/shoppingList.ts`, `server/services/shoppingList.ts`
- impact: potential implementation overlap; verify active import/mount path.
- disposition: keep canonical mounted route/service; mark others as legacy only if unreferenced.

## 20. `skuMap.ts`
- exact files: `server/routes/skuMap.ts`, `server/services/skuMap.ts`
- impact: potential implementation overlap; verify active import/mount path.
- disposition: keep canonical mounted route/service; mark others as legacy only if unreferenced.

## 21. `summaryGenerator.js`
- exact files: `server/services/summaryGenerator.js`, `server/services/jussi/summaryGenerator.js`
- impact: potential implementation overlap; verify active import/mount path.
- disposition: keep canonical mounted route/service; mark others as legacy only if unreferenced.
