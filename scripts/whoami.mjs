// scripts/whoami.mjs
import pkg from 'pg';
const { Client } = pkg;

const client = new Client({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false }});
await client.connect();
const r = await client.query('SELECT current_user, session_user, current_database() db');
console.log(r.rows[0]);
await client.end();
