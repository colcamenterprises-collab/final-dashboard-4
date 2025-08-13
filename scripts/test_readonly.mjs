import pkg from 'pg';
const { Client } = pkg;

const client = new Client({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

(async () => {
  try {
    await client.connect();
    console.log("Connected as:", process.env.DATABASE_URL);

    // This should fail if DB is truly read-only
    const res = await client.query(`
      INSERT INTO expenses (description, category, amount, "createdAt")
      VALUES ('TEST WRITE - SHOULD FAIL', 'TEST', 0, NOW());
    `);

    console.log("WRITE SUCCEEDED ❌", res);
  } catch (err) {
    console.error("Expected failure ✅:", err.message);
  } finally {
    await client.end();
  }
})();
