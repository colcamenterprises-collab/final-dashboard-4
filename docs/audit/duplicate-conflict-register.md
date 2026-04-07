# Duplicate / Conflict Register

Scope corrected to code/system duplicates (asset-only duplication removed).

## 1. `accordion`
- **exact files**: `client/src/components/ui/accordion.tsx`, `extracted_dashboard/Restaurant-Hub/client/src/components/ui/accordion.tsx`
- **exact routes/endpoints**: See `docs/audit/route-inventory.csv` for mounted route paths from these modules.
- **what overlaps**: Same module basename appears in multiple trees.
- **which appears primary**: LIKELY active tree under `server/` or `client/src/`.
- **which appears legacy**: LIKELY archive/extracted/legacy/prototype paths.
- **business risk**: drift between active and shadow logic.
- **recommended action**: route-level parity test before retirement.
- **confidence**: LIKELY

## 2. `ai`
- **exact files**: `archive/_legacy/routes.ts_legacy_dir/services/ai.ts`, `exports/services/ai.ts`, `extracted_dashboard/Restaurant-Hub/server/services/ai.ts`, `server/services/ai.ts`
- **exact routes/endpoints**: See `docs/audit/route-inventory.csv` for mounted route paths from these modules.
- **what overlaps**: Same module basename appears in multiple trees.
- **which appears primary**: LIKELY active tree under `server/` or `client/src/`.
- **which appears legacy**: LIKELY archive/extracted/legacy/prototype paths.
- **business risk**: drift between active and shadow logic.
- **recommended action**: route-level parity test before retirement.
- **confidence**: LIKELY

## 3. `ai-agent`
- **exact files**: `archive/_legacy/routes.ts_legacy_dir/ai-agent.ts`, `server/ai-agent.ts`
- **exact routes/endpoints**: See `docs/audit/route-inventory.csv` for mounted route paths from these modules.
- **what overlaps**: Same module basename appears in multiple trees.
- **which appears primary**: LIKELY active tree under `server/` or `client/src/`.
- **which appears legacy**: LIKELY archive/extracted/legacy/prototype paths.
- **business risk**: drift between active and shadow logic.
- **recommended action**: route-level parity test before retirement.
- **confidence**: LIKELY

## 4. `aianalysisservice`
- **exact files**: `archive/_legacy/routes.ts_legacy_dir/services/aiAnalysisService.ts`, `exports/services/aiAnalysisService.ts`, `focused-export/aiAnalysisService.ts`, `server/services/aiAnalysisService.ts`
- **exact routes/endpoints**: See `docs/audit/route-inventory.csv` for mounted route paths from these modules.
- **what overlaps**: Same module basename appears in multiple trees.
- **which appears primary**: LIKELY active tree under `server/` or `client/src/`.
- **which appears legacy**: LIKELY archive/extracted/legacy/prototype paths.
- **business risk**: drift between active and shadow logic.
- **recommended action**: route-level parity test before retirement.
- **confidence**: LIKELY

## 5. `aichatwidget`
- **exact files**: `client/src/components/AIChatWidget.tsx`, `loyverse-ai-package/client/src/components/AIChatWidget.tsx`
- **exact routes/endpoints**: See `docs/audit/route-inventory.csv` for mounted route paths from these modules.
- **what overlaps**: Same module basename appears in multiple trees.
- **which appears primary**: LIKELY active tree under `server/` or `client/src/`.
- **which appears legacy**: LIKELY archive/extracted/legacy/prototype paths.
- **business risk**: drift between active and shadow logic.
- **recommended action**: route-level parity test before retirement.
- **confidence**: LIKELY

## 6. `aiinsightscard`
- **exact files**: `client/src/components/AIInsightsCard.tsx`, `extracted_dashboard/Restaurant-Hub/client/src/components/AIInsightsCard.tsx`, `loyverse-ai-package/client/src/components/AIInsightsCard.tsx`
- **exact routes/endpoints**: See `docs/audit/route-inventory.csv` for mounted route paths from these modules.
- **what overlaps**: Same module basename appears in multiple trees.
- **which appears primary**: LIKELY active tree under `server/` or `client/src/`.
- **which appears legacy**: LIKELY archive/extracted/legacy/prototype paths.
- **business risk**: drift between active and shadow logic.
- **recommended action**: route-level parity test before retirement.
- **confidence**: LIKELY

## 7. `aiopscontrol`
- **exact files**: `client/src/pages/operations/AiOpsControl.tsx`, `server/routes/aiOpsControl.ts`
- **exact routes/endpoints**: See `docs/audit/route-inventory.csv` for mounted route paths from these modules.
- **what overlaps**: Same module basename appears in multiple trees.
- **which appears primary**: LIKELY active tree under `server/` or `client/src/`.
- **which appears legacy**: LIKELY archive/extracted/legacy/prototype paths.
- **business risk**: drift between active and shadow logic.
- **recommended action**: route-level parity test before retirement.
- **confidence**: LIKELY

## 8. `alert`
- **exact files**: `client/src/components/ui/alert.tsx`, `extracted_dashboard/Restaurant-Hub/client/src/components/ui/alert.tsx`
- **exact routes/endpoints**: See `docs/audit/route-inventory.csv` for mounted route paths from these modules.
- **what overlaps**: Same module basename appears in multiple trees.
- **which appears primary**: LIKELY active tree under `server/` or `client/src/`.
- **which appears legacy**: LIKELY archive/extracted/legacy/prototype paths.
- **business risk**: drift between active and shadow logic.
- **recommended action**: route-level parity test before retirement.
- **confidence**: LIKELY

## 9. `alert-dialog`
- **exact files**: `client/src/components/ui/alert-dialog.tsx`, `extracted_dashboard/Restaurant-Hub/client/src/components/ui/alert-dialog.tsx`
- **exact routes/endpoints**: See `docs/audit/route-inventory.csv` for mounted route paths from these modules.
- **what overlaps**: Same module basename appears in multiple trees.
- **which appears primary**: LIKELY active tree under `server/` or `client/src/`.
- **which appears legacy**: LIKELY archive/extracted/legacy/prototype paths.
- **business risk**: drift between active and shadow logic.
- **recommended action**: route-level parity test before retirement.
- **confidence**: LIKELY

## 10. `align-receipts`
- **exact files**: `archive/_legacy/routes.ts_legacy_dir/align-receipts.js`, `server/align-receipts.js`
- **exact routes/endpoints**: See `docs/audit/route-inventory.csv` for mounted route paths from these modules.
- **what overlaps**: Same module basename appears in multiple trees.
- **which appears primary**: LIKELY active tree under `server/` or `client/src/`.
- **which appears legacy**: LIKELY archive/extracted/legacy/prototype paths.
- **business risk**: drift between active and shadow logic.
- **recommended action**: route-level parity test before retirement.
- **confidence**: LIKELY

## 11. `analysis`
- **exact files**: `archive/_legacy/Analysis.tsx`, `client/src/pages/operations/Analysis.tsx`, `extracted_dashboard/Restaurant-Hub/client/src/pages/Analysis.tsx`, `src/server/jussi/analysis.ts`, `workers/analysis.ts`
- **exact routes/endpoints**: See `docs/audit/route-inventory.csv` for mounted route paths from these modules.
- **what overlaps**: Same module basename appears in multiple trees.
- **which appears primary**: LIKELY active tree under `server/` or `client/src/`.
- **which appears legacy**: LIKELY archive/extracted/legacy/prototype paths.
- **business risk**: drift between active and shadow logic.
- **recommended action**: route-level parity test before retirement.
- **confidence**: LIKELY

## 12. `analysisshift`
- **exact files**: `archive/_legacy/routes.ts_legacy_dir/routes/analysisShift.ts`, `server/routes/analysisShift.ts`
- **exact routes/endpoints**: See `docs/audit/route-inventory.csv` for mounted route paths from these modules.
- **what overlaps**: Same module basename appears in multiple trees.
- **which appears primary**: LIKELY active tree under `server/` or `client/src/`.
- **which appears legacy**: LIKELY archive/extracted/legacy/prototype paths.
- **business risk**: drift between active and shadow logic.
- **recommended action**: route-level parity test before retirement.
- **confidence**: LIKELY

## 13. `analytics`
- **exact files**: `archive/_legacy/routes.ts_legacy_dir/routes/analytics.ts`, `server/routes/analytics.ts`
- **exact routes/endpoints**: See `docs/audit/route-inventory.csv` for mounted route paths from these modules.
- **what overlaps**: Same module basename appears in multiple trees.
- **which appears primary**: LIKELY active tree under `server/` or `client/src/`.
- **which appears legacy**: LIKELY archive/extracted/legacy/prototype paths.
- **business risk**: drift between active and shadow logic.
- **recommended action**: route-level parity test before retirement.
- **confidence**: LIKELY

## 14. `api`
- **exact files**: `client/src/lib/api.ts`, `extracted_dashboard/Restaurant-Hub/client/src/lib/api.ts`
- **exact routes/endpoints**: See `docs/audit/route-inventory.csv` for mounted route paths from these modules.
- **what overlaps**: Same module basename appears in multiple trees.
- **which appears primary**: LIKELY active tree under `server/` or `client/src/`.
- **which appears legacy**: LIKELY archive/extracted/legacy/prototype paths.
- **business risk**: drift between active and shadow logic.
- **recommended action**: route-level parity test before retirement.
- **confidence**: LIKELY

## 15. `app`
- **exact files**: `client/src/App.tsx`, `extracted_dashboard/Restaurant-Hub/client/src/App.tsx`, `online-ordering/client/src/App.tsx`
- **exact routes/endpoints**: See `docs/audit/route-inventory.csv` for mounted route paths from these modules.
- **what overlaps**: Same module basename appears in multiple trees.
- **which appears primary**: LIKELY active tree under `server/` or `client/src/`.
- **which appears legacy**: LIKELY archive/extracted/legacy/prototype paths.
- **business risk**: drift between active and shadow logic.
- **recommended action**: route-level parity test before retirement.
- **confidence**: LIKELY

## 16. `aspect-ratio`
- **exact files**: `client/src/components/ui/aspect-ratio.tsx`, `extracted_dashboard/Restaurant-Hub/client/src/components/ui/aspect-ratio.tsx`
- **exact routes/endpoints**: See `docs/audit/route-inventory.csv` for mounted route paths from these modules.
- **what overlaps**: Same module basename appears in multiple trees.
- **which appears primary**: LIKELY active tree under `server/` or `client/src/`.
- **which appears legacy**: LIKELY archive/extracted/legacy/prototype paths.
- **business risk**: drift between active and shadow logic.
- **recommended action**: route-level parity test before retirement.
- **confidence**: LIKELY

## 17. `avatar`
- **exact files**: `client/src/components/ui/avatar.tsx`, `extracted_dashboard/Restaurant-Hub/client/src/components/ui/avatar.tsx`
- **exact routes/endpoints**: See `docs/audit/route-inventory.csv` for mounted route paths from these modules.
- **what overlaps**: Same module basename appears in multiple trees.
- **which appears primary**: LIKELY active tree under `server/` or `client/src/`.
- **which appears legacy**: LIKELY archive/extracted/legacy/prototype paths.
- **business risk**: drift between active and shadow logic.
- **recommended action**: route-level parity test before retirement.
- **confidence**: LIKELY

## 18. `badge`
- **exact files**: `client/src/components/ui/badge.tsx`, `extracted_dashboard/Restaurant-Hub/client/src/components/ui/badge.tsx`
- **exact routes/endpoints**: See `docs/audit/route-inventory.csv` for mounted route paths from these modules.
- **what overlaps**: Same module basename appears in multiple trees.
- **which appears primary**: LIKELY active tree under `server/` or `client/src/`.
- **which appears legacy**: LIKELY archive/extracted/legacy/prototype paths.
- **business risk**: drift between active and shadow logic.
- **recommended action**: route-level parity test before retirement.
- **confidence**: LIKELY

