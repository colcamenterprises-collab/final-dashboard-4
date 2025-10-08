#!/usr/bin/env bash
set -euo pipefail

# Usage:
#   Ensure PGHOST, PGPORT, PGUSER, PGPASSWORD, PGDATABASE are set.
#   Then run: ./make_ground_zero_report.sh
# Output:
#   ground-zero-schema.md in cwd.

OUT="ground-zero-schema.md"
NOW_UTC=$(date -u +"%Y-%m-%d %H:%M:%S UTC")

# Helper to run psql and format as Markdown tables.
q() {
  local sql="$1"
  psql -v "ON_ERROR_STOP=1" --no-align --tuples-only -F ' | ' -c "$sql" \
  | sed '1s/^/| /; 1s/ | / | /g; 1s/$/ |/; 2s/^/|---|/' \
  | sed '2s/ | / | /g'
}

# Title
cat > "$OUT" <<EOF
# Ground-Zero Schema Summary

**Generated:** $NOW_UTC

This document reflects the **current** Postgres schema as the single source of truth.

> Scope: tables, columns, primary/foreign keys, indexes, enums/domains, views/materialized views, approximate row counts, and integrity sanity checks.

---
EOF

# Database identity
{
  echo "## Database Identity"
  q "select current_database() as database, current_schema() as schema, version() as postgres_version;"
  echo
} >> "$OUT"

# Schemas present
{
  echo "## Schemas Present"
  q "select schema_name from information_schema.schemata order by schema_name;"
  echo
} >> "$OUT"

# Enums (domains too)
{
  echo "## Enums"
  q "
  select n.nspname as schema, t.typname as enum_name, e.enumlabel as value
  from pg_type t
  join pg_enum e on t.oid = e.enumtypid
  join pg_catalog.pg_namespace n on n.oid = t.typnamespace
  order by schema, enum_name, e.enumsortorder;
  "
  echo
  echo "## Domains"
  q "
  select domain_schema, domain_name, data_type
  from information_schema.domains
  order by domain_schema, domain_name;
  "
  echo
} >> "$OUT"

# Tables list with approx rows
{
  echo "## Tables (Approx Row Counts)"
  q "
  select schemaname as schema, relname as tbl, pg_total_relation_size(relid) as bytes_total,
         coalesce((select n_live_tup from pg_stat_user_tables s where s.relid=c.relid),0) as est_rows
  from pg_catalog.pg_statio_user_tables c
  order by bytes_total desc;
  "
  echo
} >> "$OUT"

# Columns per table
{
  echo "## Columns"
  q "
  select table_schema as schema, table_name as tbl, column_name, ordinal_position as pos,
         data_type, is_nullable, column_default
  from information_schema.columns
  where table_schema not in ('pg_catalog','information_schema')
  order by schema, tbl, pos;
  "
  echo
} >> "$OUT"

# Primary keys
{
  echo "## Primary Keys"
  q "
  select
    n.nspname as schema,
    c.relname as tbl,
    a.attname as col
  from pg_index i
    join pg_class c on c.oid = i.indrelid
    join pg_namespace n on n.oid = c.relnamespace
    join pg_attribute a on a.attrelid = c.oid and a.attnum = any(i.indkey)
  where i.indisprimary
  order by schema, tbl, col;
  "
  echo
} >> "$OUT"

# Foreign keys
{
  echo "## Foreign Keys"
  q "
  select
    tc.constraint_name,
    tc.table_schema as schema,
    tc.table_name as tbl,
    kcu.column_name as col,
    ccu.table_schema as fk_schema,
    ccu.table_name as fk_tbl,
    ccu.column_name as fk_col,
    rc.update_rule as on_update,
    rc.delete_rule as on_delete
  from information_schema.table_constraints tc
  join information_schema.key_column_usage kcu
    on tc.constraint_name = kcu.constraint_name and tc.table_schema = kcu.table_schema
  join information_schema.referential_constraints rc
    on tc.constraint_name = rc.constraint_name and tc.table_schema = rc.constraint_schema
  join information_schema.constraint_column_usage ccu
    on ccu.constraint_name = rc.constraint_name and ccu.constraint_schema = rc.constraint_schema
  where tc.constraint_type = 'FOREIGN KEY'
  order by schema, tbl, constraint_name, kcu.ordinal_position;
  "
  echo
} >> "$OUT"

