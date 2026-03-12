const { execSync } = require('child_process');
const fs = require('fs');

// List server routes
const routes = fs.readdirSync('server/routes').filter(f => f.endsWith('.ts'));
console.log('=== Server Routes ===');
routes.forEach(r => console.log(' -', r));

// Count open tasks from logs
console.log('\n=== Recent Bob Log Entries ===');
try {
  const log = fs.readFileSync('logs/bob-actions.log', 'utf8');
  const lines = log.trim().split('\n').slice(-5);
  lines.forEach(l => console.log(l || '(empty)'));
} catch { console.log('(no log yet)'); }

console.log('\nScript complete.');
