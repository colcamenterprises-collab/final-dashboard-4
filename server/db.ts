import { Pool, neonConfig } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-serverless';
import ws from "ws";
import * as schema from "../shared/schema";

neonConfig.webSocketConstructor = ws;

if (!process.env.DATABASE_URL) {
  throw new Error(
    "DATABASE_URL must be set. Did you forget to provision a database?",
  );
}

// Enhanced pool configuration with better error handling
const poolConfig = {
  connectionString: process.env.DATABASE_URL,
  max: 10, // Maximum number of connections
  maxUses: 7500, // Maximum uses per connection before recycling
  allowExitOnIdle: false,
  maxLifetimeSeconds: 3600, // 1 hour max connection lifetime
  idleTimeoutMillis: 30000, // 30 seconds idle timeout
};

export const pool = new Pool(poolConfig);

// Add error handling for the pool
pool.on('error', (err) => {
  console.error('Database pool error:', err.message);
  // Don't exit the process, let the pool handle reconnection
});

pool.on('connect', () => {
  console.log('✓ Database connection established');
});

// Enhanced drizzle client with error handling
export const db = drizzle({ client: pool, schema });

// Graceful shutdown handler
process.on('SIGTERM', async () => {
  console.log('Shutting down database connections...');
  await pool.end();
  process.exit(0);
});

process.on('SIGINT', async () => {
  console.log('Shutting down database connections...');
  await pool.end();
  process.exit(0);
});

// Database health check function
export async function checkDatabaseHealth(): Promise<boolean> {
  try {
    const result = await pool.query('SELECT 1');
    return result.rows.length > 0;
  } catch (error) {
    console.error('Database health check failed:', (error as Error).message);
    return false;
  }
}