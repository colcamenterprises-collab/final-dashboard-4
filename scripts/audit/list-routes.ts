#!/usr/bin/env node
// Audit script to list all API routes and pages

import fs from 'fs';
import path from 'path';

function findFiles(dir: string, ext: string): string[] {
  const results: string[] = [];
  
  if (!fs.existsSync(dir)) return results;
  
  const files = fs.readdirSync(dir);
  
  for (const file of files) {
    const filePath = path.join(dir, file);
    const stat = fs.statSync(filePath);
    
    if (stat.isDirectory()) {
      results.push(...findFiles(filePath, ext));
    } else if (file.endsWith(ext)) {
      results.push(filePath);
    }
  }
  
  return results;
}

console.log('📋 ROUTE AUDIT REPORT');
console.log('===================');

// Find API routes
console.log('\n🔗 API ROUTES:');
const apiRoutes = findFiles('server/routes', '.ts')
  .concat(findFiles('server', '.ts'))
  .filter(f => f.includes('route') || f.includes('api'));

apiRoutes.forEach(route => {
  const content = fs.readFileSync(route, 'utf8');
  const methods = content.match(/(app\.(get|post|put|patch|delete))/g) || [];
  console.log(`  ${route}: ${methods.length} endpoints`);
});

// Find React pages
console.log('\n📄 REACT PAGES:');
const pages = findFiles('client/src/pages', '.tsx');
pages.forEach(page => {
  const relativePath = page.replace('client/src/pages/', '');
  console.log(`  /${relativePath.replace('.tsx', '').replace('/index', '')}`);
});

// Find components
console.log('\n🧩 COMPONENTS:');
const components = findFiles('client/src/components', '.tsx');
console.log(`  Found ${components.length} components`);

console.log(`\n📊 SUMMARY:`);
console.log(`  API files: ${apiRoutes.length}`);
console.log(`  Pages: ${pages.length}`);
console.log(`  Components: ${components.length}`);