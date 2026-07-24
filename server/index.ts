process.on('unhandledRejection', (reason, promise) => {
  console.error('🔴 UNHANDLED REJECTION at:', promise, 'reason:', reason);
});
process.on('uncaughtException', (err) => {
  console.error('🔴 UNCAUGHT EXCEPTION:', err);
});

import express, { type Request, Response, NextFunction } from "express";
import path from "path";
import { registerRoutes } from "./routes";
import { setupVite, serveStatic, log } from "./vite";
import { schedulerService } from "./services/scheduler";
import { setupWebhooks, registerWebhooks, listWebhooks } from "./webhooks";
// Fort Knox agents - simplified imports
import { db } from './db';
import { PrismaClient } from '@prisma/client';
import { autoSeedOnStartup } from './lib/seedIngredients';
import { reqId } from './middleware/reqId';
import { timing } from './middleware/timing';
import { errorGuard } from './middleware/errorGuard';
import { readonlyGuard } from './middleware/readonly';
import { installPrismaWriteBlock } from './middleware/prismaWriteBlock';
import healthRouter from "./routes/health";
import opsMtdRouter from "./routes/ops_mtd";
import purchasingRouter from "./routes/purchasing";
import purchasingItemsRouter from "./routes/purchasingItems";
import purchasingDrinksRouter from "./routes/purchasingDrinks";
import menuOnlineRouter from "./routes/menuOnline";
import imageUploadRouter from "./routes/imageUpload";
import analysisCsv from "./routes/analysisCsv";
import ensureShiftRouter from "./routes/ensureShift";
import exportRoutes from "./routes/exportRoutes";
import primeCostRouter from "./routes/primeCost";
import operationsReadRouter from "./routes/operationsRead";
import orderingRouter from "./routes/ordering";
import posRouter from "./routes/pos";

import systemHealthRoutes from "./routes/systemHealth";
import { registerDailyReportCron } from "./cron/dailyReportCron";
import { registerWeeklyRosterDistributionCron } from "./cron/weeklyRosterDistributionCron";
import { tenantContext } from "./middleware/tenantContext";
import { tenantResolver } from "./middleware/tenantResolver";
import { TenantScoped } from "./services/tenant/tenantScopedService";
import { AuthService } from "./services/auth/authService";
import authRoutes from "./routes/auth/authRoutes";
import { requireSessionAuth } from "./middleware/sessionAuth";
import providerRoutes from "./routes/payments/providerRoutes";
import paymentProcessRoutes from "./routes/payments/processRoutes";
import legacyBridgeRoutes from "./routes/legacyBridge";
import { checkPurchasingItemsSchemaGuard } from './services/purchasingItemsSchemaGuard';

// PATCH 2 — SYSTEM TRIPWIRE
// Prevent ANY module except dailyStockV2Routes from triggering shopping list generation.
(global as any).SHOPPING_LIST_ALLOWED_CALLERS = ["dailyStockV2Routes", "forms"];

const prisma = new PrismaClient();

// Temporarily disabled for development testing
// Install Prisma write blocking middleware for AGENT_READONLY mode
// installPrismaWriteBlock(prisma);

const app = express();
// Middleware stack - order matters
app.use(reqId);
app.use(timing);
app.use(express.json({ limit: '100mb' }));
app.use(express.urlencoded({ extended: false, limit: '100mb' }));
// PATCH O14 Chunk 3+4 — Tenant resolver middleware
app.use(tenantResolver);
// Temporarily disabled for development testing
// app.use(readonlyGuard);

