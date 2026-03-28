import fs from 'fs';

const bobRead = fs.readFileSync('server/routes/bobRead.ts', 'utf8');
const aiOps = fs.readFileSync('server/routes/aiOpsControl.ts', 'utf8');

const requiredRoutes = [
  '/system-map',
  '/module-status',
  '/build-status',
  '/shift-snapshot',
  '/forms/daily-sales',
  '/forms/daily-stock',
  '/receipts/truth',
  '/usage/truth',
  '/issues',
  '/catalog',
  '/orders',
];

const missingRoutes = requiredRoutes.filter((route) => !bobRead.includes(`"${route}"`));
if (missingRoutes.length) {
  console.error('Missing required Bob read routes:', missingRoutes.join(', '));
  process.exit(1);
}

const requiredContractFields = ['ok', 'source', 'scope', 'status', 'data', 'warnings', 'blockers', 'last_updated'];
const missingContractPieces = requiredContractFields.filter((field) => !bobRead.includes(field));
if (missingContractPieces.length) {
  console.error('Missing contract fields in bobRead.ts:', missingContractPieces.join(', '));
  process.exit(1);
}

if (!bobRead.includes('if (req.method !== "GET")')) {
  console.error('GET-only guard not found in bobRead.ts');
  process.exit(1);
}

if (!aiOps.includes('BOB_WRITE_TOKEN') || !aiOps.includes('BOBS_LOYVERSE_WRITE_TOKEN')) {
  console.error('Write-token lockdown for Bob write routes not found in aiOpsControl.ts');
  process.exit(1);
}

console.log('Bob read layer verification passed.');
