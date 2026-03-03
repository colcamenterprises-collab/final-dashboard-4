import { Pool, neonConfig } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-serverless';
import ws from "ws";
import * as schema from "../shared/schema";

neonConfig.webSocketConstructor = ws;

export const databaseAvailable = Boolean(process.env.DATABASE_URL);

// Enhanced pool configuration with better error handling
const poolConfig = {
  connectionString: process.env.DATABASE_URL,
  max: 10, // Maximum number of connections
  maxUses: 7500, // Maximum uses per connection before recycling
  allowExitOnIdle: false,
  maxLifetimeSeconds: 3600, // 1 hour max connection lifetime
  idleTimeoutMillis: 30000, // 30 seconds idle timeout
};

export const pool = databaseAvailable ? new Pool(poolConfig) : null;

if (!databaseAvailable) {
  console.warn("[db] DATABASE_URL missing. Server running in no-database mode.");
}

// Add error handling for the pool
pool?.on('error', (err) => {
  console.error('Database pool error:', err.message);
  // Don't exit the process, let the pool handle reconnection
});

pool?.on('connect', () => {
  console.log('✓ Database connection established');
});

// Enhanced drizzle client with error handling
export const db = databaseAvailable && pool ? drizzle({ client: pool, schema }) : null;

// Graceful shutdown handler
process.on('SIGTERM', async () => {
  console.log('Shutting down database connections...');
  if (pool) {
    await pool.end();
  }
  process.exit(0);
});

process.on('SIGINT', async () => {
  console.log('Shutting down database connections...');
  if (pool) {
    await pool.end();
  }
  process.exit(0);
});

