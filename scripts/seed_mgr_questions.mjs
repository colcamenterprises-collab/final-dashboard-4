import pg from 'pg';
const cs = process.env.DATABASE_URL;
if(!cs){ process.exit(0); }
const c = new pg.Client({ connectionString: cs });
(async()=>{
  await c.connect();
  try {
    const chk = await c.query(`SELECT to_regclass('"ManagerCheckQuestion"') as t`);
    if (!chk.rows[0].t) { console.log('ManagerCheckQuestion table missing, skipping seed'); process.exit(0); }
    const count = await c.query(`SELECT COUNT(1) as n FROM "ManagerCheckQuestion" WHERE enabled=true`);
    const n = Number(count.rows[0].n||0);
    if (n < 4){
      await c.query(`
        INSERT INTO "ManagerCheckQuestion"(text, text_en, text_th, category, enabled, weight, created_at)
        VALUES
        ('Clean grill surfaces','Clean grill surfaces','ทำความสะอาดเตาย่าง','Kitchen End',true,1,now()),
        ('Wipe down prep stations','Wipe down prep stations','เช็ดทำความสะอาดโต๊ะเตรียมอาหาร','Kitchen End',true,1,now()),
        ('Sanitize cutting boards','Sanitize cutting boards','ฆ่าเชื้อเขียง','Kitchen End',true,1,now()),
        ('Clean fryer filters','Clean fryer filters','ทำความสะอาดไส้กรองทอด','Kitchen End',true,1,now()),
        ('Secure cash drawer','Secure cash drawer','ล็อคลิ้นชักเงิน','Cashier End',true,1,now()),
        ('Count register till','Count register till','นับเงินทอนเริ่มต้น','Cashier Start',true,1,now())
        ON CONFLICT DO NOTHING;
      `);
      console.log('Seeded default manager questions');
    }
  } finally { await c.end(); }
})().catch(()=>process.exit(0));
