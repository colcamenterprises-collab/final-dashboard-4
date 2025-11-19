#!/usr/bin/env tsx

import { getGitHubClient } from '../server/utils/githubBackup';
import { readFileSync, readdirSync, statSync, existsSync } from 'fs';
import { join, relative } from 'path';

// ONLY exclude build artifacts and temp files, NOT source code
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
  '.local/state/replit',
  'tmp',
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
]);

function shouldExclude(relativePath: string): boolean {
  const parts = relativePath.split('/');
  
  // Check if any part matches excluded directories
  if (EXCLUDE_DIRS.has(relativePath) || parts.some(part => EXCLUDE_DIRS.has(part))) {
    return true;
  }
  
  // Check if filename matches excluded files
  const filename = parts[parts.length - 1];
  if (EXCLUDE_FILES.has(filename)) {
    return true;
  }
  
  return false;
}

interface FileInfo {
  path: string;
  mode: string;
  type: 'blob' | 'tree';
  content?: string;
}

function getAllFiles(dirPath: string, baseDir: string, files: FileInfo[] = []): FileInfo[] {
  if (!existsSync(dirPath)) return files;
  
  const items = readdirSync(dirPath);

  for (const item of items) {
    const fullPath = join(dirPath, item);
    const relativePath = relative(baseDir, fullPath).replace(/\\/g, '/');

    if (shouldExclude(relativePath)) {
      continue;
    }

    try {
      const stats = statSync(fullPath);
      
      if (stats.isDirectory()) {
        getAllFiles(fullPath, baseDir, files);
      } else if (stats.isFile()) {
        // Skip files larger than 50MB
        if (stats.size > 50 * 1024 * 1024) {
          console.log(`⚠️  Skipping large file: ${relativePath} (${(stats.size / 1024 / 1024).toFixed(2)}MB)`);
          continue;
        }
        
        const content = readFileSync(fullPath);
        files.push({
          path: relativePath,
          mode: '100644',
          type: 'blob',
          content: content.toString('base64')
        });
      }
    } catch (e: any) {
      console.log(`⚠️  Skipping ${relativePath}: ${e.message}`);
    }
  }

  return files;
}

async function createCompleteTree(octokit: any, owner: string, repo: string, files: FileInfo[]) {
  console.log('📤 Creating blobs...');
  
  const blobs = await Promise.all(
    files.map(async (file, index) => {
      if (index % 50 === 0) {
        console.log(`  Progress: ${index}/${files.length} blobs created...`);
      }
      
      const { data: blob } = await octokit.git.createBlob({
        owner,
        repo,
        content: file.content!,
        encoding: 'base64'
      });
      
      return {
        path: file.path,
        mode: file.mode,
        type: 'blob' as const,
        sha: blob.sha
      };
    })
  );
  
  console.log(`✓ Created ${blobs.length} blobs`);
  return blobs;
}

async function main() {
  const owner = process.argv[2] || 'colcamenterprises-collab';
  const repo = process.argv[3] || 'restaurant-management-system';

  console.log('🚀 Complete GitHub Push');
  console.log(`📦 Repository: ${owner}/${repo}`);
  console.log('');

  try {
    const octokit = await getGitHubClient();
    
    // Verify repository
    console.log('🔍 Verifying repository...');
    const { data: repoData } = await octokit.repos.get({ owner, repo });
    const defaultBranch = repoData.default_branch || 'main';
    console.log(`✓ Repository found (branch: ${defaultBranch})`);
    console.log('');

    // Scan files
    console.log('📂 Scanning project files...');
    const rootDir = process.cwd();
    const allFiles = getAllFiles(rootDir, rootDir);
    console.log(`✓ Found ${allFiles.length} files to upload`);
    console.log('');

    // Verify critical files are included
    const criticalFiles = [
      'package.json',
      'tsconfig.json',
      'vite.config.ts',
      'README.md',
      '.env.example'
    ];
    
    console.log('🔍 Verifying critical files...');
    for (const critical of criticalFiles) {
      const found = allFiles.find(f => f.path === critical);
      if (found) {
        console.log(`  ✓ ${critical}`);
      } else {
        console.log(`  ✗ MISSING: ${critical}`);
      }
    }
    console.log('');

    // Get current branch reference
    let baseSha: string;
    try {
      const { data: ref } = await octokit.git.getRef({
        owner,
        repo,
        ref: `heads/${defaultBranch}`
      });
      baseSha = ref.object.sha;
      console.log(`✓ Found existing branch: ${defaultBranch}`);
    } catch (e: any) {
      if (e.status === 404) {
        console.log(`⚠️  Branch ${defaultBranch} not found, creating initial commit...`);
        // Create empty tree for first commit
        const { data: emptyTree } = await octokit.git.createTree({
          owner,
          repo,
          tree: []
        });
        baseSha = emptyTree.sha;
      } else {
        throw e;
      }
    }

    // Create blobs
    const treeItems = await createCompleteTree(octokit, owner, repo, allFiles);
    
    // Create tree
    console.log('🌳 Creating tree...');
    const { data: tree } = await octokit.git.createTree({
      owner,
      repo,
      tree: treeItems
    });
    console.log(`✓ Tree created: ${tree.sha}`);
    console.log('');

    // Create commit
    console.log('💾 Creating commit...');
    const timestamp = new Date().toISOString();
    const { data: commit } = await octokit.git.createCommit({
      owner,
      repo,
      message: `Complete backup: Restaurant Management System\n\nIncludes:\n- ${allFiles.length} files\n- Complete frontend (React + TypeScript)\n- Complete backend (Express + PostgreSQL)\n- Prisma + Drizzle schemas\n- All API routes and services\n- Documentation (README + .env.example)\n\nBackup timestamp: ${timestamp}`,
      tree: tree.sha,
      parents: baseSha ? [baseSha] : []
    });
    console.log(`✓ Commit created: ${commit.sha}`);
    console.log('');

    // Update branch
    console.log('📌 Updating branch reference...');
    await octokit.git.updateRef({
      owner,
      repo,
      ref: `heads/${defaultBranch}`,
      sha: commit.sha,
      force: true
    });
    console.log(`✓ Branch ${defaultBranch} updated`);
    console.log('');

    console.log('✅ SUCCESS!');
    console.log('');
    console.log('📊 Push Summary:');
    console.log(`   - Files uploaded: ${allFiles.length}`);
    console.log(`   - Commit SHA: ${commit.sha.substring(0, 8)}`);
    console.log(`   - Branch: ${defaultBranch}`);
    console.log('');
    console.log(`🔗 View repository: https://github.com/${owner}/${repo}`);
    console.log(`📝 View commit: https://github.com/${owner}/${repo}/commit/${commit.sha}`);
    console.log('');
    console.log('Your complete restaurant management system is now on GitHub! 🎉');
    
  } catch (error: any) {
    console.error('');
    console.error('❌ ERROR:', error.message);
    console.error('');
    if (error.response) {
      console.error('GitHub API Response:', error.response.data);
    }
    process.exit(1);
  }
}

main();