## 19. `bankimport`
- **exact files**: `archive/_legacy/routes.ts_legacy_dir/routes/bankImport.ts`, `server/routes/bankImport.ts`
- **exact routes/endpoints**: See `docs/audit/route-inventory.csv` for mounted route paths from these modules.
- **what overlaps**: Same module basename appears in multiple trees.
- **which appears primary**: LIKELY active tree under `server/` or `client/src/`.
- **which appears legacy**: LIKELY archive/extracted/legacy/prototype paths.
- **business risk**: drift between active and shadow logic.
- **recommended action**: route-level parity test before retirement.
- **confidence**: LIKELY

## 20. `bigboss`
- **exact files**: `archive/_legacy/routes.ts_legacy_dir/agents/bigboss.ts`, `server/agents/bigboss.ts`
- **exact routes/endpoints**: See `docs/audit/route-inventory.csv` for mounted route paths from these modules.
- **what overlaps**: Same module basename appears in multiple trees.
- **which appears primary**: LIKELY active tree under `server/` or `client/src/`.
- **which appears legacy**: LIKELY archive/extracted/legacy/prototype paths.
- **business risk**: drift between active and shadow logic.
- **recommended action**: route-level parity test before retirement.
- **confidence**: LIKELY

## 21. `bom`
- **exact files**: `archive/_legacy/routes.ts_legacy_dir/services/recipes/bom.ts`, `server/services/recipes/bom.ts`
- **exact routes/endpoints**: See `docs/audit/route-inventory.csv` for mounted route paths from these modules.
- **what overlaps**: Same module basename appears in multiple trees.
- **which appears primary**: LIKELY active tree under `server/` or `client/src/`.
- **which appears legacy**: LIKELY archive/extracted/legacy/prototype paths.
- **business risk**: drift between active and shadow logic.
- **recommended action**: route-level parity test before retirement.
- **confidence**: LIKELY

## 22. `breadcrumb`
- **exact files**: `client/src/components/ui/breadcrumb.tsx`, `extracted_dashboard/Restaurant-Hub/client/src/components/ui/breadcrumb.tsx`
- **exact routes/endpoints**: See `docs/audit/route-inventory.csv` for mounted route paths from these modules.
- **what overlaps**: Same module basename appears in multiple trees.
- **which appears primary**: LIKELY active tree under `server/` or `client/src/`.
- **which appears legacy**: LIKELY archive/extracted/legacy/prototype paths.
- **business risk**: drift between active and shadow logic.
- **recommended action**: route-level parity test before retirement.
- **confidence**: LIKELY

## 23. `burgerdefinitions`
- **exact files**: `archive/_legacy/routes.ts_legacy_dir/constants/burgerDefinitions.ts`, `server/constants/burgerDefinitions.ts`
- **exact routes/endpoints**: See `docs/audit/route-inventory.csv` for mounted route paths from these modules.
- **what overlaps**: Same module basename appears in multiple trees.
- **which appears primary**: LIKELY active tree under `server/` or `client/src/`.
- **which appears legacy**: LIKELY archive/extracted/legacy/prototype paths.
- **business risk**: drift between active and shadow logic.
- **recommended action**: route-level parity test before retirement.
- **confidence**: LIKELY

## 24. `burgervarianceservice`
- **exact files**: `archive/_legacy/routes.ts_legacy_dir/services/burgerVarianceService.ts`, `exports/services/burgerVarianceService.ts`, `server/services/burgerVarianceService.ts`
- **exact routes/endpoints**: See `docs/audit/route-inventory.csv` for mounted route paths from these modules.
- **what overlaps**: Same module basename appears in multiple trees.
- **which appears primary**: LIKELY active tree under `server/` or `client/src/`.
- **which appears legacy**: LIKELY archive/extracted/legacy/prototype paths.
- **business risk**: drift between active and shadow logic.
- **recommended action**: route-level parity test before retirement.
- **confidence**: LIKELY

## 25. `businessexpenses`
- **exact files**: `client/src/pages/BusinessExpenses.tsx`, `client/src/pages/expenses/BusinessExpenses.tsx`
- **exact routes/endpoints**: See `docs/audit/route-inventory.csv` for mounted route paths from these modules.
- **what overlaps**: Same module basename appears in multiple trees.
- **which appears primary**: LIKELY active tree under `server/` or `client/src/`.
- **which appears legacy**: LIKELY archive/extracted/legacy/prototype paths.
- **business risk**: drift between active and shadow logic.
- **recommended action**: route-level parity test before retirement.
- **confidence**: LIKELY

## 26. `button`
- **exact files**: `client/src/components/ui/button.tsx`, `extracted_dashboard/Restaurant-Hub/client/src/components/ui/button.tsx`
- **exact routes/endpoints**: See `docs/audit/route-inventory.csv` for mounted route paths from these modules.
- **what overlaps**: Same module basename appears in multiple trees.
- **which appears primary**: LIKELY active tree under `server/` or `client/src/`.
- **which appears legacy**: LIKELY archive/extracted/legacy/prototype paths.
- **business risk**: drift between active and shadow logic.
- **recommended action**: route-level parity test before retirement.
- **confidence**: LIKELY

## 27. `calendar`
- **exact files**: `client/src/components/ui/calendar.tsx`, `extracted_dashboard/Restaurant-Hub/client/src/components/ui/calendar.tsx`
- **exact routes/endpoints**: See `docs/audit/route-inventory.csv` for mounted route paths from these modules.
- **what overlaps**: Same module basename appears in multiple trees.
- **which appears primary**: LIKELY active tree under `server/` or `client/src/`.
- **which appears legacy**: LIKELY archive/extracted/legacy/prototype paths.
- **business risk**: drift between active and shadow logic.
- **recommended action**: route-level parity test before retirement.
- **confidence**: LIKELY

## 28. `card`
- **exact files**: `client/src/components/ui/card.tsx`, `extracted_dashboard/Restaurant-Hub/client/src/components/ui/card.tsx`
- **exact routes/endpoints**: See `docs/audit/route-inventory.csv` for mounted route paths from these modules.
- **what overlaps**: Same module basename appears in multiple trees.
- **which appears primary**: LIKELY active tree under `server/` or `client/src/`.
- **which appears legacy**: LIKELY archive/extracted/legacy/prototype paths.
- **business risk**: drift between active and shadow logic.
- **recommended action**: route-level parity test before retirement.
- **confidence**: LIKELY

## 29. `carousel`
- **exact files**: `client/src/components/ui/carousel.tsx`, `extracted_dashboard/Restaurant-Hub/client/src/components/ui/carousel.tsx`
- **exact routes/endpoints**: See `docs/audit/route-inventory.csv` for mounted route paths from these modules.
- **what overlaps**: Same module basename appears in multiple trees.
- **which appears primary**: LIKELY active tree under `server/` or `client/src/`.
- **which appears legacy**: LIKELY archive/extracted/legacy/prototype paths.
- **business risk**: drift between active and shadow logic.
- **recommended action**: route-level parity test before retirement.
- **confidence**: LIKELY

## 30. `chart`
- **exact files**: `client/src/components/ui/chart.tsx`, `extracted_dashboard/Restaurant-Hub/client/src/components/ui/chart.tsx`
- **exact routes/endpoints**: See `docs/audit/route-inventory.csv` for mounted route paths from these modules.
- **what overlaps**: Same module basename appears in multiple trees.
- **which appears primary**: LIKELY active tree under `server/` or `client/src/`.
- **which appears legacy**: LIKELY archive/extracted/legacy/prototype paths.
- **business risk**: drift between active and shadow logic.
- **recommended action**: route-level parity test before retirement.
- **confidence**: LIKELY

## 31. `checkbox`
- **exact files**: `client/src/components/ui/checkbox.tsx`, `extracted_dashboard/Restaurant-Hub/client/src/components/ui/checkbox.tsx`
- **exact routes/endpoints**: See `docs/audit/route-inventory.csv` for mounted route paths from these modules.
- **what overlaps**: Same module basename appears in multiple trees.
- **which appears primary**: LIKELY active tree under `server/` or `client/src/`.
- **which appears legacy**: LIKELY archive/extracted/legacy/prototype paths.
- **business risk**: drift between active and shadow logic.
- **recommended action**: route-level parity test before retirement.
- **confidence**: LIKELY

## 32. `checklinkage`
- **exact files**: `checkLinkage.js`, `checkLinkage.mjs`
- **exact routes/endpoints**: See `docs/audit/route-inventory.csv` for mounted route paths from these modules.
- **what overlaps**: Same module basename appears in multiple trees.
- **which appears primary**: LIKELY active tree under `server/` or `client/src/`.
- **which appears legacy**: LIKELY archive/extracted/legacy/prototype paths.
- **business risk**: drift between active and shadow logic.
- **recommended action**: route-level parity test before retirement.
- **confidence**: LIKELY

## 33. `chef`
- **exact files**: `archive/_legacy/routes.ts_legacy_dir/routes/chef.ts`, `server/routes/chef.ts`
- **exact routes/endpoints**: See `docs/audit/route-inventory.csv` for mounted route paths from these modules.
- **what overlaps**: Same module basename appears in multiple trees.
- **which appears primary**: LIKELY active tree under `server/` or `client/src/`.
- **which appears legacy**: LIKELY archive/extracted/legacy/prototype paths.
- **business risk**: drift between active and shadow logic.
- **recommended action**: route-level parity test before retirement.
- **confidence**: LIKELY

## 34. `collapsible`
- **exact files**: `client/src/components/ui/collapsible.tsx`, `extracted_dashboard/Restaurant-Hub/client/src/components/ui/collapsible.tsx`
- **exact routes/endpoints**: See `docs/audit/route-inventory.csv` for mounted route paths from these modules.
- **what overlaps**: Same module basename appears in multiple trees.
- **which appears primary**: LIKELY active tree under `server/` or `client/src/`.
- **which appears legacy**: LIKELY archive/extracted/legacy/prototype paths.
- **business risk**: drift between active and shadow logic.
- **recommended action**: route-level parity test before retirement.
- **confidence**: LIKELY

## 35. `command`
- **exact files**: `client/src/components/ui/command.tsx`, `extracted_dashboard/Restaurant-Hub/client/src/components/ui/command.tsx`
- **exact routes/endpoints**: See `docs/audit/route-inventory.csv` for mounted route paths from these modules.
- **what overlaps**: Same module basename appears in multiple trees.
- **which appears primary**: LIKELY active tree under `server/` or `client/src/`.
- **which appears legacy**: LIKELY archive/extracted/legacy/prototype paths.
- **business risk**: drift between active and shadow logic.
- **recommended action**: route-level parity test before retirement.
- **confidence**: LIKELY

## 36. `compactshiftreports`
- **exact files**: `client/src/components/CompactShiftReports.tsx`, `extracted_dashboard/Restaurant-Hub/client/src/components/CompactShiftReports.tsx`
- **exact routes/endpoints**: See `docs/audit/route-inventory.csv` for mounted route paths from these modules.
- **what overlaps**: Same module basename appears in multiple trees.
- **which appears primary**: LIKELY active tree under `server/` or `client/src/`.
- **which appears legacy**: LIKELY archive/extracted/legacy/prototype paths.
- **business risk**: drift between active and shadow logic.
- **recommended action**: route-level parity test before retirement.
- **confidence**: LIKELY

