#!/usr/bin/env tsx

import { getGitHubClient } from '../server/utils/githubBackup';
import { readFileSync, readdirSync, statSync, existsSync } from 'fs';
import { join, relative, sep } from 'path';

// Files and directories to ignore
const IGNORE_PATTERNS = [
  'node_modules',
  '.git',
  '.replit',
  '.config',
  '.cache',
  'dist',
  '.next',
  'build',
  'coverage',
  '.DS_Store',
  '.env',
  '.env.local',
  '.env.*.local',
  'npm-debug.log',
  'yarn-debug.log',
  'yarn-error.log',
  '.upm',
  'replit.nix',
  '.breakpoints',
  'attached_assets',
  'online-ordering/client/dist',
  'online-ordering/client/node_modules',
  'tmp',
  'logs',
  '.git',
  'scripts/uploadToGitHub.ts' // Don't upload this script itself
];

function shouldIgnore(filePath: string): boolean {
  const normalized = filePath.replace(/\\/g, '/');
  return IGNORE_PATTERNS.some(pattern => {
    const parts = normalized.split('/');
    return parts.includes(pattern) || normalized.startsWith(pattern + '/');
  });
}

function getAllFiles(dirPath: string, arrayOfFiles: string[] = []): string[] {
  if (!existsSync(dirPath)) return arrayOfFiles;
  
  const files = readdirSync(dirPath);

  files.forEach(file => {
    const filePath = join(dirPath, file);
    const relativePath = relative(process.cwd(), filePath).replace(/\\/g, '/');

    if (shouldIgnore(relativePath)) {
      return;
    }

    try {
      if (statSync(filePath).isDirectory()) {
        arrayOfFiles = getAllFiles(filePath, arrayOfFiles);
      } else {
        // Check file size - skip files larger than 25MB
        const stats = statSync(filePath);
        if (stats.size < 25 * 1024 * 1024) {
          arrayOfFiles.push(filePath);
        } else {
          console.log(`⚠️  Skipping large file: ${relativePath} (${(stats.size / 1024 / 1024).toFixed(2)}MB)`);
        }
      }
    } catch (e) {
      console.log(`⚠️  Skipping file: ${relativePath} (access error)`);
    }
  });

  return arrayOfFiles;
}

async function uploadInBatches(octokit: any, owner: string, repo: string, files: string[], rootDir: string) {
  const BATCH_SIZE = 50; // GitHub API rate limit consideration
  let uploaded = 0;
  let skipped = 0;

  for (let i = 0; i < files.length; i += BATCH_SIZE) {
    const batch = files.slice(i, i + BATCH_SIZE);
    console.log(`📤 Uploading batch ${Math.floor(i / BATCH_SIZE) + 1}/${Math.ceil(files.length / BATCH_SIZE)} (${batch.length} files)...`);

    const results = await Promise.allSettled(
      batch.map(async (filePath) => {
        const relativePath = relative(rootDir, filePath).replace(/\\/g, '/');
        const content = readFileSync(filePath);
        const base64Content = content.toString('base64');

        try {
          // Check if file exists first
          let sha: string | undefined;
          try {
            const { data: existingFile } = await octokit.repos.getContent({
              owner,
              repo,
              path: relativePath
            });
            if ('sha' in existingFile) {
              sha = existingFile.sha;
            }
          } catch (e: any) {
            if (e.status !== 404) throw e;
            // File doesn't exist, will create new
          }

          // Create or update file
          await octokit.repos.createOrUpdateFileContents({
            owner,
            repo,
            path: relativePath,
            message: sha ? `Update ${relativePath}` : `Add ${relativePath}`,
            content: base64Content,
            ...(sha ? { sha } : {})
          });

          return { success: true, path: relativePath };
        } catch (error: any) {
          return { success: false, path: relativePath, error: error.message };
        }
      })
    );

    results.forEach((result, index) => {
      if (result.status === 'fulfilled' && result.value.success) {
        uploaded++;
        if (uploaded % 10 === 0) {
          console.log(`  ✓ ${uploaded} files uploaded...`);
        }
      } else {
        skipped++;
        const path = result.status === 'fulfilled' ? result.value.path : batch[index];
        console.log(`  ✗ Failed: ${path}`);
      }
    });

    // Rate limit pause between batches
    if (i + BATCH_SIZE < files.length) {
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
  }

  return { uploaded, skipped };
}

async function main() {
  const owner = process.argv[2] || 'colcamenterprises-collab';
  const repo = process.argv[3] || 'restaurant-management-system';

  console.log('🔄 Uploading to GitHub...');
  console.log(`📦 Repository: ${owner}/${repo}`);
  console.log('');

  try {
    const octokit = await getGitHubClient();
    
    // Verify repository exists
    try {
      await octokit.repos.get({ owner, repo });
      console.log('✓ Repository found');
    } catch (e) {
      console.error('❌ Repository not found. Make sure it exists first.');
      process.exit(1);
    }

    console.log('');
    console.log('📂 Scanning files...');
    const rootDir = process.cwd();
    const allFiles = getAllFiles(rootDir);
    
    console.log(`✓ Found ${allFiles.length} files to upload`);
    console.log('');

    const { uploaded, skipped } = await uploadInBatches(octokit, owner, repo, allFiles, rootDir);

    console.log('');
    console.log('✅ UPLOAD COMPLETE!');
    console.log(`📊 Statistics:`);
    console.log(`   - Uploaded: ${uploaded} files`);
    console.log(`   - Skipped: ${skipped} files`);
    console.log(`   - Total: ${allFiles.length} files`);
    console.log('');
    console.log(`🔗 View your repository: https://github.com/${owner}/${repo}`);
    console.log('');
    
  } catch (error: any) {
    console.error('');
    console.error('❌ ERROR:', error.message);
    console.error('');
    process.exit(1);
  }
}

main();
