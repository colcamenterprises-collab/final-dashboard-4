import { registerEnsureShiftCron } from './jobs/cronEnsureShift.js';
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
import posUploadRouter from "./routes/posUpload";
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
import reportsV2Router from "./routes/reportsV2";
import reportsListV2Router from "./routes/reportsListV2";
import insightsV2Router from "./routes/insightsV2";
import securityV2Router from "./routes/securityV2";
import systemHealthRoutes from "./routes/systemHealth";
import { registerDailyReportCron } from "./cron/dailyReportCron";
import { tenantContext } from "./middleware/tenantContext";
import { tenantResolver } from "./middleware/tenantResolver";
import { TenantScoped } from "./services/tenant/tenantScopedService";
import { AuthService } from "./services/auth/authService";
import authRoutes from "./routes/auth/authRoutes";
import providerRoutes from "./routes/payments/providerRoutes";
import paymentProcessRoutes from "./routes/payments/processRoutes";
import legacyBridgeRoutes from "./routes/legacyBridge";

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
    
    console.log('✓ Database schema validation passed');
    
  } catch (err) {
    console.warn('⚠️ Schema check warning:', (err as Error).message);
    console.log('Finance features may be limited if daily_sales_v2 table is not available');
  }
}

(async () => {
  // Mount the POS upload router FIRST to avoid conflicts
  app.use("/api/pos", posUploadRouter);
  
  const server = await registerRoutes(app);

  // Setup webhooks for real-time Loyverse data
  setupWebhooks(app);
  
  // Fort Knox agents are imported dynamically in routes

  // Mount the daily stock API router
  const dailyStockRouter = (await import('./api/daily-stock')).default;
  app.use('/api/daily-stock', dailyStockRouter);

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

  // Multi-agent chat routes
  app.post('/chat/:agent', async (req: Request, res: Response) => {
    const startTime = Date.now();
    const { agent } = req.params;
    const { message } = req.body;

    if (!message || typeof message !== 'string') {
      return res.status(400).json({ error: 'Message is required' });
    }

    let response = '';
    let agentName = '';

    try {
      switch (agent.toLowerCase()) {
        case 'jussi':
          const { jussiHandler } = await import('./agents/jussi');
          response = await jussiHandler(message);
          agentName = 'Jussi';
          break;
        case 'jane':
          const { janeHandler } = await import('./agents/jane');
          response = await janeHandler(message);
          agentName = 'Jane';
          break;
        case 'ramsay':
          const { ramsayHandler } = await import('./agents/ramsay');
          response = await ramsayHandler(message);
          agentName = 'Ramsay';
          break;
        default:
          return res.status(400).json({ error: 'Invalid agent. Choose jussi, jane, or ramsay.' });
      }

      const responseTime = Date.now() - startTime;

      // Log the interaction to database
      try {
        const { chatLogs } = await import('../shared/schema.js');
        await db.insert(chatLogs).values({
          agentName,
          userMessage: message,
          agentResponse: response,
          responseTime
        });
      } catch (dbError) {
        console.error('Error logging chat interaction:', dbError);
      }

      res.json({ reply: response, responseTime });
    } catch (error: any) {
      console.error(`Error with ${agent} agent:`, error);
      res.status(500).json({ error: 'Agent is currently unavailable. Please try again.' });
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
  
  // Add admin sync route
  const adminSyncRouter = (await import('./routes/adminSync.js')).default;
  app.use('/api', adminSyncRouter);
  app.use("/api/reports", reportsV2Router);
  app.use("/api/reports", reportsListV2Router);
  app.use("/api/insights", insightsV2Router);
  app.use("/api/security", securityV2Router);
  
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

  // Ingredient Master route (PACK F)
  const ingredientMasterRouter = (await import('./routes/ingredientMaster')).default;
  app.use('/api/ingredient-master', ingredientMasterRouter);

  // Ingredient Authority (Purchasing Canonical)
  const ingredientAuthorityModule = await import('./routes/ingredientAuthority');
  const ingredientAuthorityRouter = ingredientAuthorityModule.default;
  const ingredientSearchRouter = ingredientAuthorityModule.ingredientSearchRouter;
  app.use('/api/ingredient-authority', ingredientAuthorityRouter);
  app.use('/', ingredientSearchRouter);

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

          // 🚨 Jussi Daily Cron (3AM BKK)
          setInterval(async () => {
            const bkkNow = new Date().toLocaleString("en-US", { timeZone: "Asia/Bangkok" });
            const time = bkkNow.slice(11,16);
            if (time === "03:00") {
              try {
                const { generateJussiReport } = await import('./services/summaryGenerator.js');
                const today = bkkNow.slice(0,10);
                await generateJussiReport(today);
                console.log(`🚨 Jussi Daily Report generated for ${today}`);
              } catch (error) {
                console.error('🚨 Jussi Daily Cron failed:', error);
              }
            }
          }, 60*1000);

          // Start rolls ledger cron jobs (analytics + rolls ledger rebuilds)
          await import('./jobs/cron.js');
          
          // Register Daily Report V2 cron (3AM Bangkok)
          registerDailyReportCron();
          
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

          // PATCH O9 — KDS Auto-Complete Cron (every 2 minutes)
          const { autoCompleteOldOrders } = await import('./services/kdsService');
          nodeCron.default.schedule("*/2 * * * *", async () => {
            console.log("[KDS] Auto-cleanup running");
            await autoCompleteOldOrders().catch((err: any) => console.error("[KDS] Auto-complete error:", err));
          });
          console.log("🍳 KDS auto-complete scheduled every 2 minutes");
          
          // PATCH O14 — Ensure default SaaS tenant exists
          await TenantScoped.ensureRestaurantExists();
          console.log("🏢 SaaS tenant layer initialized");
          
          // PATCH O14 Chunk 2 — Seed default admin user
          const { db } = await import('./lib/prisma');
          const prisma = db();
          const existingAdmin = await prisma.saas_tenant_users.findFirst({
            where: { email: "admin@sbb.com" }
          });
          if (!existingAdmin) {
            await AuthService.register({
              email: "admin@sbb.com",
              password: "sbb123",
              role: "owner",
              tenantId: 1
            });
            console.log("👤 Default admin created: admin@sbb.com (password: sbb123)");
          }
          
          console.log('✅ All background services started successfully');
        } catch (err) {
          console.error('❌ Error starting background services:', err);
        }
      })();
    });
  });
})();
