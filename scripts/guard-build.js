#!/usr/bin/env node
/**
 * 🔒 BUILD GUARD - Production Security Lockdown
 * Validates that only approved golden files exist before build
 */

const fs = require('fs');
const path = require('path');

// Golden file list - ONLY these files should exist
const GOLDEN_FILES = [
  'client/src/components/PageShell.tsx',
  'client/src/components/Sidebar.tsx', 
  'client/src/components/ManagerChecklistStatusCard.tsx',
  'client/src/pages/dashboard/Overview.tsx',
  'client/src/pages/operations/DailySalesStock.tsx',
  'client/src/pages/operations/DailySalesLibrary.tsx',
  'client/src/App.tsx',
  'README.locked.md'
];

// Forbidden patterns - files that should NOT exist
const FORBIDDEN_PATTERNS = [
  /DailyShiftForm/,
  /FormView/,
  /FormsLibrary/,
  /PastForms/,
  /backup/i,
  /duplicate/i,
  /copy/i,
  /old/i,
  /temp/i
];

function scanForViolations(dir, violations = []) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    
    if (entry.isDirectory()) {
      // Skip node_modules and other system directories
      if (!['node_modules', '.git', 'dist', 'build'].includes(entry.name)) {
        scanForViolations(fullPath, violations);
      }
    } else if (entry.isFile()) {
      // Check for forbidden patterns
      for (const pattern of FORBIDDEN_PATTERNS) {
        if (pattern.test(entry.name) || pattern.test(fullPath)) {
          violations.push({
            type: 'FORBIDDEN_FILE',
            path: fullPath,
            reason: `Matches forbidden pattern: ${pattern}`
          });
        }
      }
    }
  }
  
  return violations;
}

function validateGoldenFiles() {
  const missing = [];
  
  for (const file of GOLDEN_FILES) {
    if (!fs.existsSync(file)) {
      missing.push(file);
    }
  }
  
  return missing;
}

function main() {
  console.log('🔒 BUILD GUARD: Validating file structure...');
  
  const violations = scanForViolations('client/src');
  const missing = validateGoldenFiles();
  
  if (violations.length > 0) {
    console.error('\n❌ SECURITY VIOLATIONS DETECTED:');
    violations.forEach(v => {
      console.error(`  - ${v.type}: ${v.path}`);
      console.error(`    ${v.reason}`);
    });
  }
  
  if (missing.length > 0) {
    console.error('\n❌ MISSING GOLDEN FILES:');
    missing.forEach(file => {
      console.error(`  - ${file}`);
    });
  }
  
  if (violations.length > 0 || missing.length > 0) {
    console.error('\n🚫 BUILD BLOCKED - Security violations detected');
    console.error('Remove forbidden files and ensure all golden files exist.');
    process.exit(1);
  }
  
  console.log('✅ BUILD GUARD: File structure validated - proceeding with build');
}

if (require.main === module) {
  main();
}

module.exports = { validateGoldenFiles, scanForViolations };