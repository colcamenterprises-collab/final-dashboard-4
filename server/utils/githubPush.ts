import { Octokit } from '@octokit/rest';
import { readFileSync, readdirSync, statSync } from 'fs';
import { join, relative } from 'path';

let connectionSettings: any;

async function getAccessToken() {
  if (connectionSettings && connectionSettings.settings.expires_at && new Date(connectionSettings.settings.expires_at).getTime() > Date.now()) {
    return connectionSettings.settings.access_token;
  }
  
  const hostname = process.env.REPLIT_CONNECTORS_HOSTNAME;
  const xReplitToken = process.env.REPL_IDENTITY 
    ? 'repl ' + process.env.REPL_IDENTITY 
    : process.env.WEB_REPL_RENEWAL 
    ? 'depl ' + process.env.WEB_REPL_RENEWAL 
    : null;

  if (!xReplitToken) {
    throw new Error('X_REPLIT_TOKEN not found for repl/depl');
  }

  connectionSettings = await fetch(
    'https://' + hostname + '/api/v2/connection?include_secrets=true&connector_names=github',
    {
      headers: {
        'Accept': 'application/json',
        'X_REPLIT_TOKEN': xReplitToken
      }
    }
  ).then(res => res.json()).then(data => data.items?.[0]);

  const accessToken = connectionSettings?.settings?.access_token || connectionSettings.settings?.oauth?.credentials?.access_token;

  if (!connectionSettings || !accessToken) {
    throw new Error('GitHub not connected');
  }
  return accessToken;
}

export async function getGitHubClient() {
  const accessToken = await getAccessToken();
  return new Octokit({ auth: accessToken });
}

// Directories and files to ignore
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
  'logs'
];

function shouldIgnore(filePath: string): boolean {
  const parts = filePath.split('/');
  return IGNORE_PATTERNS.some(pattern => {
    return parts.some(part => part === pattern) || filePath.includes(pattern);
  });
}

function getAllFiles(dirPath: string, arrayOfFiles: string[] = []): string[] {
  const files = readdirSync(dirPath);

  files.forEach(file => {
    const filePath = join(dirPath, file);
    const relativePath = relative(process.cwd(), filePath);

    if (shouldIgnore(relativePath)) {
      return;
    }

    if (statSync(filePath).isDirectory()) {
      arrayOfFiles = getAllFiles(filePath, arrayOfFiles);
    } else {
      arrayOfFiles.push(filePath);
    }
  });

  return arrayOfFiles;
}

export async function pushToGitHub(owner: string, repo: string) {
  const octokit = await getGitHubClient();
  
  console.log('📂 Scanning files...');
  const rootDir = process.cwd();
  const allFiles = getAllFiles(rootDir);
  
  console.log(`📦 Found ${allFiles.length} files to upload`);
  
  // Get default branch
  const { data: repoData } = await octokit.repos.get({ owner, repo });
  const defaultBranch = repoData.default_branch || 'main';
  
  // Create or get the branch reference
  let branchSha: string;
  try {
    const { data: ref } = await octokit.git.getRef({
      owner,
      repo,
      ref: `heads/${defaultBranch}`
    });
    branchSha = ref.object.sha;
  } catch {
    // Branch doesn't exist, create it
    const { data: mainRef } = await octokit.git.getRef({
      owner,
      repo,
      ref: 'heads/main'
    });
    branchSha = mainRef.object.sha;
  }
  
  // Get the current commit
  const { data: currentCommit } = await octokit.git.getCommit({
    owner,
    repo,
    commit_sha: branchSha
  });
  
  // Create blobs for all files
  console.log('📤 Uploading files...');
  const blobs = await Promise.all(
    allFiles.map(async (filePath) => {
      const content = readFileSync(filePath);
      const relativePath = relative(rootDir, filePath);
      
      const { data: blob } = await octokit.git.createBlob({
        owner,
        repo,
        content: content.toString('base64'),
        encoding: 'base64'
      });
      
      return {
        path: relativePath,
        mode: '100644' as const,
        type: 'blob' as const,
        sha: blob.sha
      };
    })
  );
  
  console.log('🌳 Creating tree...');
  const { data: tree } = await octokit.git.createTree({
    owner,
    repo,
    tree: blobs,
    base_tree: currentCommit.tree.sha
  });
  
  console.log('💾 Creating commit...');
  const timestamp = new Date().toISOString();
  const { data: commit } = await octokit.git.createCommit({
    owner,
    repo,
    message: `Backup: Restaurant Management System - ${timestamp}`,
    tree: tree.sha,
    parents: [branchSha]
  });
  
  console.log('🚀 Updating branch...');
  await octokit.git.updateRef({
    owner,
    repo,
    ref: `heads/${defaultBranch}`,
    sha: commit.sha
  });
  
  console.log('✅ Push complete!');
  
  return {
    success: true,
    commitSha: commit.sha,
    filesUploaded: allFiles.length,
    repoUrl: `https://github.com/${owner}/${repo}`
  };
}