## 37. `context-menu`
- **exact files**: `client/src/components/ui/context-menu.tsx`, `extracted_dashboard/Restaurant-Hub/client/src/components/ui/context-menu.tsx`
- **exact routes/endpoints**: See `docs/audit/route-inventory.csv` for mounted route paths from these modules.
- **what overlaps**: Same module basename appears in multiple trees.
- **which appears primary**: LIKELY active tree under `server/` or `client/src/`.
- **which appears legacy**: LIKELY archive/extracted/legacy/prototype paths.
- **business risk**: drift between active and shadow logic.
- **recommended action**: route-level parity test before retirement.
- **confidence**: LIKELY

## 38. `costcalculator`
- **exact files**: `client/src/pages/CostCalculator.tsx`, `client/src/pages/menu/CostCalculator.tsx`
- **exact routes/endpoints**: See `docs/audit/route-inventory.csv` for mounted route paths from these modules.
- **what overlaps**: Same module basename appears in multiple trees.
- **which appears primary**: LIKELY active tree under `server/` or `client/src/`.
- **which appears legacy**: LIKELY archive/extracted/legacy/prototype paths.
- **business risk**: drift between active and shadow logic.
- **recommended action**: route-level parity test before retirement.
- **confidence**: LIKELY

## 39. `costing`
- **exact files**: `archive/_legacy/routes.ts_legacy_dir/routes/costing.ts`, `server/routes/costing.ts`
- **exact routes/endpoints**: See `docs/audit/route-inventory.csv` for mounted route paths from these modules.
- **what overlaps**: Same module basename appears in multiple trees.
- **which appears primary**: LIKELY active tree under `server/` or `client/src/`.
- **which appears legacy**: LIKELY archive/extracted/legacy/prototype paths.
- **business risk**: drift between active and shadow logic.
- **recommended action**: route-level parity test before retirement.
- **confidence**: LIKELY

## 40. `cronemailservice`
- **exact files**: `archive/_legacy/routes.ts_legacy_dir/services/cronEmailService.ts`, `server/services/cronEmailService.ts`
- **exact routes/endpoints**: See `docs/audit/route-inventory.csv` for mounted route paths from these modules.
- **what overlaps**: Same module basename appears in multiple trees.
- **which appears primary**: LIKELY active tree under `server/` or `client/src/`.
- **which appears legacy**: LIKELY archive/extracted/legacy/prototype paths.
- **business risk**: drift between active and shadow logic.
- **recommended action**: route-level parity test before retirement.
- **confidence**: LIKELY

## 41. `csvparser`
- **exact files**: `archive/_legacy/routes.ts_legacy_dir/lib/csvParser.ts`, `server/lib/csvParser.ts`
- **exact routes/endpoints**: See `docs/audit/route-inventory.csv` for mounted route paths from these modules.
- **what overlaps**: Same module basename appears in multiple trees.
- **which appears primary**: LIKELY active tree under `server/` or `client/src/`.
- **which appears legacy**: LIKELY archive/extracted/legacy/prototype paths.
- **business risk**: drift between active and shadow logic.
- **recommended action**: route-level parity test before retirement.
- **confidence**: LIKELY

## 42. `daily-sales`
- **exact files**: `archive/_legacy/routes.ts_legacy_dir/api/daily-sales.ts`, `archive/_legacy/routes.ts_legacy_dir/api/library/daily-sales.ts`, `server/api/library/daily-sales.ts`
- **exact routes/endpoints**: See `docs/audit/route-inventory.csv` for mounted route paths from these modules.
- **what overlaps**: Same module basename appears in multiple trees.
- **which appears primary**: LIKELY active tree under `server/` or `client/src/`.
- **which appears legacy**: LIKELY archive/extracted/legacy/prototype paths.
- **business risk**: drift between active and shadow logic.
- **recommended action**: route-level parity test before retirement.
- **confidence**: LIKELY

## 43. `daily-stock`
- **exact files**: `archive/_legacy/daily-stock.tsx`, `archive/_legacy/routes.ts_legacy_dir/api/daily-stock.ts`, `server/api/daily-stock.ts`
- **exact routes/endpoints**: See `docs/audit/route-inventory.csv` for mounted route paths from these modules.
- **what overlaps**: Same module basename appears in multiple trees.
- **which appears primary**: LIKELY active tree under `server/` or `client/src/`.
- **which appears legacy**: LIKELY archive/extracted/legacy/prototype paths.
- **business risk**: drift between active and shadow logic.
- **recommended action**: route-level parity test before retirement.
- **confidence**: LIKELY

## 44. `dailyformtest`
- **exact files**: `client/test/dailyFormTest.js`, `client/test/dailyFormTest.mjs`
- **exact routes/endpoints**: See `docs/audit/route-inventory.csv` for mounted route paths from these modules.
- **what overlaps**: Same module basename appears in multiple trees.
- **which appears primary**: LIKELY active tree under `server/` or `client/src/`.
- **which appears legacy**: LIKELY archive/extracted/legacy/prototype paths.
- **business risk**: drift between active and shadow logic.
- **recommended action**: route-level parity test before retirement.
- **confidence**: LIKELY

## 45. `dailysalesaccess`
- **exact files**: `archive/_legacy/routes.ts_legacy_dir/services/dailySalesAccess.ts`, `server/services/dailySalesAccess.ts`
- **exact routes/endpoints**: See `docs/audit/route-inventory.csv` for mounted route paths from these modules.
- **what overlaps**: Same module basename appears in multiple trees.
- **which appears primary**: LIKELY active tree under `server/` or `client/src/`.
- **which appears legacy**: LIKELY archive/extracted/legacy/prototype paths.
- **business risk**: drift between active and shadow logic.
- **recommended action**: route-level parity test before retirement.
- **confidence**: LIKELY

## 46. `dailysaleslibrary`
- **exact files**: `archive/_legacy/DailySalesLibrary.tsx`, `archive/_legacy/routes.ts_legacy_dir/routes/dailySalesLibrary.ts`, `client/src/components/library/DailySalesLibrary.tsx`, `server/routes/dailySalesLibrary.ts`
- **exact routes/endpoints**: See `docs/audit/route-inventory.csv` for mounted route paths from these modules.
- **what overlaps**: Same module basename appears in multiple trees.
- **which appears primary**: LIKELY active tree under `server/` or `client/src/`.
- **which appears legacy**: LIKELY archive/extracted/legacy/prototype paths.
- **business risk**: drift between active and shadow logic.
- **recommended action**: route-level parity test before retirement.
- **confidence**: LIKELY

## 47. `dailysalesv2`
- **exact files**: `server/forms/dailySalesV2.ts`, `src/server/forms/dailySalesV2.ts`
- **exact routes/endpoints**: See `docs/audit/route-inventory.csv` for mounted route paths from these modules.
- **what overlaps**: Same module basename appears in multiple trees.
- **which appears primary**: LIKELY active tree under `server/` or `client/src/`.
- **which appears legacy**: LIKELY archive/extracted/legacy/prototype paths.
- **business risk**: drift between active and shadow logic.
- **recommended action**: route-level parity test before retirement.
- **confidence**: LIKELY

## 48. `dailyshiftform`
- **exact files**: `archive/_legacy/debug_files/DailyShiftForm.tsx`, `client/src/pages/DailyShiftForm.tsx`
- **exact routes/endpoints**: See `docs/audit/route-inventory.csv` for mounted route paths from these modules.
- **what overlaps**: Same module basename appears in multiple trees.
- **which appears primary**: LIKELY active tree under `server/` or `client/src/`.
- **which appears legacy**: LIKELY archive/extracted/legacy/prototype paths.
- **business risk**: drift between active and shadow logic.
- **recommended action**: route-level parity test before retirement.
- **confidence**: LIKELY

## 49. `dailystock`
- **exact files**: `archive/_legacy/DailyStock.tsx`, `archive/_legacy/routes.ts_legacy_dir/routes/dailyStock.ts`, `client/src/pages/operations/DailyStock.tsx`, `server/routes/dailyStock.ts`
- **exact routes/endpoints**: See `docs/audit/route-inventory.csv` for mounted route paths from these modules.
- **what overlaps**: Same module basename appears in multiple trees.
- **which appears primary**: LIKELY active tree under `server/` or `client/src/`.
- **which appears legacy**: LIKELY archive/extracted/legacy/prototype paths.
- **business risk**: drift between active and shadow logic.
- **recommended action**: route-level parity test before retirement.
- **confidence**: LIKELY

## 50. `dailystocksales`
- **exact files**: `client/src/pages/DailyStockSales.tsx`, `extracted_dashboard/Restaurant-Hub/client/src/pages/DailyStockSales.tsx`
- **exact routes/endpoints**: See `docs/audit/route-inventory.csv` for mounted route paths from these modules.
- **what overlaps**: Same module basename appears in multiple trees.
- **which appears primary**: LIKELY active tree under `server/` or `client/src/`.
- **which appears legacy**: LIKELY archive/extracted/legacy/prototype paths.
- **business risk**: drift between active and shadow logic.
- **recommended action**: route-level parity test before retirement.
- **confidence**: LIKELY

## 51. `dashboard`
- **exact files**: `client/src/pages/Dashboard.tsx`, `extracted_dashboard/Restaurant-Hub/client/src/pages/Dashboard.tsx`
- **exact routes/endpoints**: See `docs/audit/route-inventory.csv` for mounted route paths from these modules.
- **what overlaps**: Same module basename appears in multiple trees.
- **which appears primary**: LIKELY active tree under `server/` or `client/src/`.
- **which appears legacy**: LIKELY archive/extracted/legacy/prototype paths.
- **business risk**: drift between active and shadow logic.
- **recommended action**: route-level parity test before retirement.
- **confidence**: LIKELY

## 52. `db`
- **exact files**: `archive/_legacy/routes.ts_legacy_dir/db.ts`, `db.ts`, `extracted_dashboard/Restaurant-Hub/server/db.ts`, `loyverse-ai-updated-package/server/db.ts`, `server/db.ts`
- **exact routes/endpoints**: See `docs/audit/route-inventory.csv` for mounted route paths from these modules.
- **what overlaps**: Same module basename appears in multiple trees.
- **which appears primary**: LIKELY active tree under `server/` or `client/src/`.
- **which appears legacy**: LIKELY archive/extracted/legacy/prototype paths.
- **business risk**: drift between active and shadow logic.
- **recommended action**: route-level parity test before retirement.
- **confidence**: LIKELY

## 53. `db-health`
- **exact files**: `archive/_legacy/routes.ts_legacy_dir/api/db-health.ts`, `server/api/db-health.ts`
- **exact routes/endpoints**: See `docs/audit/route-inventory.csv` for mounted route paths from these modules.
- **what overlaps**: Same module basename appears in multiple trees.
- **which appears primary**: LIKELY active tree under `server/` or `client/src/`.
- **which appears legacy**: LIKELY archive/extracted/legacy/prototype paths.
- **business risk**: drift between active and shadow logic.
- **recommended action**: route-level parity test before retirement.
- **confidence**: LIKELY

## 54. `dialog`
- **exact files**: `client/src/components/ui/dialog.tsx`, `extracted_dashboard/Restaurant-Hub/client/src/components/ui/dialog.tsx`
- **exact routes/endpoints**: See `docs/audit/route-inventory.csv` for mounted route paths from these modules.
- **what overlaps**: Same module basename appears in multiple trees.
- **which appears primary**: LIKELY active tree under `server/` or `client/src/`.
- **which appears legacy**: LIKELY archive/extracted/legacy/prototype paths.
- **business risk**: drift between active and shadow logic.
- **recommended action**: route-level parity test before retirement.
- **confidence**: LIKELY