# Indexes
{
  echo "## Indexes (incl. uniques)"
  q "
  select
    n.nspname as schema,
    t.relname as tbl,
    i.relname as idx,
    pg_get_indexdef(ix.indexrelid) as definition,
    ix.indisunique as is_unique
  from pg_index ix
  join pg_class i on i.oid = ix.indexrelid
  join pg_class t on t.oid = ix.indrelid
  join pg_namespace n on n.oid = t.relnamespace
  where n.nspname not in ('pg_catalog','information_schema')
  order by schema, tbl, is_unique desc, idx;
  "
  echo
} >> "$OUT"

# Views and materialized views
{
  echo "## Views"
  q "
  select table_schema as schema, table_name as view_name
  from information_schema.views
  where table_schema not in ('pg_catalog','information_schema')
  order by schema, view_name;
  "
  echo
  echo "## Materialized Views"
  q "
  select n.nspname as schema, c.relname as matview
  from pg_class c
  join pg_namespace n on n.oid = c.relnamespace
  where c.relkind = 'm'
  order by schema, matview;
  "
  echo
} >> "$OUT"

# Constraints (CHECK, UNIQUE, etc.)
{
  echo "## Constraints (CHECK, UNIQUE, etc.)"
  q "
  select
    tc.constraint_schema as schema,
    tc.table_name as tbl,
    tc.constraint_name,
    tc.constraint_type,
    coalesce(cc.check_clause, '') as definition
  from information_schema.table_constraints tc
  left join information_schema.check_constraints cc
    on tc.constraint_name = cc.constraint_name and tc.constraint_schema = cc.constraint_schema
  where tc.constraint_type not in ('PRIMARY KEY', 'FOREIGN KEY')
    and tc.constraint_schema not in ('pg_catalog','information_schema')
  order by schema, tbl, constraint_type, constraint_name;
  "
  echo
} >> "$OUT"

# Sequences
{
  echo "## Sequences"
  q "
  select sequence_schema as schema, sequence_name, data_type, increment, minimum_value, maximum_value
  from information_schema.sequences
  where sequence_schema not in ('pg_catalog','information_schema')
  order by schema, sequence_name;
  "
  echo
} >> "$OUT"

# Triggers
{
  echo "## Triggers"
  q "
  select
    trigger_schema as schema,
    event_object_table as tbl,
    trigger_name,
    event_manipulation as event,
    action_timing as timing,
    action_orientation as orientation
  from information_schema.triggers
  where trigger_schema not in ('pg_catalog','information_schema')
  order by schema, tbl, trigger_name;
  "
  echo
} >> "$OUT"

# Functions/Procedures
{
  echo "## Functions and Procedures"
  q "
  select
    n.nspname as schema,
    p.proname as name,
    pg_get_function_result(p.oid) as return_type,
    pg_get_function_arguments(p.oid) as arguments
  from pg_proc p
  join pg_namespace n on n.oid = p.pronamespace
  where n.nspname not in ('pg_catalog','information_schema')
  order by schema, name;
  "
  echo
} >> "$OUT"