// NUCLEAR cache control headers - most aggressive possible
app.use((req, res, next) => {
  // Nuclear cache disabling for ALL requests
  res.set('Cache-Control', 'no-cache, no-store, must-revalidate, proxy-revalidate, private, max-age=0');
  res.set('Pragma', 'no-cache');
  res.set('Expires', '-1');
  res.set('Surrogate-Control', 'no-store');
  res.set('Last-Modified', new Date().toUTCString());
  res.set('ETag', '"' + Date.now() + '-' + Math.random() + '"');
  
  // Force browsers to never cache
  res.set('X-Accel-Expires', '0');
  res.set('X-Cache-Control', 'no-cache');
  
  // Tablet-specific nuclear headers
  const userAgent = req.get('User-Agent') || '';
  const accept = req.get('Accept') || '';
  const isTablet = userAgent.includes('iPad') || 
                   userAgent.includes('Android') || 
                   userAgent.includes('Tablet') ||
                   accept.includes('text/html');
                   
  if (isTablet) {
    res.set('X-Tablet-Nuclear-Bust', Date.now().toString());
    res.set('X-Force-Reload', 'true');
    res.set('Vary', 'User-Agent, Accept');
    
    // Force no transform or optimization
    res.set('Cache-Control', 'no-cache, no-store, must-revalidate, proxy-revalidate, private, max-age=0, s-maxage=0');
  }
  
  next();
});

// Set server timeout for large uploads
app.use((req, res, next) => {
  // Set timeout to 5 minutes for large uploads
  req.setTimeout(300000); // 5 minutes
  res.setTimeout(300000); // 5 minutes
  next();
});

// Serve static files from attached_assets folder
app.use('/attached_assets', express.static(path.resolve(process.cwd(), 'attached_assets')));

// Serve uploaded files
app.use('/uploads', express.static(path.resolve(process.cwd(), 'uploads')));

// Serve tablet cache clear page
app.use('/public', express.static(path.resolve(process.cwd(), 'public')));

// PATCH O14 — Tenant context middleware (SaaS foundation)
app.use(tenantContext);

const API_PROTECTED_PREFIXES = [
  "/api/dashboard",
  "/api/operations",
  "/api/analysis",
  "/api/forms",
  "/api/reports",
  "/api/finance",
  "/api/purchasing",
  "/api/purchasing-items",
  "/api/purchasing-list",
  "/api/purchasing-field-mapping",
  "/api/purchasing-shift-log",
  "/api/purchasing-analytics",
  "/api/internal",
  "/api/partners",
];

const API_PUBLIC_PREFIXES = [
  "/api/auth",
  "/api/membership",
  "/api/menu-ordering",
  "/api/online-ordering",
  "/api/menu-online",
  "/api/online-catalog",
  "/api/health",
  "/api/system-health",
  "/api/bob/read",
  "/api/agent/read",
  "/api/ui-auth",
  "/api/ordering",
];

app.use((req, res, next) => {
  if (!req.path.startsWith("/api/")) return next();

  if (API_PUBLIC_PREFIXES.some((prefix) => req.path.startsWith(prefix))) {
    return next();
  }

  if (API_PROTECTED_PREFIXES.some((prefix) => req.path.startsWith(prefix))) {
    return requireSessionAuth(req, res, next);
  }

  return next();
});

// ── Universal bot-token middleware ───────────────────────────────────────────
// Accepts BOB_READONLY_TOKEN (or BOBS_LOYVERSE_TOKEN) via:
//   - Authorization: Bearer <token>   (preferred)
//   - X-Bot-Token: <token>            (alternative)
//   - ?token=<token>                  (query param, Bob-specific endpoints only)
// Sets res.locals.isBotRequest = true so any route can branch on bot identity.
// Does NOT block any request — purely additive.
// ─────────────────────────────────────────────────────────────────────────────
app.use((req: Request, res: Response, next: NextFunction) => {
  const t1 = process.env.BOB_READONLY_TOKEN;
  const t2 = process.env.BOBS_LOYVERSE_TOKEN;
  const valid = [t1, t2].filter(Boolean) as string[];
  if (!valid.length) return next();

  const authHeader = req.headers["authorization"];
  const xBotToken  = req.headers["x-bot-token"] as string | undefined;
  const qToken     = req.query?.token as string | undefined;

  const provided =
    (authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : undefined) ??
    xBotToken ??
    qToken;

  if (provided && valid.includes(provided)) {
    res.locals.isBotRequest = true;
    res.set("X-Bot-Identity", "verified");
  }
  next();
});


