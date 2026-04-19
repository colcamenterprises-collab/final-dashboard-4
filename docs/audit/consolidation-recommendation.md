# Consolidation Recommendation (Final Sweep Refresh)

1. Use `server/index.ts` + `server/routes.ts` as runtime route truth anchors before any cleanup implementation.
2. Keep Bob read plane fixed to `/api/bob/read/*` with GET-only + token authorization, and preserve blocker-first responses for missing data.
3. Treat the protected keep register as hard-stop scope exclusion for Cleanup PR #1.
4. Sequence cleanup by documentation and ownership normalization first; runtime behavior changes only after explicit validation plan execution.
5. Prioritize high-ambiguity families for later controlled cleanup waves:
   - shopping list families
   - analysis families
   - menu/order/product families
   - finance/expenses overlapping modules
6. Preserve daily readiness and reporting jobs untouched until runtime smoke checks pass in staging.