# Integrity checks
{
  echo "## Integrity Sanity Checks"
  echo
  echo "### Tables Without Primary Keys"
  q "
  select
    t.table_schema as schema,
    t.table_name as tbl
  from information_schema.tables t
  where t.table_schema not in ('pg_catalog','information_schema')
    and t.table_type = 'BASE TABLE'
    and not exists (
      select 1 from information_schema.table_constraints tc
      where tc.table_schema = t.table_schema
        and tc.table_name = t.table_name
        and tc.constraint_type = 'PRIMARY KEY'
    )
  order by schema, tbl;
  "
  echo
  echo "### Foreign Keys Without Indexes (Performance Risk)"
  q "
  select
    tc.table_schema as schema,
    tc.table_name as tbl,
    kcu.column_name as fk_col,
    'Missing index on FK column' as issue
  from information_schema.table_constraints tc
  join information_schema.key_column_usage kcu
    on tc.constraint_name = kcu.constraint_name and tc.table_schema = kcu.table_schema
  where tc.constraint_type = 'FOREIGN KEY'
    and tc.table_schema not in ('pg_catalog','information_schema')
    and not exists (
      select 1
      from pg_index ix
      join pg_class c on c.oid = ix.indrelid
      join pg_namespace n on n.oid = c.relnamespace
      join pg_attribute a on a.attrelid = c.oid and a.attnum = any(ix.indkey)
      where n.nspname = tc.table_schema
        and c.relname = tc.table_name
        and a.attname = kcu.column_name
    )
  order by schema, tbl, fk_col;
  "
  echo
  echo "### Tables With Excessive NULL Columns (> 50% nullable)"
  q "
  select
    table_schema as schema,
    table_name as tbl,
    count(*) filter (where is_nullable = 'YES') as nullable_cols,
    count(*) as total_cols,
    round(100.0 * count(*) filter (where is_nullable = 'YES') / count(*), 1) as pct_nullable
  from information_schema.columns
  where table_schema not in ('pg_catalog','information_schema')
  group by schema, tbl
  having count(*) filter (where is_nullable = 'YES') * 1.0 / count(*) > 0.5
  order by pct_nullable desc;
  "
  echo
} >> "$OUT"

# Database size summary
{
  echo "## Database Size Summary"
  q "
  select
    pg_size_pretty(pg_database_size(current_database())) as total_db_size,
    pg_size_pretty(sum(pg_total_relation_size(c.oid))) as total_tables_size,
    pg_size_pretty(sum(pg_indexes_size(c.oid))) as total_indexes_size
  from pg_class c
  join pg_namespace n on n.oid = c.relnamespace
  where n.nspname not in ('pg_catalog','information_schema')
    and c.relkind = 'r';
  "
  echo
} >> "$OUT"

# Top 10 largest tables
{
  echo "## Top 10 Largest Tables"
  q "
  select
    n.nspname as schema,
    c.relname as tbl,
    pg_size_pretty(pg_total_relation_size(c.oid)) as total_size,
    pg_size_pretty(pg_relation_size(c.oid)) as table_size,
    pg_size_pretty(pg_indexes_size(c.oid)) as indexes_size,
    coalesce((select n_live_tup from pg_stat_user_tables s where s.relid=c.oid),0) as est_rows
  from pg_class c
  join pg_namespace n on n.oid = c.relnamespace
  where n.nspname not in ('pg_catalog','information_schema')
    and c.relkind = 'r'
  order by pg_total_relation_size(c.oid) desc
  limit 10;
  "
  echo
} >> "$OUT"

# Extension summary
{
  echo "## Installed Extensions"
  q "
  select extname as extension, extversion as version
  from pg_extension
  order by extname;
  "
  echo
} >> "$OUT"

# Footer
{
  echo "---"
  echo
  echo "**End of Ground-Zero Schema Report**"
  echo
  echo "Generated by: \`make_ground_zero_report.sh\`"
  echo
  echo "To regenerate: Ensure PostgreSQL environment variables are set, then run:"
  echo "\`\`\`bash"
  echo "export PGHOST=<host> PGPORT=<port> PGUSER=<user> PGPASSWORD=<password> PGDATABASE=<database>"
  echo "./make_ground_zero_report.sh"
  echo "\`\`\`"
  echo
} >> "$OUT"

echo "✅ Ground-zero schema report generated: $OUT"
