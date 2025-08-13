#!/usr/bin/env node
// Find large files that bloat builds

import fs from 'fs';
import path from 'path';

function findFiles(dir: string): Array<{path: string, size: number}> {
  const results: Array<{path: string, size: number}> = [];
  
  if (!fs.existsSync(dir)) return results;
  
  const files = fs.readdirSync(dir);
  
  for (const file of files) {
    const filePath = path.join(dir, file);
    const stat = fs.statSync(filePath);
    
    if (stat.isDirectory() && !file.includes('node_modules') && !file.includes('.git')) {
      results.push(...findFiles(filePath));
    } else if (stat.isFile()) {
      results.push({ path: filePath, size: stat.size });
    }
  }
  
  return results;
}

console.log('📦 LARGE FILES AUDIT');
console.log('===================');

const files = findFiles('.');
const largeSizeThreshold = 300 * 1024; // 300KB
const largeFiles = files
  .filter(f => f.size > largeSizeThreshold)
  .sort((a, b) => b.size - a.size);

if (largeFiles.length === 0) {
  console.log('\n✅ No files larger than 300KB found!');
} else {
  console.log('\n🚨 Files larger than 300KB:');
  largeFiles.forEach(file => {
    const sizeKB = Math.round(file.size / 1024);
    const sizeMB = (file.size / (1024 * 1024)).toFixed(1);
    console.log(`  ${file.path}: ${sizeKB}KB (${sizeMB}MB)`);
  });
}

// Check for duplicate or redundant files
console.log('\n🔍 POTENTIAL DUPLICATES:');
const duplicatePatterns = [
  /.*\.backup\./,
  /.*\.old\./,
  /.*\.temp\./,
  /.*-backup$/,
  /.*-old$/,
  /.*\.bak$/,
];

const potentialDuplicates = files.filter(f => 
  duplicatePatterns.some(pattern => pattern.test(f.path))
);

if (potentialDuplicates.length > 0) {
  potentialDuplicates.forEach(file => {
    const sizeKB = Math.round(file.size / 1024);
    console.log(`  ${file.path}: ${sizeKB}KB`);
  });
} else {
  console.log('  None found');
}

console.log(`\n📊 SUMMARY:`);
console.log(`  Total files scanned: ${files.length}`);
console.log(`  Large files (>300KB): ${largeFiles.length}`);
console.log(`  Potential duplicates: ${potentialDuplicates.length}`);