## 55. `discrepancycard`
- **exact files**: `DiscrepancyCard.tsx`, `client/src/components/DiscrepancyCard.tsx`
- **exact routes/endpoints**: See `docs/audit/route-inventory.csv` for mounted route paths from these modules.
- **what overlaps**: Same module basename appears in multiple trees.
- **which appears primary**: LIKELY active tree under `server/` or `client/src/`.
- **which appears legacy**: LIKELY archive/extracted/legacy/prototype paths.
- **business risk**: drift between active and shadow logic.
- **recommended action**: route-level parity test before retirement.
- **confidence**: LIKELY

## 56. `drawer`
- **exact files**: `client/src/components/ui/drawer.tsx`, `extracted_dashboard/Restaurant-Hub/client/src/components/ui/drawer.tsx`
- **exact routes/endpoints**: See `docs/audit/route-inventory.csv` for mounted route paths from these modules.
- **what overlaps**: Same module basename appears in multiple trees.
- **which appears primary**: LIKELY active tree under `server/` or `client/src/`.
- **which appears legacy**: LIKELY archive/extracted/legacy/prototype paths.
- **business risk**: drift between active and shadow logic.
- **recommended action**: route-level parity test before retirement.
- **confidence**: LIKELY

## 57. `drinksledger`
- **exact files**: `server/routes/drinksLedger.ts`, `server/services/drinksLedger.ts`
- **exact routes/endpoints**: See `docs/audit/route-inventory.csv` for mounted route paths from these modules.
- **what overlaps**: Same module basename appears in multiple trees.
- **which appears primary**: LIKELY active tree under `server/` or `client/src/`.
- **which appears legacy**: LIKELY archive/extracted/legacy/prototype paths.
- **business risk**: drift between active and shadow logic.
- **recommended action**: route-level parity test before retirement.
- **confidence**: LIKELY

## 58. `drizzle.config`
- **exact files**: `drizzle.config.ts`, `extracted_dashboard/Restaurant-Hub/drizzle.config.ts`, `loyverse-ai-updated-package/drizzle.config.ts`
- **exact routes/endpoints**: See `docs/audit/route-inventory.csv` for mounted route paths from these modules.
- **what overlaps**: Same module basename appears in multiple trees.
- **which appears primary**: LIKELY active tree under `server/` or `client/src/`.
- **which appears legacy**: LIKELY archive/extracted/legacy/prototype paths.
- **business risk**: drift between active and shadow logic.
- **recommended action**: route-level parity test before retirement.
- **confidence**: LIKELY

## 59. `dropdown-menu`
- **exact files**: `client/src/components/ui/dropdown-menu.tsx`, `extracted_dashboard/Restaurant-Hub/client/src/components/ui/dropdown-menu.tsx`
- **exact routes/endpoints**: See `docs/audit/route-inventory.csv` for mounted route paths from these modules.
- **what overlaps**: Same module basename appears in multiple trees.
- **which appears primary**: LIKELY active tree under `server/` or `client/src/`.
- **which appears legacy**: LIKELY archive/extracted/legacy/prototype paths.
- **business risk**: drift between active and shadow logic.
- **recommended action**: route-level parity test before retirement.
- **confidence**: LIKELY

## 60. `email`
- **exact files**: `archive/_legacy/routes.ts_legacy_dir/lib/email.ts`, `archive/_legacy/routes.ts_legacy_dir/services/email.ts`, `server/lib/email.ts`, `server/services/email.ts`
- **exact routes/endpoints**: See `docs/audit/route-inventory.csv` for mounted route paths from these modules.
- **what overlaps**: Same module basename appears in multiple trees.
- **which appears primary**: LIKELY active tree under `server/` or `client/src/`.
- **which appears legacy**: LIKELY archive/extracted/legacy/prototype paths.
- **business risk**: drift between active and shadow logic.
- **recommended action**: route-level parity test before retirement.
- **confidence**: LIKELY

## 61. `emailservice`
- **exact files**: `archive/_legacy/routes.ts_legacy_dir/services/emailService.ts`, `archive/_legacy/routes.ts_legacy_dir/services/jussi/emailService.js`, `exports/services/emailService.ts`, `extracted_dashboard/Restaurant-Hub/server/emailService.ts`, `server/services/emailService.ts`, `server/services/jussi/emailService.js`
- **exact routes/endpoints**: See `docs/audit/route-inventory.csv` for mounted route paths from these modules.
- **what overlaps**: Same module basename appears in multiple trees.
- **which appears primary**: LIKELY active tree under `server/` or `client/src/`.
- **which appears legacy**: LIKELY archive/extracted/legacy/prototype paths.
- **business risk**: drift between active and shadow logic.
- **recommended action**: route-level parity test before retirement.
- **confidence**: LIKELY

## 62. `emailtemplate`
- **exact files**: `archive/_legacy/routes.ts_legacy_dir/services/emailTemplate.ts`, `exports/services/emailTemplate.ts`, `server/services/emailTemplate.ts`
- **exact routes/endpoints**: See `docs/audit/route-inventory.csv` for mounted route paths from these modules.
- **what overlaps**: Same module basename appears in multiple trees.
- **which appears primary**: LIKELY active tree under `server/` or `client/src/`.
- **which appears legacy**: LIKELY archive/extracted/legacy/prototype paths.
- **business risk**: drift between active and shadow logic.
- **recommended action**: route-level parity test before retirement.
- **confidence**: LIKELY

## 63. `enhancedexpenses`
- **exact files**: `client/src/pages/EnhancedExpenses.tsx`, `extracted_dashboard/Restaurant-Hub/client/src/pages/EnhancedExpenses.tsx`
- **exact routes/endpoints**: See `docs/audit/route-inventory.csv` for mounted route paths from these modules.
- **what overlaps**: Same module basename appears in multiple trees.
- **which appears primary**: LIKELY active tree under `server/` or `client/src/`.
- **which appears legacy**: LIKELY archive/extracted/legacy/prototype paths.
- **business risk**: drift between active and shadow logic.
- **recommended action**: route-level parity test before retirement.
- **confidence**: LIKELY

## 64. `enhancedloyverseapi`
- **exact files**: `archive/_legacy/routes.ts_legacy_dir/services/enhancedLoyverseAPI.ts`, `exports/services/enhancedLoyverseAPI.ts`, `loyverse-ai-updated-package/server/services/enhancedLoyverseAPI.ts`, `server/services/enhancedLoyverseAPI.ts`
- **exact routes/endpoints**: See `docs/audit/route-inventory.csv` for mounted route paths from these modules.
- **what overlaps**: Same module basename appears in multiple trees.
- **which appears primary**: LIKELY active tree under `server/` or `client/src/`.
- **which appears legacy**: LIKELY archive/extracted/legacy/prototype paths.
- **business risk**: drift between active and shadow logic.
- **recommended action**: route-level parity test before retirement.
- **confidence**: LIKELY

## 65. `ensureshift`
- **exact files**: `server/routes/ensureShift.ts`, `server/services/ensureShift.ts`
- **exact routes/endpoints**: See `docs/audit/route-inventory.csv` for mounted route paths from these modules.
- **what overlaps**: Same module basename appears in multiple trees.
- **which appears primary**: LIKELY active tree under `server/` or `client/src/`.
- **which appears legacy**: LIKELY archive/extracted/legacy/prototype paths.
- **business risk**: drift between active and shadow logic.
- **recommended action**: route-level parity test before retirement.
- **confidence**: LIKELY

## 66. `errorguard`
- **exact files**: `archive/_legacy/routes.ts_legacy_dir/middleware/errorGuard.ts`, `server/middleware/errorGuard.ts`
- **exact routes/endpoints**: See `docs/audit/route-inventory.csv` for mounted route paths from these modules.
- **what overlaps**: Same module basename appears in multiple trees.
- **which appears primary**: LIKELY active tree under `server/` or `client/src/`.
- **which appears legacy**: LIKELY archive/extracted/legacy/prototype paths.
- **business risk**: drift between active and shadow logic.
- **recommended action**: route-level parity test before retirement.
- **confidence**: LIKELY

## 67. `expensecategorizationengine`
- **exact files**: `archive/_legacy/routes.ts_legacy_dir/services/expenseCategorizationEngine.ts`, `server/services/expenseCategorizationEngine.ts`
- **exact routes/endpoints**: See `docs/audit/route-inventory.csv` for mounted route paths from these modules.
- **what overlaps**: Same module basename appears in multiple trees.
- **which appears primary**: LIKELY active tree under `server/` or `client/src/`.
- **which appears legacy**: LIKELY archive/extracted/legacy/prototype paths.
- **business risk**: drift between active and shadow logic.
- **recommended action**: route-level parity test before retirement.
- **confidence**: LIKELY

## 68. `expenseimports`
- **exact files**: `archive/_legacy/routes.ts_legacy_dir/api/expenseImports.ts`, `server/api/expenseImports.ts`
- **exact routes/endpoints**: See `docs/audit/route-inventory.csv` for mounted route paths from these modules.
- **what overlaps**: Same module basename appears in multiple trees.
- **which appears primary**: LIKELY active tree under `server/` or `client/src/`.
- **which appears legacy**: LIKELY archive/extracted/legacy/prototype paths.
- **business risk**: drift between active and shadow logic.
- **recommended action**: route-level parity test before retirement.
- **confidence**: LIKELY

## 69. `expensemappings`
- **exact files**: `server/config/expenseMappings.ts`, `shared/expenseMappings.ts`
- **exact routes/endpoints**: See `docs/audit/route-inventory.csv` for mounted route paths from these modules.
- **what overlaps**: Same module basename appears in multiple trees.
- **which appears primary**: LIKELY active tree under `server/` or `client/src/`.
- **which appears legacy**: LIKELY archive/extracted/legacy/prototype paths.
- **business risk**: drift between active and shadow logic.
- **recommended action**: route-level parity test before retirement.
- **confidence**: LIKELY

## 70. `expenses`
- **exact files**: `archive/_legacy/routes.ts_legacy_dir/routes/expenses.ts`, `client/src/pages/Expenses.tsx`, `extracted_dashboard/Restaurant-Hub/client/src/pages/Expenses.tsx`, `server/routes/expenses.ts`
- **exact routes/endpoints**: See `docs/audit/route-inventory.csv` for mounted route paths from these modules.
- **what overlaps**: Same module basename appears in multiple trees.
- **which appears primary**: LIKELY active tree under `server/` or `client/src/`.
- **which appears legacy**: LIKELY archive/extracted/legacy/prototype paths.
- **business risk**: drift between active and shadow logic.
- **recommended action**: route-level parity test before retirement.
- **confidence**: LIKELY

## 71. `expensesimport`
- **exact files**: `client/src/pages/finance/ExpensesImport.tsx`, `src/pages/finance/ExpensesImport.tsx`
- **exact routes/endpoints**: See `docs/audit/route-inventory.csv` for mounted route paths from these modules.
- **what overlaps**: Same module basename appears in multiple trees.
- **which appears primary**: LIKELY active tree under `server/` or `client/src/`.
- **which appears legacy**: LIKELY archive/extracted/legacy/prototype paths.
- **business risk**: drift between active and shadow logic.
- **recommended action**: route-level parity test before retirement.
- **confidence**: LIKELY

