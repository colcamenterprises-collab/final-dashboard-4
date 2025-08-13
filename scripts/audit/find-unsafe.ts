#!/usr/bin/env node
// Find unsafe database operations and mutating calls

import fs from 'fs';
import path from 'path';

function findFiles(dir: string, extensions: string[]): string[] {
  const results: string[] = [];
  
  if (!fs.existsSync(dir)) return results;
  
  const files = fs.readdirSync(dir);
  
  for (const file of files) {
    const filePath = path.join(dir, file);
    const stat = fs.statSync(filePath);
    
    if (stat.isDirectory()) {
      results.push(...findFiles(filePath, extensions));
    } else if (extensions.some(ext => file.endsWith(ext))) {
      results.push(filePath);
    }
  }
  
  return results;
}

const unsafePatterns = [
  { pattern: /prisma\.\$executeRaw/g, desc: 'Raw SQL execution' },
  { pattern: /prisma\.\$queryRaw.*(?:DELETE|UPDATE|INSERT|DROP|ALTER)/gi, desc: 'Dangerous raw query' },
  { pattern: /\.delete\s*\(/g, desc: 'Prisma delete operation' },
  { pattern: /\.deleteMany\s*\(/g, desc: 'Prisma deleteMany operation' },
  { pattern: /fetch.*method:\s*['"](POST|PUT|PATCH|DELETE)['"]/gi, desc: 'Mutating HTTP call' },
  { pattern: /axios\.(post|put|patch|delete)/gi, desc: 'Mutating Axios call' }
];

console.log('🚨 UNSAFE OPERATIONS AUDIT');
console.log('==========================');

const files = [
  ...findFiles('server', ['.ts', '.js']),
  ...findFiles('client/src', ['.tsx', '.ts', '.jsx', '.js'])
];

let totalFindings = 0;

for (const file of files) {
  const content = fs.readFileSync(file, 'utf8');
  const findings: Array<{line: number, pattern: string, desc: string}> = [];
  
  for (const { pattern, desc } of unsafePatterns) {
    const lines = content.split('\n');
    lines.forEach((line, index) => {
      if (pattern.test(line)) {
        findings.push({ line: index + 1, pattern: line.trim(), desc });
      }
    });
  }
  
  if (findings.length > 0) {
    console.log(`\n⚠️  ${file}:`);
    findings.forEach(f => {
      console.log(`  Line ${f.line}: ${f.desc} - ${f.pattern.substring(0, 80)}...`);
    });
    totalFindings += findings.length;
  }
}

if (totalFindings === 0) {
  console.log('\n✅ No unsafe operations detected!');
} else {
  console.log(`\n📊 Total findings: ${totalFindings}`);
}