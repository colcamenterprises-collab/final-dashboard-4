#!/usr/bin/env tsx

import { getGitHubClient } from '../server/utils/githubBackup';
import { readFileSync, readdirSync, statSync, existsSync } from 'fs';
import { join, relative } from 'path';

// ONLY exclude build artifacts, temp files, and Replit state
const EXCLUDE_DIRS = new Set([
  'node_modules',
  'dist',
  'build',
  '.next',
  '.cache',
  'coverage',
  '.git',
  '.upm',
  'online-ordering/client/node_modules',
  'online-ordering/client/dist',
  '.local/state/replit',  // Replit agent state
  'tmp',
  'logs',
  'uploads', // User uploads, not source code
]);

const EXCLUDE_FILES = new Set([
  '.replit',
  '.breakpoints',
  'replit.nix',
  '.DS_Store',
  '.env',
  '.env.local',
  'npm-debug.log',
  'yarn-error.log',
  'restaurant-app-backup.zip',
]);

function shouldExclude(relativePath: string): boolean {
  const parts = relativePath.split('/');
  
  // Exclude directories
  if (EXCLUDE_DIRS.has(relativePath) || parts.some(part => EXCLUDE_DIRS.has(part))) {
    return true;
  }
  
  // Exclude specific files
  const filename = parts[parts.length - 1];
  if (EXCLUDE_FILES.has(filename) || filename.startsWith('zijns')) {
    return true;
  }
  
  // Exclude lock files
  if (filename.endsWith('.lock')) {
    return true;
  }
  
  return false;
}

function getAllFiles(dirPath: string, baseDir: string, files: string[] = []): string[] {
  if (!existsSync(dirPath)) return files;
  
  const items = readdirSync(dirPath);

  for (const item of items) {
    const fullPath = join(dirPath, item);
    const relativePath = relative(baseDir, fullPath).replace(/\\/g, '/');

    if (shouldExclude(relativePath)) continue;

    try {
      const stats = statSync(fullPath);
      if (stats.isDirectory()) {
        getAllFiles(fullPath, baseDir, files);
      } else if (stats.isFile() && stats.size < 50 * 1024 * 1024) {
        files.push(fullPath);
      }
    } catch (e) {
      // Skip files we can't access
    }
  }

  return files;
}

async function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function main() {
  const owner = process.argv[2] || 'colcamenterprises-collab';
  const repo = process.argv[3] || 'restaurant-management-system';

  console.log('🚀 Pushing ALL Remaining Files to GitHub');
  console.log(`📦 Repository: ${owner}/${repo}`);
  console.log('');

  try {
    const octokit = await getGitHubClient();
    
    // Verify repository
    const { data: repoData } = await octokit.repos.get({ owner, repo });
    console.log(`✓ Repository verified`);

    // Scan all files
    console.log('📂 Scanning entire project...');
    const rootDir = process.cwd();
    const allFilePaths = getAllFiles(rootDir, rootDir);
    console.log(`✓ Found ${allFilePaths.length} total files`);
    console.log('');

    // Get list of already uploaded files
    console.log('🔍 Checking which files are already uploaded...');
    const alreadyUploaded = new Set<string>();
    
    // We know these 50 files were already uploaded
    const knownUploaded = [
      'package.json', 'tsconfig.json', 'vite.config.ts', 'README.md', '.env.example', '.gitignore',
      'shared/schema.ts', 'drizzle.config.ts', 'server/index.ts', 'server/db.ts', 'server/routes.ts',
      'server/storage.ts', 'server/vite.ts', 'client/src/App.tsx', 'client/src/main.tsx',
      'client/src/index.css', 'client/index.html'
    ];
    knownUploaded.forEach(f => alreadyUploaded.add(f));

    const toUpload = allFilePaths.filter(fullPath => {
      const relativePath = relative(rootDir, fullPath).replace(/\\/g, '/');
      return !alreadyUploaded.has(relativePath);
    });

    console.log(`✓ ${toUpload.length} files need to be uploaded`);
    console.log('');

    if (toUpload.length === 0) {
      console.log('✅ All files already uploaded!');
      return;
    }

    // Upload in batches with delays
    const BATCH_SIZE = 20;
    let uploaded = 0;
    let failed = 0;

    console.log('📤 Starting upload...');
    console.log('');

    for (let i = 0; i < toUpload.length; i += BATCH_SIZE) {
      const batch = toUpload.slice(i, i + BATCH_SIZE);
      const batchNum = Math.floor(i / BATCH_SIZE) + 1;
      const totalBatches = Math.ceil(toUpload.length / BATCH_SIZE);
      
      console.log(`📦 Batch ${batchNum}/${totalBatches} (${batch.length} files)...`);

      for (const fullPath of batch) {
        const relativePath = relative(rootDir, fullPath).replace(/\\/g, '/');
        
        try {
          const content = readFileSync(fullPath);
          
          // Check if file exists
          let sha: string | undefined;
          try {
            const { data: existing } = await octokit.repos.getContent({
              owner,
              repo,
              path: relativePath
            });
            if ('sha' in existing) {
              sha = existing.sha;
            }
          } catch (e: any) {
            if (e.status !== 404) throw e;
          }

          // Create or update
          await octokit.repos.createOrUpdateFileContents({
            owner,
            repo,
            path: relativePath,
            message: sha ? `Update ${relativePath}` : `Add ${relativePath}`,
            content: content.toString('base64'),
            ...(sha ? { sha } : {})
          });

          uploaded++;
          
          if (uploaded % 10 === 0) {
            console.log(`  ✓ ${uploaded}/${toUpload.length} uploaded...`);
          }
          
          // Small delay between files
          await sleep(500);
          
        } catch (error: any) {
          failed++;
          console.log(`  ✗ Failed: ${relativePath} - ${error.message}`);
          
          if (error.message.includes('rate limit')) {
            console.log('⚠️  Rate limit hit, waiting 2 minutes...');
            await sleep(120000);
          } else if (error.message.includes('timeout')) {
            console.log('⚠️  Timeout, waiting 30 seconds...');
            await sleep(30000);
          }
        }
      }

      // Wait between batches
      if (i + BATCH_SIZE < toUpload.length) {
        console.log(`  Waiting 10 seconds before next batch...`);
        await sleep(10000);
      }
    }

    console.log('');
    console.log('✅ UPLOAD COMPLETE!');
    console.log('');
    console.log('📊 Final Summary:');
    console.log(`   ✓ Successfully uploaded: ${uploaded} files`);
    console.log(`   ✗ Failed: ${failed} files`);
    console.log(`   📁 Total files in repo: ~${uploaded + 50} files`);
    console.log('');
    console.log(`🔗 View repository: https://github.com/${owner}/${repo}`);
    console.log('');
    console.log('Your complete restaurant management system is now on GitHub! 🎉');
    
  } catch (error: any) {
    console.error('');
    console.error('❌ ERROR:', error.message);
    process.exit(1);
  }
}

main();