## 72. `expensesmerged`
- **exact files**: `client/src/pages/ExpensesMerged.tsx`, `extracted_dashboard/Restaurant-Hub/client/src/pages/ExpensesMerged.tsx`
- **exact routes/endpoints**: See `docs/audit/route-inventory.csv` for mounted route paths from these modules.
- **what overlaps**: Same module basename appears in multiple trees.
- **which appears primary**: LIKELY active tree under `server/` or `client/src/`.
- **which appears legacy**: LIKELY archive/extracted/legacy/prototype paths.
- **business risk**: drift between active and shadow logic.
- **recommended action**: route-level parity test before retirement.
- **confidence**: LIKELY

## 73. `expensesv2`
- **exact files**: `archive/_legacy/routes.ts_legacy_dir/routes/expensesV2.ts`, `client/src/pages/expenses/ExpensesV2.tsx`
- **exact routes/endpoints**: See `docs/audit/route-inventory.csv` for mounted route paths from these modules.
- **what overlaps**: Same module basename appears in multiple trees.
- **which appears primary**: LIKELY active tree under `server/` or `client/src/`.
- **which appears legacy**: LIKELY archive/extracted/legacy/prototype paths.
- **business risk**: drift between active and shadow logic.
- **recommended action**: route-level parity test before retirement.
- **confidence**: LIKELY

## 74. `finance`
- **exact files**: `archive/_legacy/routes.ts_legacy_dir/api/finance.ts`, `client/src/pages/Finance.tsx`, `extracted_dashboard/Restaurant-Hub/client/src/pages/Finance.tsx`, `server/api/finance.ts`, `server/routes/finance.ts`
- **exact routes/endpoints**: See `docs/audit/route-inventory.csv` for mounted route paths from these modules.
- **what overlaps**: Same module basename appears in multiple trees.
- **which appears primary**: LIKELY active tree under `server/` or `client/src/`.
- **which appears legacy**: LIKELY archive/extracted/legacy/prototype paths.
- **business risk**: drift between active and shadow logic.
- **recommended action**: route-level parity test before retirement.
- **confidence**: LIKELY

## 75. `fix-schema`
- **exact files**: `archive/_legacy/routes.ts_legacy_dir/migrations/fix-schema.js`, `server/migrations/fix-schema.js`
- **exact routes/endpoints**: See `docs/audit/route-inventory.csv` for mounted route paths from these modules.
- **what overlaps**: Same module basename appears in multiple trees.
- **which appears primary**: LIKELY active tree under `server/` or `client/src/`.
- **which appears legacy**: LIKELY archive/extracted/legacy/prototype paths.
- **business risk**: drift between active and shadow logic.
- **recommended action**: route-level parity test before retirement.
- **confidence**: LIKELY

## 76. `form`
- **exact files**: `client/src/components/ui/form.tsx`, `client/src/pages/operations/daily-sales/Form.tsx`, `extracted_dashboard/Restaurant-Hub/client/src/components/ui/form.tsx`
- **exact routes/endpoints**: See `docs/audit/route-inventory.csv` for mounted route paths from these modules.
- **what overlaps**: Same module basename appears in multiple trees.
- **which appears primary**: LIKELY active tree under `server/` or `client/src/`.
- **which appears legacy**: LIKELY archive/extracted/legacy/prototype paths.
- **business risk**: drift between active and shadow logic.
- **recommended action**: route-level parity test before retirement.
- **confidence**: LIKELY

## 77. `forms`
- **exact files**: `archive/_legacy/routes.ts_legacy_dir/api/forms.ts`, `archive/_legacy/routes.ts_legacy_dir/routes/forms.ts`, `server/api/forms.ts`, `server/routes/forms.ts`
- **exact routes/endpoints**: See `docs/audit/route-inventory.csv` for mounted route paths from these modules.
- **what overlaps**: Same module basename appears in multiple trees.
- **which appears primary**: LIKELY active tree under `server/` or `client/src/`.
- **which appears legacy**: LIKELY archive/extracted/legacy/prototype paths.
- **business risk**: drift between active and shadow logic.
- **recommended action**: route-level parity test before retirement.
- **confidence**: LIKELY

## 78. `formvalidator`
- **exact files**: `archive/_legacy/routes.ts_legacy_dir/utils/formValidator.ts`, `server/utils/formValidator.ts`
- **exact routes/endpoints**: See `docs/audit/route-inventory.csv` for mounted route paths from these modules.
- **what overlaps**: Same module basename appears in multiple trees.
- **which appears primary**: LIKELY active tree under `server/` or `client/src/`.
- **which appears legacy**: LIKELY archive/extracted/legacy/prototype paths.
- **business risk**: drift between active and shadow logic.
- **recommended action**: route-level parity test before retirement.
- **confidence**: LIKELY

## 79. `generatedailysummary`
- **exact files**: `archive/_legacy/routes.ts_legacy_dir/services/jussi/generateDailySummary.js`, `server/services/jussi/generateDailySummary.js`
- **exact routes/endpoints**: See `docs/audit/route-inventory.csv` for mounted route paths from these modules.
- **what overlaps**: Same module basename appears in multiple trees.
- **which appears primary**: LIKELY active tree under `server/` or `client/src/`.
- **which appears legacy**: LIKELY archive/extracted/legacy/prototype paths.
- **business risk**: drift between active and shadow logic.
- **recommended action**: route-level parity test before retirement.
- **confidence**: LIKELY

## 80. `gmailservice`
- **exact files**: `archive/_legacy/routes.ts_legacy_dir/services/gmailService.ts`, `exports/services/gmailService.ts`, `extracted_dashboard/Restaurant-Hub/server/gmailService.ts`, `server/services/gmailService.ts`
- **exact routes/endpoints**: See `docs/audit/route-inventory.csv` for mounted route paths from these modules.
- **what overlaps**: Same module basename appears in multiple trees.
- **which appears primary**: LIKELY active tree under `server/` or `client/src/`.
- **which appears legacy**: LIKELY archive/extracted/legacy/prototype paths.
- **business risk**: drift between active and shadow logic.
- **recommended action**: route-level parity test before retirement.
- **confidence**: LIKELY

## 81. `googleoauthemailservice`
- **exact files**: `archive/_legacy/routes.ts_legacy_dir/services/googleOAuthEmailService.ts`, `server/services/googleOAuthEmailService.ts`
- **exact routes/endpoints**: See `docs/audit/route-inventory.csv` for mounted route paths from these modules.
- **what overlaps**: Same module basename appears in multiple trees.
- **which appears primary**: LIKELY active tree under `server/` or `client/src/`.
- **which appears legacy**: LIKELY archive/extracted/legacy/prototype paths.
- **business risk**: drift between active and shadow logic.
- **recommended action**: route-level parity test before retirement.
- **confidence**: LIKELY

## 82. `googlesheetsservice`
- **exact files**: `archive/_legacy/routes.ts_legacy_dir/services/googleSheetsService.ts`, `exports/services/googleSheetsService.ts`, `extracted_dashboard/Restaurant-Hub/server/googleSheetsService.ts`, `server/services/googleSheetsService.ts`
- **exact routes/endpoints**: See `docs/audit/route-inventory.csv` for mounted route paths from these modules.
- **what overlaps**: Same module basename appears in multiple trees.
- **which appears primary**: LIKELY active tree under `server/` or `client/src/`.
- **which appears legacy**: LIKELY archive/extracted/legacy/prototype paths.
- **business risk**: drift between active and shadow logic.
- **recommended action**: route-level parity test before retirement.
- **confidence**: LIKELY

## 83. `gptutils`
- **exact files**: `archive/_legacy/routes.ts_legacy_dir/utils/gptUtils.ts`, `server/utils/gptUtils.ts`
- **exact routes/endpoints**: See `docs/audit/route-inventory.csv` for mounted route paths from these modules.
- **what overlaps**: Same module basename appears in multiple trees.
- **which appears primary**: LIKELY active tree under `server/` or `client/src/`.
- **which appears legacy**: LIKELY archive/extracted/legacy/prototype paths.
- **business risk**: drift between active and shadow logic.
- **recommended action**: route-level parity test before retirement.
- **confidence**: LIKELY

## 84. `history`
- **exact files**: `client/src/pages/operations/shopping-list/history.tsx`, `client/src/pages/reports/shift-report/history.tsx`
- **exact routes/endpoints**: See `docs/audit/route-inventory.csv` for mounted route paths from these modules.
- **what overlaps**: Same module basename appears in multiple trees.
- **which appears primary**: LIKELY active tree under `server/` or `client/src/`.
- **which appears legacy**: LIKELY archive/extracted/legacy/prototype paths.
- **business risk**: drift between active and shadow logic.
- **recommended action**: route-level parity test before retirement.
- **confidence**: LIKELY

## 85. `hover-card`
- **exact files**: `client/src/components/ui/hover-card.tsx`, `extracted_dashboard/Restaurant-Hub/client/src/components/ui/hover-card.tsx`
- **exact routes/endpoints**: See `docs/audit/route-inventory.csv` for mounted route paths from these modules.
- **what overlaps**: Same module basename appears in multiple trees.
- **which appears primary**: LIKELY active tree under `server/` or `client/src/`.
- **which appears legacy**: LIKELY archive/extracted/legacy/prototype paths.
- **business risk**: drift between active and shadow logic.
- **recommended action**: route-level parity test before retirement.
- **confidence**: LIKELY

## 86. `importhistoricaldata`
- **exact files**: `archive/_legacy/routes.ts_legacy_dir/importHistoricalData.ts`, `extracted_dashboard/Restaurant-Hub/server/importHistoricalData.ts`, `server/importHistoricalData.ts`
- **exact routes/endpoints**: See `docs/audit/route-inventory.csv` for mounted route paths from these modules.
- **what overlaps**: Same module basename appears in multiple trees.
- **which appears primary**: LIKELY active tree under `server/` or `client/src/`.
- **which appears legacy**: LIKELY archive/extracted/legacy/prototype paths.
- **business risk**: drift between active and shadow logic.
- **recommended action**: route-level parity test before retirement.
- **confidence**: LIKELY

## 87. `importingredientcosts`
- **exact files**: `archive/_legacy/routes.ts_legacy_dir/importIngredientCosts.ts`, `extracted_dashboard/Restaurant-Hub/server/importIngredientCosts.ts`, `server/importIngredientCosts.ts`
- **exact routes/endpoints**: See `docs/audit/route-inventory.csv` for mounted route paths from these modules.
- **what overlaps**: Same module basename appears in multiple trees.
- **which appears primary**: LIKELY active tree under `server/` or `client/src/`.
- **which appears legacy**: LIKELY archive/extracted/legacy/prototype paths.
- **business risk**: drift between active and shadow logic.
- **recommended action**: route-level parity test before retirement.
- **confidence**: LIKELY

## 88. `importloyverseshifts`
- **exact files**: `archive/_legacy/routes.ts_legacy_dir/importLoyverseShifts.ts`, `extracted_dashboard/Restaurant-Hub/server/importLoyverseShifts.ts`, `server/importLoyverseShifts.ts`
- **exact routes/endpoints**: See `docs/audit/route-inventory.csv` for mounted route paths from these modules.
- **what overlaps**: Same module basename appears in multiple trees.
- **which appears primary**: LIKELY active tree under `server/` or `client/src/`.
- **which appears legacy**: LIKELY archive/extracted/legacy/prototype paths.
- **business risk**: drift between active and shadow logic.
- **recommended action**: route-level parity test before retirement.
- **confidence**: LIKELY

## 89. `imports`
- **exact files**: `archive/_legacy/routes.ts_legacy_dir/routes/imports.ts`, `server/routes/imports.ts`
- **exact routes/endpoints**: See `docs/audit/route-inventory.csv` for mounted route paths from these modules.
- **what overlaps**: Same module basename appears in multiple trees.
- **which appears primary**: LIKELY active tree under `server/` or `client/src/`.
- **which appears legacy**: LIKELY archive/extracted/legacy/prototype paths.
- **business risk**: drift between active and shadow logic.
- **recommended action**: route-level parity test before retirement.
- **confidence**: LIKELY

