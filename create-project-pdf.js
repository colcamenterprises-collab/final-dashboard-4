import fs from 'fs';
import path from 'path';

// Function to recursively get all files
function getAllFiles(dirPath, arrayOfFiles = []) {
  const files = fs.readdirSync(dirPath);

  files.forEach(file => {
    const fullPath = path.join(dirPath, file);
    if (fs.statSync(fullPath).isDirectory()) {
      // Skip certain directories
      if (!['node_modules', '.git', 'dist', 'build', 'logs', 'debug_files', 'extracted_dashboard', 'focused-export', 'exports', 'migrations', '.cache'].includes(file)) {
        arrayOfFiles = getAllFiles(fullPath, arrayOfFiles);
      }
    } else {
      // Include relevant file types
      const ext = path.extname(file);
      if (['.ts', '.tsx', '.js', '.jsx', '.json', '.md', '.html', '.css', '.sql'].includes(ext) || 
          ['package.json', 'tsconfig.json', 'vite.config.ts', 'tailwind.config.ts', 'postcss.config.js', 'drizzle.config.ts'].includes(file)) {
        arrayOfFiles.push(fullPath);
      }
    }
  });

  return arrayOfFiles;
}

// Get all project files
console.log('Collecting project files...');
const projectFiles = getAllFiles('.');

// Create comprehensive text content
let textContent = `SMASH BROTHERS BURGERS - RESTAURANT MANAGEMENT SYSTEM
=====================================================

This document contains the complete source code and configuration for the 
restaurant management system project.

Generated: ${new Date().toISOString()}
Total Files: ${projectFiles.length}

`;

// Add table of contents
textContent += `\nTABLE OF CONTENTS\n`;
textContent += `=================\n`;
projectFiles.forEach((file, index) => {
  textContent += `${index + 1}. ${file}\n`;
});
textContent += `\n`;

// Add file contents
projectFiles.forEach((file, index) => {
  try {
    const content = fs.readFileSync(file, 'utf8');
    const relativePath = path.relative('.', file);
    
    textContent += `\n${'='.repeat(80)}\n`;
    textContent += `FILE ${index + 1}: ${relativePath}\n`;
    textContent += `${'='.repeat(80)}\n`;
    textContent += content;
    textContent += `\n\n`;
  } catch (error) {
    console.log(`Skipping ${file}: ${error.message}`);
  }
});

// Write to text file
fs.writeFileSync('restaurant-management-complete.txt', textContent);

console.log('Project documentation created as restaurant-management-complete.txt');
console.log(`File size: ${Math.round(fs.statSync('restaurant-management-complete.txt').size / 1024)} KB`);