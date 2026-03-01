import 'dotenv/config';
import { pool } from '../db';

async function run() {
  if (!pool) {
    throw new Error('DATABASE_URL is required');
  }

  const sql = `
    INSERT INTO ai_agent_profiles (agent_name, name, role, summary, image_url, sort_order)
    VALUES
      ('bob', 'Bob', 'AI Ops Orchestrator', 'Coordinates chat, issues, and ideas workflows with full audit traceability.', 'https://images.unsplash.com/photo-1568602471122-7832951cc4c5?auto=format&fit=crop&w=240&q=80', 1),
      ('jussi', 'Jussi', 'Operations Analyst', 'Owns operational diagnostics and issue triage support for service continuity.', 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&w=240&q=80', 2),
      ('sally', 'Sally', 'Financial Controller', 'Validates cost-impact and approval readiness for proposed issue plans.', 'https://images.unsplash.com/photo-1487412720507-e7ab37603c6f?auto=format&fit=crop&w=240&q=80', 3),
      ('supplier', 'Supplier', 'Procurement Coordinator', 'Supports fulfillment sequencing and supplier-impact execution details.', 'https://images.unsplash.com/photo-1544723795-3fb6469f5b39?auto=format&fit=crop&w=240&q=80', 4),
      ('codex', 'Codex', 'Software Engineer', 'Implements validated fixes with migration discipline and deterministic rollout.', 'https://images.unsplash.com/photo-1521572267360-ee0c2909d518?auto=format&fit=crop&w=240&q=80', 5)
    ON CONFLICT (agent_name)
    DO UPDATE SET
      name = EXCLUDED.name,
      role = EXCLUDED.role,
      summary = EXCLUDED.summary,
      image_url = EXCLUDED.image_url,
      sort_order = EXCLUDED.sort_order,
      updated_at = NOW();

    INSERT INTO ai_agent_state (agent_name, status, status_message, last_seen_at, updated_at)
    VALUES
      ('bob', 'offline', 'Awaiting heartbeat', NULL, NOW()),
      ('jussi', 'offline', 'Awaiting heartbeat', NULL, NOW()),
      ('sally', 'offline', 'Awaiting heartbeat', NULL, NOW()),
      ('supplier', 'offline', 'Awaiting heartbeat', NULL, NOW()),
      ('codex', 'offline', 'Awaiting heartbeat', NULL, NOW())
    ON CONFLICT (agent_name)
    DO UPDATE SET
      status = 'offline',
      status_message = 'Awaiting heartbeat',
      last_seen_at = NULL,
      updated_at = NOW();
  `;

  await pool.query(sql);
  console.log('ai_ops_agents_seed_complete');
}

run()
  .catch((error) => {
    console.error('ai_ops_agents_seed_failed', error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await pool?.end();
  });