app.get("/api/system/pos-status", (req, res, next) => {
  if (res.locals.isBotRequest) return next();
  return requireSessionAuth(req, res, next);
}, async (_req, res) => {
  const hasToken = Boolean(process.env.LOYVERSE_API_TOKEN || process.env.LOYVERSE_TOKEN || process.env.BOBS_LOYVERSE_TOKEN);
  try {
    const receiptMeta = await prisma.$queryRawUnsafe<any[]>(`
      SELECT COUNT(*)::int AS count, MAX("createdAtUTC") AS latest_receipt_at, MAX("createdAt") AS latest_sync_at
      FROM receipts
    `).catch((error: any) => ({ error }));
    const shiftMeta = await prisma.$queryRawUnsafe<any[]>(`
      SELECT COUNT(*)::int AS count, MAX(shift_date) AS latest_shift_date
      FROM loyverse_shifts
    `).catch((error: any) => ({ error }));

    const receiptError = !Array.isArray(receiptMeta) ? receiptMeta.error : null;
    const shiftError = !Array.isArray(shiftMeta) ? shiftMeta.error : null;
    const receiptRow = Array.isArray(receiptMeta) ? receiptMeta[0] : null;
    const shiftRow = Array.isArray(shiftMeta) ? shiftMeta[0] : null;
    const latestReceiptDate = receiptRow?.latest_receipt_at ?? null;
    const latestShiftReportDate = shiftRow?.latest_shift_date ?? null;
    const latestSyncAt = receiptRow?.latest_sync_at ?? null;
    const connected = hasToken && Boolean(latestReceiptDate) && !receiptError;

    let failurePoint = "none";
    let minimalFixRequired = "none";
    if (!hasToken) {
      failurePoint = "no credentials";
      minimalFixRequired = "Set LOYVERSE_API_TOKEN in server environment.";
    } else if (receiptError) {
      failurePoint = "missing canonical receipt source";
      minimalFixRequired = receiptError?.message || "Verify receipts table exists and sync has run.";
    } else if (!latestReceiptDate) {
      failurePoint = "missing receipt persistence";
      minimalFixRequired = "Trigger /api/loyverse/sync and verify writes into receipts table.";
    } else if (shiftError) {
      failurePoint = "missing canonical shift source";
      minimalFixRequired = shiftError?.message || "Verify loyverse_shifts table exists.";
    } else if (!latestShiftReportDate) {
      failurePoint = "missing shift creation logic";
      minimalFixRequired = "Ensure shift ingest route writes loyverse_shifts records for synced receipts.";
    }

    res.json({
      connected,
      latestReceiptDate,
      latestShiftReportDate,
      latestSyncAt,
      activeIngestionRoute: "/api/loyverse/sync",
      receiptTable: "receipts",
      receiptItemsTable: "receipt_items",
      receiptPaymentsTable: "receipt_payments",
      shiftReportTable: "loyverse_shifts",
      timezone: "Asia/Bangkok",
      shiftWindow: "17:00-03:00 Asia/Bangkok",
      counts: {
        receipts: Number(receiptRow?.count || 0),
        shiftReports: Number(shiftRow?.count || 0),
      },
      blockers: [
        ...(receiptError ? [{ code: "MISSING_RECEIPT_SOURCE", message: receiptError.message || String(receiptError), where: "receipts", canonical_source: "receipts", auto_build_attempted: false }] : []),
        ...(shiftError ? [{ code: "MISSING_SHIFT_SOURCE", message: shiftError.message || String(shiftError), where: "loyverse_shifts", canonical_source: "loyverse_shifts", auto_build_attempted: false }] : []),
      ],
      failurePoint,
      minimalFixRequired,
    });
  } catch (error: any) {
    res.status(200).json({
      connected: false,
      latestReceiptDate: null,
      latestShiftReportDate: null,
      latestSyncAt: null,
      activeIngestionRoute: "/api/loyverse/sync",
      receiptTable: "receipts",
      shiftReportTable: "loyverse_shifts",
      failurePoint: "API route broken",
      minimalFixRequired: error?.message || "Validate DB connectivity and table availability.",
    });
  }
});
// Special tablet reload routes
app.get('/tablet-reload', (req, res) => {
  res.sendFile(path.resolve(process.cwd(), 'public/tablet-reload.html'));
});

app.get('/tablet-nuclear', (req, res) => {
  res.sendFile(path.resolve(process.cwd(), 'public/tablet-nuclear.html'));
});

