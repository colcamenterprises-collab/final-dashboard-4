import fs from 'node:fs';
import { execSync } from 'node:child_process';

const run = (command) => execSync(command, { stdio: 'inherit' });

console.log('Rolling back POS shift installer changes...');
run('git checkout -- client/src/App.tsx server/routes/pos.ts');
if (fs.existsSync('client/src/pages/pos/PosShifts.tsx')) {
  fs.rmSync('client/src/pages/pos/PosShifts.tsx');
  console.log('removed client/src/pages/pos/PosShifts.tsx');
}
console.log('Rollback complete. Rebuild and restart the service.');