// Idempotent table setup for AI Chat
export async function ensureAiChatTables(): Promise<void> {
  if (!pool) return;
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS ai_chat_threads (
        id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
        title       TEXT        NOT NULL,
        created_by  TEXT        NOT NULL DEFAULT 'user',
        created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        last_message_at TIMESTAMPTZ
      );
      CREATE TABLE IF NOT EXISTS ai_chat_messages (
        id             UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
        thread_id      UUID        NOT NULL REFERENCES ai_chat_threads(id) ON DELETE CASCADE,
        role           TEXT        NOT NULL CHECK (role IN ('user','assistant','system')),
        content        TEXT        NOT NULL,
        token_estimate INTEGER     NOT NULL DEFAULT 0,
        created_by     TEXT        NOT NULL DEFAULT 'user',
        created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
      CREATE INDEX IF NOT EXISTS ai_chat_msg_thread_idx
        ON ai_chat_messages(thread_id, created_at);
    `);
    // ai_tasks + supporting tables
    await pool.query(`
      CREATE TABLE IF NOT EXISTS ai_tasks (
        id            SERIAL      PRIMARY KEY,
        task_number   TEXT,
        title         TEXT        NOT NULL,
        description   TEXT,
        frequency     TEXT        NOT NULL DEFAULT 'once',
        priority      TEXT        NOT NULL DEFAULT 'medium',
        status        TEXT        NOT NULL DEFAULT 'draft',
        assigned_to   TEXT,
        publish       BOOLEAN     NOT NULL DEFAULT FALSE,
        due_at        TIMESTAMPTZ,
        created_by    TEXT        NOT NULL DEFAULT 'user',
        created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        completed_at  TIMESTAMPTZ
      );
      CREATE TABLE IF NOT EXISTS ai_task_activity (
        id         SERIAL      PRIMARY KEY,
        task_id    INT         NOT NULL REFERENCES ai_tasks(id) ON DELETE CASCADE,
        action     TEXT        NOT NULL,
        actor      TEXT        NOT NULL,
        note       TEXT,
        payload    JSONB,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
      CREATE TABLE IF NOT EXISTS ai_task_messages (
        id         SERIAL      PRIMARY KEY,
        task_id    INT         NOT NULL REFERENCES ai_tasks(id) ON DELETE CASCADE,
        actor      TEXT        NOT NULL,
        message    TEXT        NOT NULL,
        visibility TEXT        NOT NULL DEFAULT 'internal',
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
      CREATE TABLE IF NOT EXISTS ai_task_reviews (
        id            SERIAL      PRIMARY KEY,
        task_id       INT         NOT NULL REFERENCES ai_tasks(id) ON DELETE CASCADE,
        requested_by  TEXT        NOT NULL,
        request_note  TEXT,
        requested_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        decision      TEXT,
        decision_note TEXT,
        decided_by    TEXT,
        decided_at    TIMESTAMPTZ,
        created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `);
    // ai_issues + supporting tables
    await pool.query(`
      CREATE TABLE IF NOT EXISTS ai_issues (
        id             SERIAL      PRIMARY KEY,
        title          TEXT        NOT NULL,
        description    TEXT,
        severity       TEXT        NOT NULL DEFAULT 'medium',
        status         TEXT        NOT NULL DEFAULT 'draft',
        created_by     TEXT        NOT NULL DEFAULT 'user',
        owner_agent    TEXT,
        assignee       TEXT,
        plan_md        TEXT,
        approval_note  TEXT,
        approved_by    TEXT,
        approved_at    TIMESTAMPTZ,
        completed_by   TEXT,
        completed_at   TIMESTAMPTZ,
        closed_by      TEXT,
        closed_at      TIMESTAMPTZ,
        visibility     TEXT        NOT NULL DEFAULT 'internal',
        created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
      CREATE TABLE IF NOT EXISTS ai_issue_activity (
        id         SERIAL      PRIMARY KEY,
        issue_id   INT         NOT NULL REFERENCES ai_issues(id) ON DELETE CASCADE,
        actor      TEXT        NOT NULL,
        action     TEXT        NOT NULL,
        meta       JSONB,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
      CREATE TABLE IF NOT EXISTS ai_issue_comments (
        id         SERIAL      PRIMARY KEY,
        issue_id   INT         NOT NULL REFERENCES ai_issues(id) ON DELETE CASCADE,
        author     TEXT        NOT NULL,
        visibility TEXT        NOT NULL DEFAULT 'internal',
        message    TEXT        NOT NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `);
    // ai_ideas + supporting tables
    await pool.query(`
      CREATE TABLE IF NOT EXISTS ai_ideas (
        id          SERIAL      PRIMARY KEY,
        title       TEXT        NOT NULL,
        description TEXT,
        category    TEXT,
        status      TEXT        NOT NULL DEFAULT 'new',
        created_by  TEXT        NOT NULL DEFAULT 'user',
        created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
      CREATE TABLE IF NOT EXISTS ai_idea_activity (
        id         SERIAL      PRIMARY KEY,
        idea_id    INT         NOT NULL REFERENCES ai_ideas(id) ON DELETE CASCADE,
        actor      TEXT        NOT NULL,
        action     TEXT        NOT NULL,
        meta       JSONB,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `);
    console.log('[aiChat] Tables ready: ai_chat_threads, ai_chat_messages');
  } catch (err) {
    console.error('[aiChat] ensureAiChatTables failed:', (err as Error).message);
  }
}

// Idempotent table setup for Daily Sales Stock Audit
// Columns match the exact INSERT in server/forms/dailySalesV2.ts → appendAuditLog():
//   INSERT INTO daily_sales_stock_audit (id, "salesId", actor, "actorType", "actionType", "changedFields", "createdAt")
export async function ensureDailySalesAuditTable(): Promise<void> {
  if (!pool) return;
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS daily_sales_stock_audit (
        id             TEXT        NOT NULL,
        "salesId"      TEXT        NOT NULL,
        actor          TEXT        NOT NULL DEFAULT 'unknown',
        "actorType"    TEXT        NOT NULL DEFAULT 'system',
        "actionType"   TEXT        NOT NULL,
        "changedFields" JSONB      NOT NULL DEFAULT '[]'::jsonb,
        "createdAt"    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        PRIMARY KEY (id)
      );
      CREATE INDEX IF NOT EXISTS dssa_sales_id_idx  ON daily_sales_stock_audit("salesId");
      CREATE INDEX IF NOT EXISTS dssa_created_at_idx ON daily_sales_stock_audit("createdAt");
    `);
    console.log('[dailySalesAudit] Table ready: daily_sales_stock_audit');
  } catch (err) {
    console.error('[dailySalesAudit] ensureDailySalesAuditTable failed:', (err as Error).message);
  }
}

// Idempotent Work Register migrations: extends ai_tasks with area/deleted_at,
// adds performance indexes, and creates monitor_events for the monitoring engine.
export async function ensureWorkRegisterTables(): Promise<void> {
  if (!pool) return;
  try {
    await pool.query(`
      ALTER TABLE ai_tasks ADD COLUMN IF NOT EXISTS area               TEXT;
      ALTER TABLE ai_tasks ADD COLUMN IF NOT EXISTS deleted_at          TIMESTAMPTZ;
      ALTER TABLE ai_tasks ADD COLUMN IF NOT EXISTS follow_up_required  BOOLEAN NOT NULL DEFAULT FALSE;
      ALTER TABLE ai_tasks ADD COLUMN IF NOT EXISTS bob_notified_at     TIMESTAMPTZ;
      ALTER TABLE ai_tasks ADD COLUMN IF NOT EXISTS bob_last_error      TEXT;

      CREATE INDEX IF NOT EXISTS ai_tasks_status_updated_idx  ON ai_tasks(status, updated_at DESC);
      CREATE INDEX IF NOT EXISTS ai_tasks_assignee_status_idx ON ai_tasks(assigned_to, status);
      CREATE INDEX IF NOT EXISTS ai_tasks_area_status_idx     ON ai_tasks(area, status);
      CREATE INDEX IF NOT EXISTS ai_tasks_deleted_at_idx      ON ai_tasks(deleted_at) WHERE deleted_at IS NOT NULL;

      CREATE TABLE IF NOT EXISTS monitor_events (
        id           SERIAL       PRIMARY KEY,
        monitor_key  TEXT         NOT NULL,
        event_date   DATE         NOT NULL,
        fingerprint  TEXT         NOT NULL UNIQUE,
        severity     TEXT         NOT NULL DEFAULT 'warning',
        message      TEXT         NOT NULL,
        payload      JSONB,
        fired_at     TIMESTAMPTZ  NOT NULL DEFAULT NOW()
      );
      CREATE INDEX IF NOT EXISTS monitor_events_fired_at_idx ON monitor_events(fired_at DESC);
      CREATE INDEX IF NOT EXISTS monitor_events_key_date_idx ON monitor_events(monitor_key, event_date DESC);
    `);
    console.log('[workRegister] Tables/columns ready: ai_tasks(area, deleted_at), monitor_events');
  } catch (err) {
    console.error('[workRegister] ensureWorkRegisterTables failed:', (err as Error).message);
  }
}

// Database health check function
export async function checkDatabaseHealth(): Promise<boolean> {
  if (!databaseAvailable || !pool) {
    return false;
  }
  try {
    const result = await pool.query('SELECT 1');
    return result.rows.length > 0;
  } catch (error) {
    console.error('Database health check failed:', (error as Error).message);
    return false;
  }
}
