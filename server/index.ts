import express, { type Request, Response, NextFunction } from "express";
import path from "path";
import { registerRoutes } from "./routes";
import { setupVite, serveStatic, log } from "./vite";
import { schedulerService } from "./services/scheduler";
import { setupWebhooks, registerWebhooks, listWebhooks } from "./webhooks";
import { OllieAgent } from './agents/ollie.js';
import { SallyAgent } from './agents/sally.js';
import { MarloAgent } from './agents/marlo.js';
import { BigBossAgent } from './agents/bigboss.js';
import { db } from './utils/dbUtils.js';

const app = express();
app.use(express.json({ limit: '100mb' }));
app.use(express.urlencoded({ extended: false, limit: '100mb' }));

// Add AGGRESSIVE cache control headers to prevent tablet caching issues
app.use((req, res, next) => {
  // Disable caching for ALL files to ensure changes flow through to tablets
  res.set('Cache-Control', 'no-cache, no-store, must-revalidate, proxy-revalidate');
  res.set('Pragma', 'no-cache');
  res.set('Expires', '0');
  res.set('Surrogate-Control', 'no-store');
  res.set('Last-Modified', new Date().toUTCString());
  res.set('ETag', '"' + Date.now() + '"');
  
  // Add tablet-specific headers
  const userAgent = req.get('User-Agent') || '';
  if (userAgent.includes('iPad') || userAgent.includes('Android')) {
    res.set('X-Tablet-Cache-Bust', Date.now().toString());
    res.set('Vary', 'User-Agent');
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

// Serve tablet cache clear page
app.use('/public', express.static(path.resolve(process.cwd(), 'public')));

// Special tablet reload route
app.get('/tablet-reload', (req, res) => {
  res.sendFile(path.resolve(process.cwd(), 'public/tablet-reload.html'));
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
    
    const result = await pool.query(`
      SELECT column_name FROM information_schema.columns 
      WHERE table_name = 'daily_stock_sales' 
      AND column_name IN ('wages', 'shopping', 'banked_amount', 'ending_cash')
    `);
    
    const columns = result.rows.map(r => r.column_name);
    const requiredColumns = ['wages', 'shopping', 'banked_amount', 'ending_cash'];
    
    for (const col of requiredColumns) {
      if (!columns.includes(col)) {
        throw new Error(`Missing required column: ${col}`);
      }
    }
    
    console.log('✓ Database schema validation passed');
    
  } catch (err) {
    console.error('❌ Schema check failed:', (err as Error).message);
    console.log('Run: node server/migrations/fix-schema.js to fix schema issues');
  }
}

(async () => {
  // Check schema on startup
  await checkSchema();
  const server = await registerRoutes(app);

  // Setup webhooks for real-time Loyverse data
  setupWebhooks(app);
  
  // Initialize AI agents
  const ollie = new OllieAgent();
  const sally = new SallyAgent();
  const marlo = new MarloAgent();
  const bigboss = new BigBossAgent();

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
        case 'ollie':
          response = await ollie.handleMessage(message);
          agentName = ollie.name;
          break;
        case 'sally':
          response = await sally.handleMessage(message);
          agentName = sally.name;
          break;
        case 'marlo':
          response = await marlo.handleMessage(message);
          agentName = marlo.name;
          break;
        case 'bigboss':
          response = await bigboss.handleMessage(message);
          agentName = bigboss.name;
          break;
        default:
          return res.status(400).json({ error: 'Invalid agent. Choose ollie, sally, marlo, or bigboss.' });
      }

      const responseTime = Date.now() - startTime;

      // Log the interaction to database
      try {
        const { chatLogs } = await import('./utils/dbUtils.js');
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
  app.use(express.static(path.resolve(process.cwd(), 'public')));

  // Start the scheduler service for daily 4am tasks
  schedulerService.start();

  // Start the email cron service for daily 8am management reports
  const { cronEmailService } = await import('./services/cronEmailService');
  cronEmailService.startEmailCron();

  app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
    const status = err.status || err.statusCode || 500;
    const message = err.message || "Internal Server Error";

    res.status(status).json({ message });
    throw err;
  });

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
  }, () => {
    log(`serving on port ${port}`);
  });
})();
