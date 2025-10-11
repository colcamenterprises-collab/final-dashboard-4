import fs from 'fs'; import path from 'path'; import { fileURLToPath } from 'url'; import pg from 'pg';
const __filename=fileURLToPath(import.meta.url), __dirname=path.dirname(__filename);
const MIG_DIR=path.resolve(__dirname,'../server/migrations'); const cs=process.env.DATABASE_URL;
if(!cs){ console.error('DATABASE_URL not set'); process.exit(1); }
const c=new pg.Client({connectionString:cs});
(async()=>{
  await c.connect();
  const files=fs.readdirSync(MIG_DIR).filter(f=>f.endsWith('.sql')).sort();
  for(const f of files){ console.log('>>',f); await c.query(fs.readFileSync(path.join(MIG_DIR,f),'utf8')); }
  await c.end(); console.log('Migrations applied.');
})().catch(async e=>{ console.error(e); try{await c.end();}catch{} process.exit(1);});