## 90. `ingester`
- **exact files**: `archive/_legacy/routes.ts_legacy_dir/services/pos-ingestion/ingester.js`, `server/services/pos-ingestion/ingester.js`
- **exact routes/endpoints**: See `docs/audit/route-inventory.csv` for mounted route paths from these modules.
- **what overlaps**: Same module basename appears in multiple trees.
- **which appears primary**: LIKELY active tree under `server/` or `client/src/`.
- **which appears legacy**: LIKELY archive/extracted/legacy/prototype paths.
- **business risk**: drift between active and shadow logic.
- **recommended action**: route-level parity test before retirement.
- **confidence**: LIKELY

## 91. `ingredientauthority`
- **exact files**: `client/src/pages/admin/IngredientAuthority.tsx`, `client/src/utils/ingredientAuthority.ts`, `server/lib/ingredientAuthority.ts`, `server/routes/admin/ingredientAuthority.ts`, `server/routes/ingredientAuthority.ts`
- **exact routes/endpoints**: See `docs/audit/route-inventory.csv` for mounted route paths from these modules.
- **what overlaps**: Same module basename appears in multiple trees.
- **which appears primary**: LIKELY active tree under `server/` or `client/src/`.
- **which appears legacy**: LIKELY archive/extracted/legacy/prototype paths.
- **business risk**: drift between active and shadow logic.
- **recommended action**: route-level parity test before retirement.
- **confidence**: LIKELY

## 92. `ingredientmanagement`
- **exact files**: `client/src/pages/IngredientManagement.tsx`, `client/src/pages/menu/IngredientManagement.tsx`, `extracted_dashboard/Restaurant-Hub/client/src/pages/IngredientManagement.tsx`
- **exact routes/endpoints**: See `docs/audit/route-inventory.csv` for mounted route paths from these modules.
- **what overlaps**: Same module basename appears in multiple trees.
- **which appears primary**: LIKELY active tree under `server/` or `client/src/`.
- **which appears legacy**: LIKELY archive/extracted/legacy/prototype paths.
- **business risk**: drift between active and shadow logic.
- **recommended action**: route-level parity test before retirement.
- **confidence**: LIKELY

## 93. `ingredients`
- **exact files**: `client/src/pages/Ingredients.tsx`, `server/forms/ingredients.ts`, `server/routes/ingredients.ts`
- **exact routes/endpoints**: See `docs/audit/route-inventory.csv` for mounted route paths from these modules.
- **what overlaps**: Same module basename appears in multiple trees.
- **which appears primary**: LIKELY active tree under `server/` or `client/src/`.
- **which appears legacy**: LIKELY archive/extracted/legacy/prototype paths.
- **business risk**: drift between active and shadow logic.
- **recommended action**: route-level parity test before retirement.
- **confidence**: LIKELY

## 94. `ingredients-import`
- **exact files**: `archive/_legacy/routes.ts_legacy_dir/api/ingredients-import.ts`, `server/api/ingredients-import.ts`
- **exact routes/endpoints**: See `docs/audit/route-inventory.csv` for mounted route paths from these modules.
- **what overlaps**: Same module basename appears in multiple trees.
- **which appears primary**: LIKELY active tree under `server/` or `client/src/`.
- **which appears legacy**: LIKELY archive/extracted/legacy/prototype paths.
- **business risk**: drift between active and shadow logic.
- **recommended action**: route-level parity test before retirement.
- **confidence**: LIKELY

## 95. `input`
- **exact files**: `client/src/components/ui/input.tsx`, `extracted_dashboard/Restaurant-Hub/client/src/components/ui/input.tsx`
- **exact routes/endpoints**: See `docs/audit/route-inventory.csv` for mounted route paths from these modules.
- **what overlaps**: Same module basename appears in multiple trees.
- **which appears primary**: LIKELY active tree under `server/` or `client/src/`.
- **which appears legacy**: LIKELY archive/extracted/legacy/prototype paths.
- **business risk**: drift between active and shadow logic.
- **recommended action**: route-level parity test before retirement.
- **confidence**: LIKELY

## 96. `input-otp`
- **exact files**: `client/src/components/ui/input-otp.tsx`, `extracted_dashboard/Restaurant-Hub/client/src/components/ui/input-otp.tsx`
- **exact routes/endpoints**: See `docs/audit/route-inventory.csv` for mounted route paths from these modules.
- **what overlaps**: Same module basename appears in multiple trees.
- **which appears primary**: LIKELY active tree under `server/` or `client/src/`.
- **which appears legacy**: LIKELY archive/extracted/legacy/prototype paths.
- **business risk**: drift between active and shadow logic.
- **recommended action**: route-level parity test before retirement.
- **confidence**: LIKELY

## 97. `issueregister`
- **exact files**: `client/src/pages/operations/IssueRegister.tsx`, `server/routes/issueRegister.ts`
- **exact routes/endpoints**: See `docs/audit/route-inventory.csv` for mounted route paths from these modules.
- **what overlaps**: Same module basename appears in multiple trees.
- **which appears primary**: LIKELY active tree under `server/` or `client/src/`.
- **which appears legacy**: LIKELY archive/extracted/legacy/prototype paths.
- **business risk**: drift between active and shadow logic.
- **recommended action**: route-level parity test before retirement.
- **confidence**: LIKELY

## 98. `jussi`
- **exact files**: `archive/_legacy/routes.ts_legacy_dir/agents/jussi.ts`, `server/agents/jussi.ts`
- **exact routes/endpoints**: See `docs/audit/route-inventory.csv` for mounted route paths from these modules.
- **what overlaps**: Same module basename appears in multiple trees.
- **which appears primary**: LIKELY active tree under `server/` or `client/src/`.
- **which appears legacy**: LIKELY archive/extracted/legacy/prototype paths.
- **business risk**: drift between active and shadow logic.
- **recommended action**: route-level parity test before retirement.
- **confidence**: LIKELY

## 99. `jussichatbubble`
- **exact files**: `client/src/components/JussiChatBubble.tsx`, `loyverse-ai-package/client/src/components/JussiChatBubble.tsx`, `loyverse-ai-updated-package/client/src/components/JussiChatBubble.tsx`
- **exact routes/endpoints**: See `docs/audit/route-inventory.csv` for mounted route paths from these modules.
- **what overlaps**: Same module basename appears in multiple trees.
- **which appears primary**: LIKELY active tree under `server/` or `client/src/`.
- **which appears legacy**: LIKELY archive/extracted/legacy/prototype paths.
- **business risk**: drift between active and shadow logic.
- **recommended action**: route-level parity test before retirement.
- **confidence**: LIKELY

## 100. `jussidailysummaryservice`
- **exact files**: `archive/_legacy/routes.ts_legacy_dir/services/jussiDailySummaryService.ts`, `loyverse-ai-package/server/services/jussiDailySummaryService.ts`, `loyverse-ai-updated-package/server/services/jussiDailySummaryService.ts`, `server/services/jussiDailySummaryService.ts`
- **exact routes/endpoints**: See `docs/audit/route-inventory.csv` for mounted route paths from these modules.
- **what overlaps**: Same module basename appears in multiple trees.
- **which appears primary**: LIKELY active tree under `server/` or `client/src/`.
- **which appears legacy**: LIKELY archive/extracted/legacy/prototype paths.
- **business risk**: drift between active and shadow logic.
- **recommended action**: route-level parity test before retirement.
- **confidence**: LIKELY

## 101. `jussilatestshiftservice`
- **exact files**: `archive/_legacy/routes.ts_legacy_dir/services/jussiLatestShiftService.ts`, `loyverse-ai-package/server/services/jussiLatestShiftService.ts`, `loyverse-ai-updated-package/server/services/jussiLatestShiftService.ts`, `server/services/jussiLatestShiftService.ts`
- **exact routes/endpoints**: See `docs/audit/route-inventory.csv` for mounted route paths from these modules.
- **what overlaps**: Same module basename appears in multiple trees.
- **which appears primary**: LIKELY active tree under `server/` or `client/src/`.
- **which appears legacy**: LIKELY archive/extracted/legacy/prototype paths.
- **business risk**: drift between active and shadow logic.
- **recommended action**: route-level parity test before retirement.
- **confidence**: LIKELY

## 102. `jussishiftsummarizer`
- **exact files**: `archive/_legacy/routes.ts_legacy_dir/services/jussiShiftSummarizer.ts`, `loyverse-ai-package/server/services/jussiShiftSummarizer.ts`, `loyverse-ai-updated-package/server/services/jussiShiftSummarizer.ts`, `server/services/jussiShiftSummarizer.ts`
- **exact routes/endpoints**: See `docs/audit/route-inventory.csv` for mounted route paths from these modules.
- **what overlaps**: Same module basename appears in multiple trees.
- **which appears primary**: LIKELY active tree under `server/` or `client/src/`.
- **which appears legacy**: LIKELY archive/extracted/legacy/prototype paths.
- **business risk**: drift between active and shadow logic.
- **recommended action**: route-level parity test before retirement.
- **confidence**: LIKELY

## 103. `kds`
- **exact files**: `client/src/components/KDS.tsx`, `client/src/pages/kds/KDS.tsx`
- **exact routes/endpoints**: See `docs/audit/route-inventory.csv` for mounted route paths from these modules.
- **what overlaps**: Same module basename appears in multiple trees.
- **which appears primary**: LIKELY active tree under `server/` or `client/src/`.
- **which appears legacy**: LIKELY archive/extracted/legacy/prototype paths.
- **business risk**: drift between active and shadow logic.
- **recommended action**: route-level parity test before retirement.
- **confidence**: LIKELY

## 104. `kpicard`
- **exact files**: `client/src/components/KPICard.tsx`, `extracted_dashboard/Restaurant-Hub/client/src/components/KPICard.tsx`
- **exact routes/endpoints**: See `docs/audit/route-inventory.csv` for mounted route paths from these modules.
- **what overlaps**: Same module basename appears in multiple trees.
- **which appears primary**: LIKELY active tree under `server/` or `client/src/`.
- **which appears legacy**: LIKELY archive/extracted/legacy/prototype paths.
- **business risk**: drift between active and shadow logic.
- **recommended action**: route-level parity test before retirement.
- **confidence**: LIKELY

## 105. `label`
- **exact files**: `client/src/components/ui/label.tsx`, `extracted_dashboard/Restaurant-Hub/client/src/components/ui/label.tsx`
- **exact routes/endpoints**: See `docs/audit/route-inventory.csv` for mounted route paths from these modules.
- **what overlaps**: Same module basename appears in multiple trees.
- **which appears primary**: LIKELY active tree under `server/` or `client/src/`.
- **which appears legacy**: LIKELY archive/extracted/legacy/prototype paths.
- **business risk**: drift between active and shadow logic.
- **recommended action**: route-level parity test before retirement.
- **confidence**: LIKELY

## 106. `layout`
- **exact files**: `client/src/app/layout.tsx`, `extracted_dashboard/Restaurant-Hub/client/src/components/Layout.tsx`
- **exact routes/endpoints**: See `docs/audit/route-inventory.csv` for mounted route paths from these modules.
- **what overlaps**: Same module basename appears in multiple trees.
- **which appears primary**: LIKELY active tree under `server/` or `client/src/`.
- **which appears legacy**: LIKELY archive/extracted/legacy/prototype paths.
- **business risk**: drift between active and shadow logic.
- **recommended action**: route-level parity test before retirement.
- **confidence**: LIKELY

