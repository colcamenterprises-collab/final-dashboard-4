const fs = require('fs');
const path = require('path');

/**
 * Simple glob-like function to check patterns
 */
function matchesPattern(filePath, pattern) {
  // Convert glob pattern to regex
  const regexPattern = pattern
    .replace(/\*\*/g, '.*')
    .replace(/\*/g, '[^/]*')
    .replace(/\./g, '\\.');
  
  const regex = new RegExp('^' + regexPattern + '$');
  return regex.test(filePath);
}

/**
 * Recursively find files matching patterns
 */
function findFiles(dir, patterns, results = []) {
  if (!fs.existsSync(dir)) return results;
  
  const files = fs.readdirSync(dir);
  
  for (const file of files) {
    const filePath = path.join(dir, file);
    const relativePath = path.relative('.', filePath);
    
    // Skip archive directory
    if (relativePath.startsWith('archive/')) continue;
    
    const stat = fs.statSync(filePath);
    
    if (stat.isDirectory()) {
      findFiles(filePath, patterns, results);
    } else {
      // Check if file matches any banned pattern
      for (const pattern of patterns) {
        if (matchesPattern(relativePath, pattern)) {
          results.push(relativePath);
          break;
        }
      }
    }
  }
  
  return results;
}

(async () => {
  const banned = [
    'client/src/pages/**/*.bak*',
    'client/src/pages/**/*.backup*',
    'debug_files/**',
    'routes.ts/**',
    'client/public/daily_sales_form_locked.html'
  ];
  
  const found = findFiles('.', banned);
  
  if (found.length) {
    console.error('❌ Legacy files detected outside archive:\n' + found.map(f => ' - ' + f).join('\n'));
    process.exit(1);
  }
  
  console.log('✅ No legacy drift detected.');
})();