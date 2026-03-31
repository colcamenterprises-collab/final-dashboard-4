# Env Vars / Secrets / Config Map

| Env var | Requirement status | First callsites |
|---|---|---|
| ADMIN_TOKEN | required-by-feature (see callsites) | server/middleware/requireAdmin.ts:11; server/middleware/requireAdmin.ts:15 |
| AGENT_READONLY | required-by-feature (see callsites) | attached_assets/readonly_1755065107303.ts:6; attached_assets/prismaWriteBlock_1755065107302.ts:7; archive/_legacy/routes.ts_legacy_dir/routes.ts:1489; archive/_legacy/routes.ts_legacy_dir/middleware/readonly.ts:6; server/routes.ts:2682 |
| ALERT_EMAIL_TO | required-by-feature (see callsites) | workers/analysis.ts:86 |
| APP_BASE_URL | required-by-feature (see callsites) | server/scripts/daily_readiness_check.js:10; server/services/shiftReportEmail.ts:107 |
| BASE_URL | required-by-feature (see callsites) | PATCH_V3_1_TIDY.sh:158; PATCH_FIX_AND_SMOKE_20251011.sh:180; RUN_SMOKE_V3.sh:15; scripts/v3_1_sanity.mjs:1; scripts/smoke_v3_strict.mjs:1 |
| BLOCK_LEGACY_INGREDIENTS | required-by-feature (see callsites) | server/middleware/blockLegacyIngredients.ts:3 |
| BOBS_LOYVERSE_TOKEN | required-by-feature (see callsites) | server/index.ts:137; server/routes/aiOpsControl.ts:2449; server/routes/aiOpsControl.ts:2566; server/routes/aiOpsControl.ts:2612 |
| BOBS_LOYVERSE_WRITE_TOKEN | required-by-feature (see callsites) | server/routes/aiOpsControl.ts:2694 |
| BOB_API_BASE_URL | required-by-feature (see callsites) | server/routes/aiOpsControl.ts:2411 |
| BOB_BASE_URL | required-by-feature (see callsites) | server/scripts/daily_readiness_check.js:10 |
| BOB_READONLY_TOKEN | required-by-feature (see callsites) | server/index.ts:136; server/scripts/daily_readiness_check.js:11; server/routes/bobRead.ts:112; server/routes/aiOpsControl.ts:937; server/routes/aiOpsControl.ts:2448 |
| BOB_WRITE_TOKEN | required-by-feature (see callsites) | server/routes/aiOpsControl.ts:2694 |
| BURGER_SOURCE | required-by-feature (see callsites) | server/services/burgerMetrics.ts:7 |
| CATALOG_PATH | required-by-feature (see callsites) | server/scripts/catalog_import_from_file.ts:10 |
| DAILY_REPORT_TO | required-by-feature (see callsites) | archive/_legacy/routes.ts_legacy_dir/services/jussi/emailService.js:223; archive/_legacy/routes.ts_legacy_dir/services/jussi/runJussiDaily.js:107; server/services/jussi/emailService.js:223; server/services/jussi/runJussiDaily.js:107 |
| DATABASE_URL | required-by-feature (see callsites) | PATCH_V3_1_TIDY.sh:39; PATCH_V4_0_STOCK_REVIEW_LEDGER.sh:40; PATCH_STOCK_REVIEW_V1.sh:18; PATCH_STOCK_REVIEW_V1.sh:370; complete_debug_files.md:21 |
| DEFAULT_MENU_CATEGORY | required-by-feature (see callsites) | server/services/menuService.ts:44 |
| DEFAULT_MENU_PRICE | required-by-feature (see callsites) | server/services/menuService.ts:45 |
| DRINKS_WASTE_ALLOWANCE | required-by-feature (see callsites) | server/services/drinksLedger.ts:10 |
| EMAIL_FROM | required-by-feature (see callsites) | archive/_legacy/routes.ts_legacy_dir/services/jussi/emailService.js:224; archive/_legacy/routes.ts_legacy_dir/services/jussi/runJussiDaily.js:24; server/services/jussi/emailService.js:224; server/services/jussi/runJussiDaily.js:24 |
| EMAIL_TO_MANAGEMENT | required-by-feature (see callsites) | server/services/cronEmailService.ts:183 |
| ENABLE_DANGEROUS_TOOLS | required-by-feature (see callsites) | server/services/powerToolGuard.ts:7 |
| ENABLE_DEBUG_ROUTES | required-by-feature (see callsites) | PATCH_FIX_AND_SMOKE_20251011.sh:135 |
| EXPORT_KEY | required-by-feature (see callsites) | server/routes/exportRoutes.ts:8 |
| FROM_DATE | required-by-feature (see callsites) | server/scripts/buildSaleCanonicalAuthority.ts:12 |
| GEMINI_API_KEY | required-by-feature (see callsites) | extracted_dashboard/Restaurant-Hub/server/services/ai.ts:10; exports/services/ai.ts:10; archive/_legacy/routes.ts_legacy_dir/services/ai.ts:10; server/services/ai.ts:10 |
| GEMINI_API_KEY_ENV_VAR | required-by-feature (see callsites) | extracted_dashboard/Restaurant-Hub/server/services/ai.ts:10; exports/services/ai.ts:10; archive/_legacy/routes.ts_legacy_dir/services/ai.ts:10; server/services/ai.ts:10 |
| GH_CSV | required-by-feature (see callsites) | server/scripts/golden_validate_vs_csv.ts:9 |
| GH_DAY | required-by-feature (see callsites) | server/scripts/golden_validate_vs_csv.ts:8; server/scripts/golden_rebuild_day.ts:4; server/scripts/golden_smoke_day.ts:4 |
| GIT_COMMIT | required-by-feature (see callsites) | server/routes/bobRead.ts:195 |
| GMAIL_APP_PASSWORD | required-by-feature (see callsites) | DAILY_SALES_STOCK_ARCHITECTURE_REPORT.md:620; extracted_dashboard/Restaurant-Hub/server/emailService.ts:29; archive/_legacy/routes.ts_legacy_dir/routes.ts:1821; archive/_legacy/routes.ts_legacy_dir/api/forms.ts:123; archive/_legacy/routes.ts_legacy_dir/services/salesEmail.ts:18 |
| GMAIL_PASS | required-by-feature (see callsites) | archive/_legacy/routes.ts_legacy_dir/services/email.ts:5; server/services/email.ts:132 |
| GMAIL_USER | required-by-feature (see callsites) | DAILY_SALES_STOCK_ARCHITECTURE_REPORT.md:620; extracted_dashboard/Restaurant-Hub/server/emailService.ts:28; extracted_dashboard/Restaurant-Hub/server/emailService.ts:340; extracted_dashboard/Restaurant-Hub/server/emailService.ts:341; src/server/report.ts:92 |
| GOOGLE_CLIENT_ID | required-by-feature (see callsites) | extracted_dashboard/Restaurant-Hub/server/googleSheetsService.ts:22; extracted_dashboard/Restaurant-Hub/server/googleSheetsService.ts:29; extracted_dashboard/Restaurant-Hub/server/gmailService.ts:28; extracted_dashboard/Restaurant-Hub/server/emailService.ts:302; exports/services/googleSheetsService.ts:22 |
| GOOGLE_CLIENT_SECRET | required-by-feature (see callsites) | extracted_dashboard/Restaurant-Hub/server/googleSheetsService.ts:22; extracted_dashboard/Restaurant-Hub/server/googleSheetsService.ts:30; extracted_dashboard/Restaurant-Hub/server/gmailService.ts:29; exports/services/googleSheetsService.ts:22; exports/services/googleSheetsService.ts:30 |
| GOOGLE_EMAIL | required-by-feature (see callsites) | extracted_dashboard/Restaurant-Hub/server/emailService.ts:28; extracted_dashboard/Restaurant-Hub/server/emailService.ts:340; extracted_dashboard/Restaurant-Hub/server/emailService.ts:341; archive/_legacy/routes.ts_legacy_dir/services/emailService.ts:22; server/services/emailService.ts:22 |
| GOOGLE_PASSWORD | required-by-feature (see callsites) | extracted_dashboard/Restaurant-Hub/server/emailService.ts:29; archive/_legacy/routes.ts_legacy_dir/services/emailService.ts:24; server/services/emailService.ts:24 |
| GOOGLE_REFRESH_TOKEN | required-by-feature (see callsites) | extracted_dashboard/Restaurant-Hub/server/googleSheetsService.ts:22; extracted_dashboard/Restaurant-Hub/server/googleSheetsService.ts:35; extracted_dashboard/Restaurant-Hub/server/gmailService.ts:30; exports/services/googleSheetsService.ts:22; exports/services/googleSheetsService.ts:35 |
| GOOGLE_SHEETS_ID | required-by-feature (see callsites) | extracted_dashboard/Restaurant-Hub/server/googleSheetsService.ts:16; exports/services/googleSheetsService.ts:16; archive/_legacy/routes.ts_legacy_dir/services/googleSheetsService.ts:16; server/services/googleSheetsService.ts:16 |
| GOOGLE_USER_EMAIL | required-by-feature (see callsites) | archive/_legacy/routes.ts_legacy_dir/services/googleOAuthEmailService.ts:36; archive/_legacy/routes.ts_legacy_dir/services/googleOAuthEmailService.ts:57; archive/_legacy/routes.ts_legacy_dir/services/googleOAuthEmailService.ts:58; server/services/googleOAuthEmailService.ts:36; server/services/googleOAuthEmailService.ts:57 |
| GRAB_ORDERING_API | required-by-feature (see callsites) | server/services/menuService.ts:92 |
| JWT_SECRET | required-by-feature (see callsites) | server/services/auth/authService.ts:5 |
| LEGACY_API_PROXY | required-by-feature (see callsites) | server/middleware/legacyProxies.ts:4 |
| LINE_BAKERY_TARGET_ID | required-by-feature (see callsites) | server/services/rollOrderService.ts:16 |
| LINE_CHANNEL_ACCESS_TOKEN | required-by-feature (see callsites) | server/services/rollOrderService.ts:17 |
| LINE_NOTIFY_TOKEN | required-by-feature (see callsites) | server/routes/lineNotify.ts:6 |
| LINE_TOKEN | required-by-feature (see callsites) | archive/_legacy/routes.ts_legacy_dir/services/aiAnalysisService.ts:10; server/services/aiAnalysisService.ts:10 |
| LOYVERSE_ACCESS_TOKEN | required-by-feature (see callsites) | extracted_dashboard/Restaurant-Hub/server/services/loyverseReceipts.ts:57; extracted_dashboard/Restaurant-Hub/server/services/loyverse.ts:33; exports/services/loyverseReceipts.ts:58; exports/services/loyverse.ts:33; exports/services/loyverseDataOrchestrator.ts:51 |
| LOYVERSE_API_KEY | required-by-feature (see callsites) | server/services/loyversePush.ts:6 |
| LOYVERSE_API_TOKEN | required-by-feature (see callsites) | extracted_dashboard/Restaurant-Hub/server/webhooks.ts:175; extracted_dashboard/Restaurant-Hub/server/webhooks.ts:224; archive/_legacy/routes.ts_legacy_dir/webhooks.ts:177; archive/_legacy/routes.ts_legacy_dir/webhooks.ts:226; archive/_legacy/routes.ts_legacy_dir/services/scheduler.js:46 |
| LOYVERSE_BASE_URL | required-by-feature (see callsites) | archive/_legacy/routes.ts_legacy_dir/services/pos-ingestion/loyverse.js:7; archive/_legacy/routes.ts_legacy_dir/routes/posLive.ts:6; archive/_legacy/routes.ts_legacy_dir/routes/posItems.ts:5; server/services/pos-ingestion/loyverse.js:7; server/routes/posLive.ts:6 |
| LOYVERSE_CLIENT_ID | required-by-feature (see callsites) | archive/_legacy/loyverse-ai-updated-package/server/routes/routes.ts:977; loyverse-ai-updated-package/server/routes.ts:977 |
| LOYVERSE_CLIENT_SECRET | required-by-feature (see callsites) | archive/_legacy/loyverse-ai-updated-package/server/routes/routes.ts:978; loyverse-ai-updated-package/server/routes.ts:978 |
| LOYVERSE_STORE_ID | required-by-feature (see callsites) | exports/services/loyverseReceipts.ts:132; exports/services/loyverseReceipts.ts:875; loyverse-ai-package/server/services/loyverseReceipts.ts:144; loyverse-ai-package/server/services/loyverseReceipts.ts:933; archive/_legacy/routes.ts_legacy_dir/services/loyverseReceipts.ts:144 |
| LOYVERSE_TOKEN | required-by-feature (see callsites) | server/routes.ts:648; server/routes.ts:709; server/routes.ts:4767; server/utils/loyverse.ts:4; server/utils/loyverse.js:4 |
| LOYVERSE_WEBHOOK_SECRET | required-by-feature (see callsites) | extracted_dashboard/Restaurant-Hub/server/webhooks.ts:40; archive/_legacy/routes.ts_legacy_dir/webhooks.ts:39; archive/_legacy/debug_files/routes.ts:1983; archive/_legacy/loyverse-ai-updated-package/server/routes/routes.ts:2168; server/webhooks.ts:54 |
| MANAGEMENT_EMAIL | required-by-feature (see callsites) | extracted_dashboard/Restaurant-Hub/server/emailService.ts:341; archive/_legacy/routes.ts_legacy_dir/services/googleOAuthEmailService.ts:58; server/services/googleOAuthEmailService.ts:58 |
| MEAT_GRAMS_PER_PATTY | required-by-feature (see callsites) | server/services/stockConstants.ts:1 |
| MEAT_WASTE_ALLOWANCE | required-by-feature (see callsites) | server/services/meatLedger.ts:22 |
| MM_CSV | required-by-feature (see callsites) | server/scripts/mm_reconcile_day.ts:22 |
| MM_DAY | required-by-feature (see callsites) | server/scripts/mm_reconcile_day.ts:21 |
| MOCK_RECIPE_DATA | required-by-feature (see callsites) | server/routes/recipes.ts:256 |
| NEXT_PUBLIC_EXPENSES_SHEET_CSV_URL | required-by-feature (see callsites) | attached_assets/page_1755065107301.tsx:41 |
| NODE_ENV | required-by-feature (see callsites) | vite.config.ts:10; extracted_dashboard/Restaurant-Hub/vite.config.ts:10; lib/prisma.ts:9; archive/_legacy/routes.ts_legacy_dir/middleware/errorGuard.ts:14; server/routes.ts:887 |
| ONLINE_ORDERING_API | required-by-feature (see callsites) | server/services/menuService.ts:69 |
| OPENAI_API_KEY | required-by-feature (see callsites) | extracted_dashboard/Restaurant-Hub/server/routes.ts:1112; extracted_dashboard/Restaurant-Hub/server/openai.ts:11; extracted_dashboard/Restaurant-Hub/server/services/ai.ts:6; exports/services/ai.ts:6; exports/services/aiAnalysisService.ts:83 |
| OPENAI_API_KEY_ENV_VAR | required-by-feature (see callsites) | extracted_dashboard/Restaurant-Hub/server/services/ai.ts:6; exports/services/ai.ts:6; archive/_legacy/routes.ts_legacy_dir/services/ai.ts:6 |
| OPENCLAW_BASE_URL | required-by-feature (see callsites) | server/routes/aiOpsControl.ts:479; server/routes/aiOpsControl.ts:545; server/routes/aiOpsControl.ts:751; server/routes/aiOpsControl.ts:904 |
| OPENCLAW_DEVICE_ID | required-by-feature (see callsites) | server/routes/aiOpsControl.ts:118 |
| OPENCLAW_DEVICE_PRIVATE_KEY | required-by-feature (see callsites) | server/routes/aiOpsControl.ts:119 |
| OPENCLAW_GATEWAY_TOKEN | required-by-feature (see callsites) | server/routes/aiOpsControl.ts:546; server/routes/aiOpsControl.ts:751; server/routes/aiOpsControl.ts:904 |
| PATH | required-by-feature (see callsites) | server/services/bobWorkspace.ts:213 |
| PORT | required-by-feature (see callsites) | online-ordering/server/index.js:66; server/index.ts:546; server/index.ts:662; server/routes/aiOpsControl.ts:1386 |
| PRIVATE_OBJECT_DIR | required-by-feature (see callsites) | archive/_legacy/routes.ts_legacy_dir/objectStorage.ts:60; server/objectStorage.ts:60 |
| PRODUCTION_LOCK | required-by-feature (see callsites) | server/utils/productionGuard.ts:2; server/routes/systemHealth.ts:36; server/routes/purchasingItems.ts:148; server/routes/purchasingItems.ts:188 |
| PROMPTPAY_ID | required-by-feature (see callsites) | server/routes/qrRoutes.ts:13 |
| PUBLIC_BASE_URL | required-by-feature (see callsites) | server/jobs/cron.ts:24 |
| PUBLIC_OBJECT_SEARCH_PATHS | required-by-feature (see callsites) | archive/_legacy/routes.ts_legacy_dir/objectStorage.ts:40; server/objectStorage.ts:40 |
| RECEIPT_IDS | required-by-feature (see callsites) | server/scripts/buildSaleCanonicalAuthority.ts:11 |
| REPLIT_CONNECTORS_HOSTNAME | required-by-feature (see callsites) | scripts/pushToGitHub.ts:10; scripts/uploadToGoogleDrive.ts:12; server/utils/githubBackup.ts:14; server/utils/googleDriveUpload.ts:12; server/utils/githubPush.ts:12 |
| REPLIT_DEV_DOMAIN | required-by-feature (see callsites) | extracted_dashboard/Restaurant-Hub/server/webhooks.ts:181; extracted_dashboard/Restaurant-Hub/server/webhooks.ts:182; archive/_legacy/routes.ts_legacy_dir/webhooks.ts:183; archive/_legacy/routes.ts_legacy_dir/webhooks.ts:184; server/webhooks.ts:198 |
| REPLIT_GIT_COMMIT | required-by-feature (see callsites) | server/routes/bobRead.ts:195 |
| REPL_ID | required-by-feature (see callsites) | vite.config.ts:11; extracted_dashboard/Restaurant-Hub/vite.config.ts:11 |
| REPL_IDENTITY | required-by-feature (see callsites) | scripts/pushToGitHub.ts:11; scripts/pushToGitHub.ts:12; scripts/uploadToGoogleDrive.ts:13; scripts/uploadToGoogleDrive.ts:14; server/utils/githubBackup.ts:15 |
| REPORT_TIMEZONE | required-by-feature (see callsites) | workers/analysis.ts:13 |
| REPORT_TO | required-by-feature (see callsites) | src/server/report.ts:92; workers/analysis.ts:86; archive/_legacy/routes.ts_legacy_dir/services/report.ts:17; server/services/report.ts:17 |
| ROLLS_WASTE_ALLOWANCE | required-by-feature (see callsites) | server/services/rollsLedger.ts:21 |
| ROLL_ORDER_BAKERY_INCREMENT | required-by-feature (see callsites) | server/services/rollOrderService.ts:15 |
| ROLL_ORDER_TARGET_NEXT_SHIFT | required-by-feature (see callsites) | server/services/rollOrderService.ts:14 |
| SALES_SUBMIT_CC | required-by-feature (see callsites) | archive/_legacy/routes.ts_legacy_dir/services/salesEmail.ts:90; server/services/salesEmail.ts:90 |
| SBB_EMAIL_PASS | required-by-feature (see callsites) | server/lib/dailyReportEmailV2.ts:13 |
| SBB_EMAIL_USER | required-by-feature (see callsites) | server/lib/dailyReportEmailV2.ts:12; server/lib/dailyReportEmailV2.ts:69 |
| SBB_MANAGEMENT_EMAIL | required-by-feature (see callsites) | server/lib/dailyReportEmailV2.ts:70 |
| SCB_BILLER_ID | required-by-feature (see callsites) | server/config/scbConfig.ts:10 |
| SCB_CLIENT_ID | required-by-feature (see callsites) | server/config/scbConfig.ts:7 |
| SCB_CLIENT_SECRET | required-by-feature (see callsites) | server/config/scbConfig.ts:8 |
| SCB_MERCHANT_ID | required-by-feature (see callsites) | server/config/scbConfig.ts:9 |
| SCB_MODE | required-by-feature (see callsites) | server/config/scbConfig.ts:2 |
| SENDGRID_API_KEY | required-by-feature (see callsites) | extracted_dashboard/Restaurant-Hub/server/sendgridService.ts:17; extracted_dashboard/Restaurant-Hub/server/emailService.ts:314 |
| SENDGRID_FROM_EMAIL | required-by-feature (see callsites) | extracted_dashboard/Restaurant-Hub/server/sendgridService.ts:161 |
| SENDGRID_TO_EMAIL | required-by-feature (see callsites) | extracted_dashboard/Restaurant-Hub/server/sendgridService.ts:162 |
| SERVER_URL | required-by-feature (see callsites) | server/scripts/run_burger_metrics_test.ts:5; server/scripts/golden_sync_week.ts:4; server/scripts/golden_validate_vs_csv.ts:7; server/scripts/golden_rebuild_day.ts:3; server/scripts/validate_week_burgers.ts:4 |
| SHIFT_ALERT_EMAIL | required-by-feature (see callsites) | server/services/shiftReportEmail.ts:111 |
| SLOW_API_MS | required-by-feature (see callsites) | archive/_legacy/routes.ts_legacy_dir/middleware/timing.ts:9; server/middleware/timing.ts:9 |
| SMOKE_SHIFT_DATE | required-by-feature (see callsites) | server/scripts/stock_ledger_smoke.ts:47 |
| SMTP_FROM | required-by-feature (see callsites) | archive/_legacy/routes.ts_legacy_dir/lib/email.ts:8; archive/_legacy/routes.ts_legacy_dir/api/forms.ts:192; archive/_legacy/routes.ts_legacy_dir/api/forms.ts:274; server/lib/email.ts:8; server/api/forms.ts:192 |
| SMTP_HOST | required-by-feature (see callsites) | archive/_legacy/routes.ts_legacy_dir/lib/email.ts:4; archive/_legacy/routes.ts_legacy_dir/services/jussi/emailService.js:11; archive/_legacy/routes.ts_legacy_dir/services/jussi/runJussiDaily.js:11; server/lib/email.ts:4; server/services/jussi/emailService.js:11 |
| SMTP_PASS | required-by-feature (see callsites) | archive/_legacy/routes.ts_legacy_dir/lib/email.ts:7; archive/_legacy/routes.ts_legacy_dir/services/jussi/emailService.js:16; archive/_legacy/routes.ts_legacy_dir/services/jussi/runJussiDaily.js:14; server/lib/email.ts:7; server/services/jussi/emailService.js:16 |
| SMTP_PORT | required-by-feature (see callsites) | archive/_legacy/routes.ts_legacy_dir/lib/email.ts:5; archive/_legacy/routes.ts_legacy_dir/services/jussi/emailService.js:12; archive/_legacy/routes.ts_legacy_dir/services/jussi/runJussiDaily.js:12; server/lib/email.ts:5; server/services/jussi/emailService.js:12 |
| SMTP_TO | required-by-feature (see callsites) | archive/_legacy/routes.ts_legacy_dir/api/forms.ts:193; archive/_legacy/routes.ts_legacy_dir/api/forms.ts:275; server/api/forms.ts:193; server/api/forms.ts:275 |
| SMTP_USER | required-by-feature (see callsites) | archive/_legacy/routes.ts_legacy_dir/lib/email.ts:6; archive/_legacy/routes.ts_legacy_dir/api/forms.ts:192; archive/_legacy/routes.ts_legacy_dir/api/forms.ts:274; archive/_legacy/routes.ts_legacy_dir/services/jussi/emailService.js:15; archive/_legacy/routes.ts_legacy_dir/services/jussi/runJussiDaily.js:13 |
| TO_DATE | required-by-feature (see callsites) | server/scripts/buildSaleCanonicalAuthority.ts:13 |
| TZ | required-by-feature (see callsites) | archive/_legacy/routes.ts_legacy_dir/services/analytics/runProcessDaily.js:8; archive/_legacy/routes.ts_legacy_dir/services/jussi/runJussiDaily.js:7; server/services/analytics/runProcessDaily.js:8; server/services/jussi/runJussiDaily.js:7 |
| USE_GPT_SUMMARY | required-by-feature (see callsites) | archive/_legacy/routes.ts_legacy_dir/services/jussi/summaryGenerator.js:108; server/services/jussi/summaryGenerator.js:108 |
| WEB_REPL_RENEWAL | required-by-feature (see callsites) | scripts/pushToGitHub.ts:13; scripts/pushToGitHub.ts:14; scripts/uploadToGoogleDrive.ts:15; scripts/uploadToGoogleDrive.ts:16; server/utils/githubBackup.ts:17 |
| WEEK_FROM | required-by-feature (see callsites) | server/scripts/golden_sync_week.ts:5; server/scripts/validate_week_burgers.ts:31; server/scripts/golden_validate_week.ts:6 |
| WEEK_TO | required-by-feature (see callsites) | server/scripts/golden_sync_week.ts:6; server/scripts/validate_week_burgers.ts:32; server/scripts/golden_validate_week.ts:7 |
| WINDOW_MINUTES | required-by-feature (see callsites) | archive/_legacy/routes.ts_legacy_dir/services/pos-ingestion/runIncremental.js:9; server/services/pos-ingestion/runIncremental.js:9 |

No secret values are documented.