## 107. `library`
- **exact files**: `client/src/pages/operations/daily-sales-v2/Library.tsx`, `client/src/pages/operations/daily-sales/Library.tsx`
- **exact routes/endpoints**: See `docs/audit/route-inventory.csv` for mounted route paths from these modules.
- **what overlaps**: Same module basename appears in multiple trees.
- **which appears primary**: LIKELY active tree under `server/` or `client/src/`.
- **which appears legacy**: LIKELY archive/extracted/legacy/prototype paths.
- **business risk**: drift between active and shadow logic.
- **recommended action**: route-level parity test before retirement.
- **confidence**: LIKELY

## 108. `livereceiptservice`
- **exact files**: `archive/_legacy/routes.ts_legacy_dir/services/liveReceiptService.ts`, `loyverse-ai-package/server/services/liveReceiptService.ts`, `loyverse-ai-updated-package/server/services/liveReceiptService.ts`, `server/services/liveReceiptService.ts`
- **exact routes/endpoints**: See `docs/audit/route-inventory.csv` for mounted route paths from these modules.
- **what overlaps**: Same module basename appears in multiple trees.
- **which appears primary**: LIKELY active tree under `server/` or `client/src/`.
- **which appears legacy**: LIKELY archive/extracted/legacy/prototype paths.
- **business risk**: drift between active and shadow logic.
- **recommended action**: route-level parity test before retirement.
- **confidence**: LIKELY

## 109. `loadfoodcostings`
- **exact files**: `archive/_legacy/routes.ts_legacy_dir/utils/loadFoodCostings.ts`, `server/utils/loadFoodCostings.ts`
- **exact routes/endpoints**: See `docs/audit/route-inventory.csv` for mounted route paths from these modules.
- **what overlaps**: Same module basename appears in multiple trees.
- **which appears primary**: LIKELY active tree under `server/` or `client/src/`.
- **which appears legacy**: LIKELY archive/extracted/legacy/prototype paths.
- **business risk**: drift between active and shadow logic.
- **recommended action**: route-level parity test before retirement.
- **confidence**: LIKELY

## 110. `loyverse`
- **exact files**: `archive/_legacy/routes.ts_legacy_dir/services/loyverse.ts`, `archive/_legacy/routes.ts_legacy_dir/services/pos-ingestion/loyverse.js`, `exports/services/loyverse.ts`, `extracted_dashboard/Restaurant-Hub/server/services/loyverse.ts`, `loyverse-ai-updated-package/server/services/loyverse.ts`, `server/services/loyverse.ts`, `server/services/pos-ingestion/loyverse.js`, `server/utils/loyverse.js`, `server/utils/loyverse.ts`
- **exact routes/endpoints**: See `docs/audit/route-inventory.csv` for mounted route paths from these modules.
- **what overlaps**: Same module basename appears in multiple trees.
- **which appears primary**: LIKELY active tree under `server/` or `client/src/`.
- **which appears legacy**: LIKELY archive/extracted/legacy/prototype paths.
- **business risk**: drift between active and shadow logic.
- **recommended action**: route-level parity test before retirement.
- **confidence**: LIKELY

## 111. `loyverseapi`
- **exact files**: `archive/_legacy/routes.ts_legacy_dir/loyverseAPI.ts`, `extracted_dashboard/Restaurant-Hub/server/loyverseAPI.ts`, `server/loyverseAPI.ts`
- **exact routes/endpoints**: See `docs/audit/route-inventory.csv` for mounted route paths from these modules.
- **what overlaps**: Same module basename appears in multiple trees.
- **which appears primary**: LIKELY active tree under `server/` or `client/src/`.
- **which appears legacy**: LIKELY archive/extracted/legacy/prototype paths.
- **business risk**: drift between active and shadow logic.
- **recommended action**: route-level parity test before retirement.
- **confidence**: LIKELY

## 112. `loyverseapi_old`
- **exact files**: `archive/_legacy/routes.ts_legacy_dir/loyverseAPI_old.ts`, `extracted_dashboard/Restaurant-Hub/server/loyverseAPI_old.ts`, `server/loyverseAPI_old.ts`
- **exact routes/endpoints**: See `docs/audit/route-inventory.csv` for mounted route paths from these modules.
- **what overlaps**: Same module basename appears in multiple trees.
- **which appears primary**: LIKELY active tree under `server/` or `client/src/`.
- **which appears legacy**: LIKELY archive/extracted/legacy/prototype paths.
- **business risk**: drift between active and shadow logic.
- **recommended action**: route-level parity test before retirement.
- **confidence**: LIKELY

## 113. `loyverseconnectionstatus`
- **exact files**: `client/src/components/LoyverseConnectionStatus.tsx`, `extracted_dashboard/Restaurant-Hub/client/src/components/LoyverseConnectionStatus.tsx`, `loyverse-ai-package/client/src/components/LoyverseConnectionStatus.tsx`
- **exact routes/endpoints**: See `docs/audit/route-inventory.csv` for mounted route paths from these modules.
- **what overlaps**: Same module basename appears in multiple trees.
- **which appears primary**: LIKELY active tree under `server/` or `client/src/`.
- **which appears legacy**: LIKELY archive/extracted/legacy/prototype paths.
- **business risk**: drift between active and shadow logic.
- **recommended action**: route-level parity test before retirement.
- **confidence**: LIKELY

## 114. `loyversedataorchestrator`
- **exact files**: `archive/_legacy/routes.ts_legacy_dir/services/loyverseDataOrchestrator.ts`, `exports/services/loyverseDataOrchestrator.ts`, `focused-export/loyverseDataOrchestrator.ts`, `loyverse-ai-package/server/services/loyverseDataOrchestrator.ts`, `loyverse-ai-updated-package/server/services/loyverseDataOrchestrator.ts`, `server/services/loyverseDataOrchestrator.ts`
- **exact routes/endpoints**: See `docs/audit/route-inventory.csv` for mounted route paths from these modules.
- **what overlaps**: Same module basename appears in multiple trees.
- **which appears primary**: LIKELY active tree under `server/` or `client/src/`.
- **which appears legacy**: LIKELY archive/extracted/legacy/prototype paths.
- **business risk**: drift between active and shadow logic.
- **recommended action**: route-level parity test before retirement.
- **confidence**: LIKELY

## 115. `loyversedatavalidator`
- **exact files**: `archive/_legacy/routes.ts_legacy_dir/services/loyverseDataValidator.ts`, `exports/services/loyverseDataValidator.ts`, `loyverse-ai-updated-package/server/services/loyverseDataValidator.ts`, `server/services/loyverseDataValidator.ts`
- **exact routes/endpoints**: See `docs/audit/route-inventory.csv` for mounted route paths from these modules.
- **what overlaps**: Same module basename appears in multiple trees.
- **which appears primary**: LIKELY active tree under `server/` or `client/src/`.
- **which appears legacy**: LIKELY archive/extracted/legacy/prototype paths.
- **business risk**: drift between active and shadow logic.
- **recommended action**: route-level parity test before retirement.
- **confidence**: LIKELY

## 116. `loyverseenhanced`
- **exact files**: `archive/_legacy/routes.ts_legacy_dir/routes/loyverseEnhanced.ts`, `server/routes/loyverseEnhanced.ts`
- **exact routes/endpoints**: See `docs/audit/route-inventory.csv` for mounted route paths from these modules.
- **what overlaps**: Same module basename appears in multiple trees.
- **which appears primary**: LIKELY active tree under `server/` or `client/src/`.
- **which appears legacy**: LIKELY archive/extracted/legacy/prototype paths.
- **business risk**: drift between active and shadow logic.
- **recommended action**: route-level parity test before retirement.
- **confidence**: LIKELY

## 117. `loyverselive`
- **exact files**: `client/src/archive/LoyverseLive.tsx`, `extracted_dashboard/Restaurant-Hub/client/src/pages/LoyverseLive.tsx`, `loyverse-ai-package/client/src/pages/LoyverseLive.tsx`
- **exact routes/endpoints**: See `docs/audit/route-inventory.csv` for mounted route paths from these modules.
- **what overlaps**: Same module basename appears in multiple trees.
- **which appears primary**: LIKELY active tree under `server/` or `client/src/`.
- **which appears legacy**: LIKELY archive/extracted/legacy/prototype paths.
- **business risk**: drift between active and shadow logic.
- **recommended action**: route-level parity test before retirement.
- **confidence**: LIKELY

## 118. `loyverseparsers`
- **exact files**: `archive/_legacy/routes.ts_legacy_dir/services/loyverseParsers.ts`, `server/services/loyverseParsers.ts`
- **exact routes/endpoints**: See `docs/audit/route-inventory.csv` for mounted route paths from these modules.
- **what overlaps**: Same module basename appears in multiple trees.
- **which appears primary**: LIKELY active tree under `server/` or `client/src/`.
- **which appears legacy**: LIKELY archive/extracted/legacy/prototype paths.
- **business risk**: drift between active and shadow logic.
- **recommended action**: route-level parity test before retirement.
- **confidence**: LIKELY

## 119. `loyversereceipts`
- **exact files**: `archive/_legacy/routes.ts_legacy_dir/services/loyverseReceipts.ts`, `exports/services/loyverseReceipts.ts`, `extracted_dashboard/Restaurant-Hub/server/services/loyverseReceipts.ts`, `loyverse-ai-package/server/services/loyverseReceipts.ts`, `loyverse-ai-updated-package/server/services/loyverseReceipts.ts`, `server/services/loyverseReceipts.ts`
- **exact routes/endpoints**: See `docs/audit/route-inventory.csv` for mounted route paths from these modules.
- **what overlaps**: Same module basename appears in multiple trees.
- **which appears primary**: LIKELY active tree under `server/` or `client/src/`.
- **which appears legacy**: LIKELY archive/extracted/legacy/prototype paths.
- **business risk**: drift between active and shadow logic.
- **recommended action**: route-level parity test before retirement.
- **confidence**: LIKELY

## 120. `main`
- **exact files**: `client/src/main.tsx`, `extracted_dashboard/Restaurant-Hub/client/src/main.tsx`, `online-ordering/client/src/main.tsx`
- **exact routes/endpoints**: See `docs/audit/route-inventory.csv` for mounted route paths from these modules.
- **what overlaps**: Same module basename appears in multiple trees.
- **which appears primary**: LIKELY active tree under `server/` or `client/src/`.
- **which appears legacy**: LIKELY archive/extracted/legacy/prototype paths.
- **business risk**: drift between active and shadow logic.
- **recommended action**: route-level parity test before retirement.
- **confidence**: LIKELY

## 121. `managerchecklist`
- **exact files**: `archive/_legacy/routes.ts_legacy_dir/managerChecklist.ts`, `server/managerChecklist.ts`
- **exact routes/endpoints**: See `docs/audit/route-inventory.csv` for mounted route paths from these modules.
- **what overlaps**: Same module basename appears in multiple trees.
- **which appears primary**: LIKELY active tree under `server/` or `client/src/`.
- **which appears legacy**: LIKELY archive/extracted/legacy/prototype paths.
- **business risk**: drift between active and shadow logic.
- **recommended action**: route-level parity test before retirement.
- **confidence**: LIKELY

## 122. `marlo`
- **exact files**: `archive/_legacy/routes.ts_legacy_dir/agents/marlo.ts`, `server/agents/marlo.ts`
- **exact routes/endpoints**: See `docs/audit/route-inventory.csv` for mounted route paths from these modules.
- **what overlaps**: Same module basename appears in multiple trees.
- **which appears primary**: LIKELY active tree under `server/` or `client/src/`.
- **which appears legacy**: LIKELY archive/extracted/legacy/prototype paths.
- **business risk**: drift between active and shadow logic.
- **recommended action**: route-level parity test before retirement.
- **confidence**: LIKELY