app.use((req, res, next) => {
  const start = Date.now();
  const path = req.path;
  let capturedJsonResponse: Record<string, any> | undefined = undefined;

  const originalResJson = res.json;
  res.json = function (bodyJson, ...args) {
    capturedJsonResponse = bodyJson;
    return originalResJson.apply(res, [bodyJson, ...args]);
  };

  res.on("finish", () => {
    const duration = Date.now() - start;
    if (path.startsWith("/api")) {
      let logLine = `${req.method} ${path} ${res.statusCode} in ${duration}ms`;
      if (capturedJsonResponse) {
        logLine += ` :: ${JSON.stringify(capturedJsonResponse)}`;
      }

      if (logLine.length > 80) {
        logLine = logLine.slice(0, 79) + "…";
      }

      log(logLine);
    }
  });

  next();
});

// Schema validation function
async function checkSchema() {
  try {
    const { pool } = await import('./db.js');
    
    // Check that daily_sales_v2 exists with required JSONB payload column
    const result = await pool.query(`
      SELECT column_name, data_type FROM information_schema.columns 
      WHERE table_name = 'daily_sales_v2' 
      AND column_name IN ('payload', 'created_at', 'deleted_at', 'id')
    `);
    
    const columns = result.rows.map(r => r.column_name);
    
    if (!columns.includes('payload')) {
      console.warn('⚠️ daily_sales_v2 missing payload column - finance features may not work');
    }
    
    if (!columns.includes('id')) {
      console.warn('⚠️ daily_sales_v2 missing id column');
    }

    const purchasingGuard = await checkPurchasingItemsSchemaGuard(pool);
    if (!purchasingGuard.ok) {
      console.error('[FATAL SCHEMA WARNING] purchasing_items field mismatch detected.', {
        checkedFields: purchasingGuard.checkedFields,
        warning: purchasingGuard.warning,
        impact: 'Form 2 (Daily Stock) sync may be degraded until schema and code are aligned.',
      });
    }
    
    console.log('✓ Database schema validation passed');
    
  } catch (err) {
    console.warn('⚠️ Schema check warning:', (err as Error).message);
    console.log('Finance features may be limited if daily_sales_v2 table is not available');
  }
}

