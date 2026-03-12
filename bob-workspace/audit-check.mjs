import fs from 'fs';
import path from 'path';

const root = process.cwd();
const routes = fs.readdirSync(path.join(root, 'server/routes')).filter(f => f.endsWith('.ts'));
const logRaw = fs.existsSync(path.join(root, 'logs/bob-actions.log')) 
  ? fs.readFileSync(path.join(root, 'logs/bob-actions.log'), 'utf8') : '(no log)';
const logLines = logRaw.trim().split('\n').length;

console.log('=== Bob Workspace Audit ===');
console.log('Routes:', routes.length);
routes.forEach(r => console.log(' -', r));
console.log('Log entries:', logLines);
console.log('Bob-workspace files:', fs.readdirSync(path.join(root, 'bob-workspace')).join(', '));
console.log('Scripts count:', fs.readdirSync(path.join(root, 'scripts')).length);
