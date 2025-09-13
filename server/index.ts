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
  // Check schema on startup
  await checkSchema();
  const server = await registerRoutes(app);

  // Setup webhooks for real-time Loyverse data
  setupWebhooks(app);
  
  // Fort Knox agents are imported dynamically in routes

  // Mount the daily stock API router
  const dailyStockRouter = (await import('./api/daily-stock')).default;
  app.use('/api/daily-stock', dailyStockRouter);

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

  // Basic ingredients API for testing
  app.get('/api/ingredients', async (req: Request, res: Response) => {
    try {
      // Mock ingredients data for now - this would normally come from the database
      const mockIngredients = [
        { name: 'Lettuce', category: 'Fresh Food' },
        { name: 'Tomato', category: 'Fresh Food' },
        { name: 'Onion', category: 'Fresh Food' },
        { name: 'Chicken Wings', category: 'Frozen Food' },
        { name: 'French Fries', category: 'Frozen Food' },
        { name: 'Chicken Nuggets', category: 'Frozen Food' },
        { name: 'Salt', category: 'Shelf Items' },
        { name: 'Pepper', category: 'Shelf Items' },
        { name: 'Cooking Oil', category: 'Shelf Items' },
        { name: 'Gloves', category: 'Kitchen Supplies' },
        { name: 'Paper Towels', category: 'Kitchen Supplies' },
        { name: 'Cleaning Spray', category: 'Kitchen Supplies' },
        { name: 'Food Containers', category: 'Packaging' },
        { name: 'Paper Bags', category: 'Packaging' },
        { name: 'Napkins', category: 'Packaging' }
      ];
      res.json(mockIngredients);
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
  
  app.use(express.static(path.resolve(process.cwd(), 'public')));

  // Start the scheduler service for daily 4am tasks
  schedulerService.start();

  // Start the email cron service for daily 8am management reports
  const { cronEmailService } = await import('./services/cronEmailService');
  cronEmailService.startEmailCron();

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

  // ALWAYS serve the app on port 5000
  // this serves both the API and the client.
  // It is the only port that is not firewalled.
  const port = 5000;
  server.listen({
    port,
    host: "0.0.0.0",
    reusePort: true,
  }, async () => {
    log(`serving on port ${port}`);
    
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
  });
})();
