import pg from "pg";
const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
const client = await pool.connect();

const { rows } = await client.query(`
  SELECT indexname, tablename, indexdef
  FROM pg_indexes
  WHERE indexdef ILIKE '%COALESCE%'
  AND schemaname = 'public'
`);
console.log("COALESCE indexes in live DB:");
console.log(JSON.stringify(rows, null, 2));

const { rows: staffTables } = await client.query(`
  SELECT table_name FROM information_schema.tables
  WHERE table_schema='public'
  AND table_name IN (
    'operations_settings','operating_hours','work_areas','shift_templates',
    'staff_members','staff_availability','shift_rosters','shift_staff_assignments',
    'shift_breaks','cleaning_task_templates','shift_cleaning_tasks',
    'deep_cleaning_tasks','shift_attendance_logs','shift_change_log'
  )
  ORDER BY table_name
`);
console.log("\nStaff ops tables present:", staffTables.map((r: any) => r.table_name));

const { rows: enumRows } = await client.query(`
  SELECT typname FROM pg_type
  WHERE typtype = 'e'
  AND typname IN (
    'staff_roster_status','staff_attendance_status','staff_break_type',
    'cleaning_task_type','cleaning_task_frequency','shift_cleaning_task_status',
    'deep_cleaning_status','shift_change_type'
  )
  ORDER BY typname
`);
console.log("Staff ops enums present:", enumRows.map((r: any) => r.typname));

client.release();
await pool.end();