(async () => {

  // Mount drinks-variance BEFORE registerRoutes to prevent /api/analysis/:date wildcard conflict
  const drinksVarianceRouter = (await import('./routes/drinksVariance.js')).default;
  app.use('/api/analysis', drinksVarianceRouter);
  const drinksAdjustmentsRouter = (await import('./routes/drinksAdjustments.js')).default;
  app.use('/api/analysis', drinksAdjustmentsRouter);
  // Mount burgers-sets table (PATCH 1) — completely separate from drinks logic
  const burgersVarianceRouter = (await import('./routes/burgersVariance.js')).default;
  app.use('/api/analysis', burgersVarianceRouter);
  // Mount buns reconciliation (CORE STOCK V1 PATCH 1) — isolated from drinks and burgers
  const bunsReconciliationRouter = (await import('./routes/bunsReconciliation.js')).default;
  app.use('/api/analysis', bunsReconciliationRouter);
  // Mount rolls reconciliation for Shift Analysis — read-only, single stock table
  const rollsReconciliationRouter = (await import('./routes/rollsReconciliation.js')).default;
  app.use('/api/analysis', rollsReconciliationRouter);
  // Mount meat reconciliation (CORE STOCK V2 PATCH 1) — isolated from all other sections
  const meatReconciliationRouter = (await import('./routes/meatReconciliation.js')).default;
  app.use('/api/analysis', meatReconciliationRouter);
  // Mount side orders variance (V3 PATCH 1) — isolated from drinks, burgers, buns, meat
  const sideOrdersVarianceRouter = (await import('./routes/sideOrdersVariance.js')).default;
  app.use('/api/analysis', sideOrdersVarianceRouter);
  // Mount french fries reconciliation (CORE STOCK V4 PATCH 1) — isolated from all other sections
  const friesReconciliationRouter = (await import('./routes/friesReconciliation.js')).default;
  app.use('/api/analysis', friesReconciliationRouter);
  // Mount sweet potato reconciliation — isolated from all other stock sections
  const sweetPotatoReconciliationRouter = (await import('./routes/sweetPotatoReconciliation.js')).default;
  app.use('/api/analysis', sweetPotatoReconciliationRouter);
  const modifierPipelineRouter = (await import('./routes/modifierPipeline.js')).default;
  app.use('/api/analysis', modifierPipelineRouter);
  const promoMixMatchRouter = (await import('./routes/promoMixMatch.js')).default;
  app.use('/api/analysis', promoMixMatchRouter);
  const analysisV2Router = (await import('./routes/analysisV2.js')).default;
  app.use('/api/analysis', analysisV2Router);
  
  // Bank imports — GET must be registered BEFORE registerRoutes mounts bankUploadRouter at same path
  app.get('/api/bank-imports', async (req: Request, res: Response) => {
    try {
      const { db: dbConn } = await import('./db');
      const { sql: rawSql } = await import('drizzle-orm');
      const result = await dbConn.execute(rawSql`
        SELECT id, filename, bank_code AS "bankCode", row_count AS "rowCount",
               status, created_at AS "createdAt"
        FROM bank_import_batch ORDER BY created_at DESC LIMIT 50
      `);
      res.json({ batches: result.rows });
    } catch {
      res.json({ batches: [] }); // table not yet created — return empty gracefully
    }
  });

  const server = await registerRoutes(app);

  // Read-only operational UI summaries for owner review pages.
  app.use("/api/operations-read", operationsReadRouter);
  app.use("/api/ordering", orderingRouter);
  app.use("/api/pos", posRouter);

  // Setup webhooks for real-time Loyverse data
  setupWebhooks(app);
  
  // Fort Knox agents are imported dynamically in routes

  // Mount the daily stock API router
  const dailyStockRouter = (await import('./api/daily-stock')).default;
  app.use('/api/daily-stock', dailyStockRouter);

  // Mount the daily cleaning verification API router
  const dailyCleaningRouter = (await import('./api/daily-cleaning')).default;
  app.use('/api/daily-cleaning', dailyCleaningRouter);

  // Mount shift expenses router for extracting line items from Daily Sales & Stock forms
  const shiftExpensesRouter = (await import('./routes/shiftExpenses')).default;
  app.use('/api/shift-expenses', shiftExpensesRouter);

  // Mount Meekong Mumba v1.0 routes
  const loyverseV2Router = (await import('./routes/loyverseV2.js')).default;
  const shiftAnalysisRouter = (await import('./routes/shiftAnalysis.js')).default;
  app.use('/api', loyverseV2Router);
  app.use('/api', shiftAnalysisRouter);
  app.use('/api/analysis/shift', analysisCsv);
  app.use(ensureShiftRouter);
  app.use('/api', healthRouter);
  app.use('/api', opsMtdRouter);
  app.use('/api/purchasing', purchasingRouter);
  app.use('/api/purchasing', purchasingDrinksRouter);
  app.use('/api/purchasing-items', purchasingItemsRouter);
  
  // Mount Purchasing Shift Log routes
  const purchasingShiftLogRouter = (await import('./routes/purchasingShiftLog')).default;
  app.use('/api', purchasingShiftLogRouter);
  
  app.use('/api', menuOnlineRouter);
  app.use('/api', imageUploadRouter);
  app.use('/api/export', exportRoutes);
  app.use(primeCostRouter);

  app.get('/api/daily-stock/:salesFormId', async (req: Request, res: Response) => {
    try {
      const { salesFormId } = req.params;
      
      const stockForm = await prisma.dailyStock.findUnique({
        where: { id: salesFormId },
      });

      if (!stockForm) {
        return res.status(404).json({ error: 'Stock form not found' });
      }

      res.status(200).json(stockForm);
    } catch (err) {
      console.error('[daily-stock] Error fetching form:', err);
      res.status(500).json({ error: 'Failed to fetch stock form' });
    }
  });

  // Prisma-based Daily Sales API endpoints
  app.post('/api/daily-sales', async (req: Request, res: Response) => {
    try {
      const {
        completedBy,
        startingCash,
        cashSales,
        qrSales,
        grabSales,
        otherSales, // Updated from aroiDeeSales
        totalSales,
        shoppingExpenses,
        wages,
        totalExpenses,
        closingCash,
        cashBanked,
        qrTransferred,
        amountBanked,
        notes,
        status = 'draft'
      } = req.body;

      const result = await prisma.dailySales.create({
        data: {
          completedBy,
          startingCash: parseFloat(startingCash) || 0,
          cashSales: parseFloat(cashSales) || 0,
          qrSales: parseFloat(qrSales) || 0,
          grabSales: parseFloat(grabSales) || 0,
          otherSales: parseFloat(otherSales) || 0, // Updated from aroiSales to otherSales
          totalSales: parseFloat(totalSales) || 0,
          // Note: shoppingExpenses and wages fields not in current schema
          totalExpenses: parseFloat(totalExpenses) || 0,
          closingCash: parseFloat(closingCash) || 0,
          cashBanked: parseFloat(cashBanked) || 0,
          qrTransfer: parseFloat(qrTransferred) || 0,
          notes: notes || '',
          status
        },
      });

      res.status(200).json({ success: true, id: result.id });
    } catch (err) {
      console.error('[daily-sales] Error saving form:', err);
      res.status(500).json({ error: 'Failed to save sales form' });
    }
  });

  app.get('/api/daily-sales', async (req: Request, res: Response) => {
    try {
      const forms = await prisma.dailySales.findMany({
        where: { deletedAt: null },
        orderBy: { createdAt: 'desc' },
        take: 20
      });
      res.status(200).json(forms);
    } catch (err) {
      console.error('[daily-sales] Error fetching forms:', err);
      res.status(500).json({ error: 'Failed to fetch sales forms' });
    }
  });

  // Daily Stock API routes are now in routes.ts

  // Ingredients API - returns real DB data with base_unit and unit_cost_per_base
  app.get('/api/ingredients', async (req: Request, res: Response) => {
    try {
      const search = (req.query.search as string || '').trim();
      
      let query = `
        SELECT DISTINCT ON (name) 
          id, name, category, base_unit, unit_cost_per_base, portion_unit
        FROM ingredients 
        WHERE unit_cost_per_base IS NOT NULL AND unit_cost_per_base > 0
      `;
      const params: any[] = [];
      
      if (search) {
        query += ` AND name ILIKE $1`;
        params.push(`%${search}%`);
      }
      
      query += ` ORDER BY name, unit_cost_per_base DESC NULLS LAST LIMIT 50`;
      
      const result = await pool.query(query, params);
      
      const ingredients = result.rows.map(row => ({
        id: row.id,
        name: row.name,
        category: row.category || null,
        portionUnit: row.base_unit || row.portion_unit || 'each',
        baseUnit: row.base_unit || 'each',
        unitCostPerBase: Number(row.unit_cost_per_base) || 0,
      }));
      
      res.json(ingredients);
    } catch (err) {
      console.error('[ingredients] Error fetching ingredients:', err);
      res.status(500).json({ error: 'Failed to fetch ingredients' });
    }
  });


  // Serve static files from public directory
  // Add stock catalog API route
  const stockCatalogRouter = (await import('./api/stock-catalog-new')).default;
  app.use('/api/stock-catalog', stockCatalogRouter);
  

  
  const ingredientsRouter = (await import('./api/ingredients-import')).default;
  app.use('/api/ingredients', ingredientsRouter);
  
  // Add finance routes
  const financeRouter = (await import('./routes/finance')).default;
  app.use('/api/finance', financeRouter);
  
  // Add checklist routes
  const checklistRouter = (await import('./routes/checklists')).default;
  app.use('/api/checklists', checklistRouter);
  
  // Add SKU mapping routes (Prisma-based)
  const { skuMapRouter } = await import('./routes/skuMap');
  app.use('/api', skuMapRouter);
  
  // Add admin test email route
  const { adminTestEmailRouter } = await import('./routes/adminTestEmail');
  app.use(adminTestEmailRouter);
  

  
  // PATCH O14 — Auth routes
  app.use("/api/auth", authRoutes);
  
  // PATCH O14 Chunk 5 — Payment provider routes
  app.use("/api/payment-providers", providerRoutes);
  app.use("/api/payments", paymentProcessRoutes);
  
  // PATCH L0 — Legacy Read Bridge routes
  app.use("/api/legacy-bridge", legacyBridgeRoutes);
  
  // System Health Test route
  const systemHealthRouter = (await import('./routes/systemHealth')).default;
  app.use('/api/system-health', systemHealthRouter);

  // /api/ui-auth — UI password gate (shared password, cookie session)
  const uiAuthRouter = (await import('./routes/uiAuth')).default;
  app.use('/api/ui-auth', uiAuthRouter);

  // /api/pin-auth — Staff PIN login system
  const pinAuthRouter = (await import('./routes/pinAuth')).default;
  app.use('/api/pin-auth', pinAuthRouter);

  // DB setup: daily sales audit table + internal users
  const { ensureDailySalesAuditTable, ensureInternalUsersTable } = await import('./db');
  await ensureDailySalesAuditTable();
  await ensureInternalUsersTable();
  // Guarantee at least one recoverable production owner, then backfill staff usernames.
  const { ensureProductionOwner, backfillUsernames } = await import('./routes/pinAuth');
  await ensureProductionOwner();
  await backfillUsernames();

  // Ingredient Master route (PACK F)
  const ingredientMasterRouter = (await import('./routes/ingredientMaster')).default;
  app.use('/api/ingredient-master', ingredientMasterRouter);

  // Ingredient Authority (Purchasing Canonical)
  const ingredientAuthorityModule = await import('./routes/ingredientAuthority');
  const ingredientAuthorityRouter = ingredientAuthorityModule.default;
  const ingredientSearchRouter = ingredientAuthorityModule.ingredientSearchRouter;
  app.use('/api/ingredient-authority', ingredientAuthorityRouter);
  app.use('/', ingredientSearchRouter);

  // Recipes CRUD
  const recipesRouterMod = await import('./routes/recipes');
  app.use('/api/recipes', recipesRouterMod.default);

  // Bank Imports (CSV upload, batch management, transaction review)
  const { bankImportRouter } = await import('./routes/bankImport');
  app.use('/api/bank-imports', bankImportRouter);

  // Staff Operations
  const staffOpsRouterMod = await import('./routes/staffOps');
  app.use('/api/staff', staffOpsRouterMod.default);

  // JSON 404 guard — any /api/* path not matched above returns JSON, never HTML.
  // This MUST sit before errorGuard and before Vite/serveStatic catch-all.
  app.use('/api', (req: Request, res: Response) => {
    res.status(404).json({
      error: 'API_ROUTE_NOT_FOUND',
      path: req.originalUrl,
    });
  });

  // Error guard middleware - must be LAST
  app.use(errorGuard);

  // importantly only setup vite in development and after
  // setting up all the other routes so the catch-all route
  // doesn't interfere with the other routes
  if (app.get("env") === "development") {
    await setupVite(app, server);
  } else {
    serveStatic(app);
  }

  // Use PORT env var for Cloud Run / Autoscale compatibility
  // Cloud Run sets PORT env var, defaults to 8080
  const PORT = Number(process.env.PORT) || 8080;
  
  server.listen({
    port: PORT,
    host: "0.0.0.0",
    reusePort: true,
  }, () => {
    // Log immediately - no async operations here
    console.log(`✅ Server listening on port ${PORT}`);
    
    // === DEFERRED STARTUP: Run ALL heavy operations AFTER port is open ===
    // This ensures health checks pass before background jobs start
    setImmediate(() => {
      // Wrap in async IIFE but don't block the callback
      (async () => {
        try {
          // Check schema (moved from before server start)
          checkSchema().catch(err => console.warn('Schema check warning:', err));
          
          // Auto-seed ingredients from foodCostings.ts god file
          try {
            const seedResult = await autoSeedOnStartup();
            if (seedResult.error) {
              console.error('❌ Auto-seed failed:', seedResult.error);
            } else if (seedResult.seeded > 0 || seedResult.updated > 0) {
              console.log(`🌱 Auto-seeded ingredients: ${seedResult.seeded} new, ${seedResult.updated} updated`);
            }
          } catch (error) {
            console.error('❌ Auto-seed error:', error);
          }

          // Start the scheduler service for daily 4am tasks
          schedulerService.start();

          // Start the email cron service for daily 8am management reports
          const { cronEmailService } = await import('./services/cronEmailService');
          cronEmailService.startEmailCron();

          // Start rolls ledger cron jobs (analytics + rolls ledger rebuilds)
          await import('./jobs/cron.js');
          
          // Register Daily Report V2 cron (3AM Bangkok)
          registerDailyReportCron();
          // Register Weekly Roster Distribution prep cron (Sunday 03:30AM Bangkok)
          registerWeeklyRosterDistributionCron();
          
          // PATCH 6+7 — AUTO GENERATE SHIFT REPORT AT 03:10AM DAILY (BANGKOK TIME) + EMAIL
          const { buildShiftReport } = await import('./services/shiftReportBuilder');
          const { sendShiftReportEmail } = await import('./services/shiftReportEmail');
          const nodeCron = await import('node-cron');
          nodeCron.default.schedule("10 3 * * *", async () => {
            try {
              const now = new Date();
              console.log("[SCHEDULER] Auto-generating shift report for", now);
              const report = await buildShiftReport(now);
              console.log("[SCHEDULER] Shift report generated successfully.");
              
              // PATCH 7 — SEND EMAIL SUMMARY
              if (report?.id) {
                await sendShiftReportEmail(report.id);
                console.log("[SCHEDULER] Shift report email sent.");
              }
            } catch (err) {
              console.error("[SCHEDULER] Shift report generation failed:", err);
            }
          }, {
            timezone: "Asia/Bangkok"
          });
          console.log("📊 Shift Report V2 auto-generation + email scheduled for 3:10am Bangkok time");
          // Shift snapshot POS ingestion (08:00 Bangkok, yesterday)
          const { storeShiftSnapshot } = await import('./services/loyverseService');
          nodeCron.default.schedule("0 8 * * *", async () => {
            const targetDate = new Date(Date.now() - 24 * 60 * 60 * 1000)
              .toLocaleDateString('en-CA', { timeZone: 'Asia/Bangkok' });
            try {
              await storeShiftSnapshot(targetDate);
              console.log(`[SCHEDULER] shift_snapshot_v2 POS sync complete for ${targetDate}`);
            } catch (error) {
              console.error('[SCHEDULER] shift_snapshot_v2 POS sync failed', { targetDate, error });
            }
          }, { timezone: 'Asia/Bangkok' });

          // Daily anomaly email (08:00 Bangkok, same pass)
          const { runDailyShiftAnomalyAudit } = await import('./services/shiftReportEmail');
          nodeCron.default.schedule("0 8 * * *", async () => {
            try {
              const result = await runDailyShiftAnomalyAudit();
              console.log('[SCHEDULER] Daily shift anomaly audit done', result);
            } catch (error) {
              console.error('[SCHEDULER] Daily shift anomaly audit failed', error);
            }
          }, { timezone: 'Asia/Bangkok' });
          
          // PATCH O3 — LOYVERSE QUEUE SCHEDULER
          const { processLoyverseQueue } = await import('./services/loyverseQueue.js');
          setInterval(() => {
            processLoyverseQueue().catch(err => console.error('Loyverse queue error:', err));
          }, 30000); // run every 30 seconds
          console.log("📦 Loyverse order queue scheduled every 30 seconds");

          // PATCH O14 — Ensure default SaaS tenant exists
          await TenantScoped.ensureRestaurantExists();
          console.log("🏢 SaaS tenant layer initialized");
          
          // Optional first-owner bootstrap. Credentials must be supplied via
          // environment variables and are never committed to source control.
          const bootstrapEmail = process.env.BOOTSTRAP_OWNER_EMAIL;
          const bootstrapPassword = process.env.BOOTSTRAP_OWNER_PASSWORD;
          if (bootstrapEmail && bootstrapPassword) {
            const { db } = await import('./lib/prisma');
            const prisma = db();
            const existingAdmin = await prisma.saas_tenant_users.findFirst({
              where: { email: bootstrapEmail }
            });
            if (!existingAdmin) {
              await AuthService.register({
                email: bootstrapEmail,
                password: bootstrapPassword,
                role: "owner",
                tenantId: 1
              });
              console.log("👤 Bootstrap owner created");
            }
          }
          


          console.log('✅ All background services started successfully');
        } catch (err) {
          console.error('❌ Error starting background services:', err);
        }
      })();
    });
  });
})();