## 123. `meatledger`
- **exact files**: `server/routes/meatLedger.ts`, `server/services/meatLedger.ts`
- **exact routes/endpoints**: See `docs/audit/route-inventory.csv` for mounted route paths from these modules.
- **what overlaps**: Same module basename appears in multiple trees.
- **which appears primary**: LIKELY active tree under `server/` or `client/src/`.
- **which appears legacy**: LIKELY archive/extracted/legacy/prototype paths.
- **business risk**: drift between active and shadow logic.
- **recommended action**: route-level parity test before retirement.
- **confidence**: LIKELY

## 124. `menu`
- **exact files**: `archive/_legacy/routes.ts_legacy_dir/routes/menu.ts`, `server/routes/menu.ts`
- **exact routes/endpoints**: See `docs/audit/route-inventory.csv` for mounted route paths from these modules.
- **what overlaps**: Same module basename appears in multiple trees.
- **which appears primary**: LIKELY active tree under `server/` or `client/src/`.
- **which appears legacy**: LIKELY archive/extracted/legacy/prototype paths.
- **business risk**: drift between active and shadow logic.
- **recommended action**: route-level parity test before retirement.
- **confidence**: LIKELY

## 125. `menuadmin`
- **exact files**: `client/src/pages/marketing/MenuAdmin.tsx`, `client/src/pages/menuV3/MenuAdmin.tsx`
- **exact routes/endpoints**: See `docs/audit/route-inventory.csv` for mounted route paths from these modules.
- **what overlaps**: Same module basename appears in multiple trees.
- **which appears primary**: LIKELY active tree under `server/` or `client/src/`.
- **which appears legacy**: LIKELY archive/extracted/legacy/prototype paths.
- **business risk**: drift between active and shadow logic.
- **recommended action**: route-level parity test before retirement.
- **confidence**: LIKELY

## 126. `menubar`
- **exact files**: `client/src/components/ui/menubar.tsx`, `extracted_dashboard/Restaurant-Hub/client/src/components/ui/menubar.tsx`
- **exact routes/endpoints**: See `docs/audit/route-inventory.csv` for mounted route paths from these modules.
- **what overlaps**: Same module basename appears in multiple trees.
- **which appears primary**: LIKELY active tree under `server/` or `client/src/`.
- **which appears legacy**: LIKELY archive/extracted/legacy/prototype paths.
- **business risk**: drift between active and shadow logic.
- **recommended action**: route-level parity test before retirement.
- **confidence**: LIKELY

## 127. `menumanagement`
- **exact files**: `client/src/pages/menu/MenuManagement.tsx`, `server/routes/menuManagement.ts`
- **exact routes/endpoints**: See `docs/audit/route-inventory.csv` for mounted route paths from these modules.
- **what overlaps**: Same module basename appears in multiple trees.
- **which appears primary**: LIKELY active tree under `server/` or `client/src/`.
- **which appears legacy**: LIKELY archive/extracted/legacy/prototype paths.
- **business risk**: drift between active and shadow logic.
- **recommended action**: route-level parity test before retirement.
- **confidence**: LIKELY

## 128. `monthlyexpenseschart`
- **exact files**: `client/src/components/MonthlyExpensesChart.tsx`, `extracted_dashboard/Restaurant-Hub/client/src/components/MonthlyExpensesChart.tsx`
- **exact routes/endpoints**: See `docs/audit/route-inventory.csv` for mounted route paths from these modules.
- **what overlaps**: Same module basename appears in multiple trees.
- **which appears primary**: LIKELY active tree under `server/` or `client/src/`.
- **which appears legacy**: LIKELY archive/extracted/legacy/prototype paths.
- **business risk**: drift between active and shadow logic.
- **recommended action**: route-level parity test before retirement.
- **confidence**: LIKELY

## 129. `navigation-menu`
- **exact files**: `client/src/components/ui/navigation-menu.tsx`, `extracted_dashboard/Restaurant-Hub/client/src/components/ui/navigation-menu.tsx`
- **exact routes/endpoints**: See `docs/audit/route-inventory.csv` for mounted route paths from these modules.
- **what overlaps**: Same module basename appears in multiple trees.
- **which appears primary**: LIKELY active tree under `server/` or `client/src/`.
- **which appears legacy**: LIKELY archive/extracted/legacy/prototype paths.
- **business risk**: drift between active and shadow logic.
- **recommended action**: route-level parity test before retirement.
- **confidence**: LIKELY

## 130. `nightlychecklist`
- **exact files**: `client/src/pages/NightlyChecklist.tsx`, `client/src/pages/managers/NightlyChecklist.tsx`
- **exact routes/endpoints**: See `docs/audit/route-inventory.csv` for mounted route paths from these modules.
- **what overlaps**: Same module basename appears in multiple trees.
- **which appears primary**: LIKELY active tree under `server/` or `client/src/`.
- **which appears legacy**: LIKELY archive/extracted/legacy/prototype paths.
- **business risk**: drift between active and shadow logic.
- **recommended action**: route-level parity test before retirement.
- **confidence**: LIKELY

## 131. `normalizer`
- **exact files**: `archive/_legacy/routes.ts_legacy_dir/services/pos-ingestion/normalizer.js`, `server/services/pos-ingestion/normalizer.js`
- **exact routes/endpoints**: See `docs/audit/route-inventory.csv` for mounted route paths from these modules.
- **what overlaps**: Same module basename appears in multiple trees.
- **which appears primary**: LIKELY active tree under `server/` or `client/src/`.
- **which appears legacy**: LIKELY archive/extracted/legacy/prototype paths.
- **business risk**: drift between active and shadow logic.
- **recommended action**: route-level parity test before retirement.
- **confidence**: LIKELY

## 132. `not-found`
- **exact files**: `client/src/pages/not-found.tsx`, `extracted_dashboard/Restaurant-Hub/client/src/pages/not-found.tsx`
- **exact routes/endpoints**: See `docs/audit/route-inventory.csv` for mounted route paths from these modules.
- **what overlaps**: Same module basename appears in multiple trees.
- **which appears primary**: LIKELY active tree under `server/` or `client/src/`.
- **which appears legacy**: LIKELY archive/extracted/legacy/prototype paths.
- **business risk**: drift between active and shadow logic.
- **recommended action**: route-level parity test before retirement.
- **confidence**: LIKELY

## 133. `objectstorage`
- **exact files**: `archive/_legacy/routes.ts_legacy_dir/objectStorage.ts`, `server/objectStorage.ts`
- **exact routes/endpoints**: See `docs/audit/route-inventory.csv` for mounted route paths from these modules.
- **what overlaps**: Same module basename appears in multiple trees.
- **which appears primary**: LIKELY active tree under `server/` or `client/src/`.
- **which appears legacy**: LIKELY archive/extracted/legacy/prototype paths.
- **business risk**: drift between active and shadow logic.
- **recommended action**: route-level parity test before retirement.
- **confidence**: LIKELY

## 134. `ollie`
- **exact files**: `archive/_legacy/routes.ts_legacy_dir/agents/ollie.ts`, `server/agents/ollie.ts`
- **exact routes/endpoints**: See `docs/audit/route-inventory.csv` for mounted route paths from these modules.
- **what overlaps**: Same module basename appears in multiple trees.
- **which appears primary**: LIKELY active tree under `server/` or `client/src/`.
- **which appears legacy**: LIKELY archive/extracted/legacy/prototype paths.
- **business risk**: drift between active and shadow logic.
- **recommended action**: route-level parity test before retirement.
- **confidence**: LIKELY

## 135. `openai`
- **exact files**: `archive/_legacy/routes.ts_legacy_dir/openai.ts`, `extracted_dashboard/Restaurant-Hub/server/openai.ts`, `server/openai.ts`
- **exact routes/endpoints**: See `docs/audit/route-inventory.csv` for mounted route paths from these modules.
- **what overlaps**: Same module basename appears in multiple trees.
- **which appears primary**: LIKELY active tree under `server/` or `client/src/`.
- **which appears legacy**: LIKELY archive/extracted/legacy/prototype paths.
- **business risk**: drift between active and shadow logic.
- **recommended action**: route-level parity test before retirement.
- **confidence**: LIKELY

## 136. `pageshell`
- **exact files**: `client/src/components/PageShell.tsx`, `client/src/layouts/PageShell.tsx`
- **exact routes/endpoints**: See `docs/audit/route-inventory.csv` for mounted route paths from these modules.
- **what overlaps**: Same module basename appears in multiple trees.
- **which appears primary**: LIKELY active tree under `server/` or `client/src/`.
- **which appears legacy**: LIKELY archive/extracted/legacy/prototype paths.
- **business risk**: drift between active and shadow logic.
- **recommended action**: route-level parity test before retirement.
- **confidence**: LIKELY

## 137. `pagination`
- **exact files**: `client/src/components/ui/pagination.tsx`, `extracted_dashboard/Restaurant-Hub/client/src/components/ui/pagination.tsx`
- **exact routes/endpoints**: See `docs/audit/route-inventory.csv` for mounted route paths from these modules.
- **what overlaps**: Same module basename appears in multiple trees.
- **which appears primary**: LIKELY active tree under `server/` or `client/src/`.
- **which appears legacy**: LIKELY archive/extracted/legacy/prototype paths.
- **business risk**: drift between active and shadow logic.
- **recommended action**: route-level parity test before retirement.
- **confidence**: LIKELY

## 138. `pdf`
- **exact files**: `archive/_legacy/routes.ts_legacy_dir/lib/pdf.ts`, `archive/_legacy/routes.ts_legacy_dir/services/pdf.ts`, `server/lib/pdf.ts`, `server/routes/healthSafety/pdf.ts`, `server/services/pdf.ts`, `src/server/pdf.ts`
- **exact routes/endpoints**: See `docs/audit/route-inventory.csv` for mounted route paths from these modules.
- **what overlaps**: Same module basename appears in multiple trees.
- **which appears primary**: LIKELY active tree under `server/` or `client/src/`.
- **which appears legacy**: LIKELY archive/extracted/legacy/prototype paths.
- **business risk**: drift between active and shadow logic.
- **recommended action**: route-level parity test before retirement.
- **confidence**: LIKELY

## 139. `popover`
- **exact files**: `client/src/components/ui/popover.tsx`, `extracted_dashboard/Restaurant-Hub/client/src/components/ui/popover.tsx`
- **exact routes/endpoints**: See `docs/audit/route-inventory.csv` for mounted route paths from these modules.
- **what overlaps**: Same module basename appears in multiple trees.
- **which appears primary**: LIKELY active tree under `server/` or `client/src/`.
- **which appears legacy**: LIKELY archive/extracted/legacy/prototype paths.
- **business risk**: drift between active and shadow logic.
- **recommended action**: route-level parity test before retirement.
- **confidence**: LIKELY

## 140. `posanalysis`
- **exact files**: `archive/_legacy/routes.ts_legacy_dir/routes/posAnalysis.ts`, `server/routes/posAnalysis.ts`
- **exact routes/endpoints**: See `docs/audit/route-inventory.csv` for mounted route paths from these modules.
- **what overlaps**: Same module basename appears in multiple trees.
- **which appears primary**: LIKELY active tree under `server/` or `client/src/`.
- **which appears legacy**: LIKELY archive/extracted/legacy/prototype paths.
- **business risk**: drift between active and shadow logic.
- **recommended action**: route-level parity test before retirement.
- **confidence**: LIKELY

