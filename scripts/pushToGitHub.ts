#!/usr/bin/env tsx

import { getGitHubClient } from '../server/utils/githubBackup';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

async function getAccessToken() {
  const hostname = process.env.REPLIT_CONNECTORS_HOSTNAME;
  const xReplitToken = process.env.REPL_IDENTITY 
    ? 'repl ' + process.env.REPL_IDENTITY 
    : process.env.WEB_REPL_RENEWAL 
    ? 'depl ' + process.env.WEB_REPL_RENEWAL 
    : null;

  if (!xReplitToken) {
    throw new Error('X_REPLIT_TOKEN not found');
  }

  const connectionSettings = await fetch(
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

async function main() {
  const owner = process.argv[2] || 'colcamenterprises-collab';
  const repo = process.argv[3] || 'restaurant-management-system';

  console.log('🔄 Pushing to GitHub...');
  console.log(`📦 Repository: ${owner}/${repo}`);
  console.log('');

  try {
    // Get GitHub token
    const token = await getAccessToken();
    const octokit = await getGitHubClient();
    const { data: user } = await octokit.users.getAuthenticated();
    
    // Remove lock files if they exist
    try {
      await execAsync('rm -f .git/*.lock .git/refs/heads/*.lock 2>/dev/null || true');
    } catch (e) {
      // Ignore errors
    }

    // Configure git
    console.log('⚙️  Configuring git...');
    await execAsync(`git config user.name "${user.login}"`);
    await execAsync(`git config user.email "${user.email || user.login + '@users.noreply.github.com'}"`);

    // Check current remote
    let remoteUrl: string;
    try {
      const { stdout } = await execAsync('git remote get-url origin');
      remoteUrl = stdout.trim();
      console.log(`📡 Current remote: ${remoteUrl}`);
    } catch {
      // No remote exists, add one
      remoteUrl = `https://github.com/${owner}/${repo}.git`;
      console.log(`📡 Adding remote: ${remoteUrl}`);
      await execAsync(`git remote add origin ${remoteUrl}`);
    }

    // Update remote if needed
    const expectedUrl = `https://github.com/${owner}/${repo}.git`;
    if (!remoteUrl.includes(`${owner}/${repo}`)) {
      console.log(`📡 Updating remote to: ${expectedUrl}`);
      await execAsync(`git remote set-url origin ${expectedUrl}`);
    }

    // Add all files
    console.log('📦 Adding files...');
    await execAsync('git add -A');

    // Check if there are changes to commit
    let hasChanges = false;
    try {
      const { stdout } = await execAsync('git status --porcelain');
      hasChanges = stdout.trim().length > 0;
    } catch (e) {
      // Ignore
    }

    // Commit if there are changes
    if (hasChanges) {
      const timestamp = new Date().toISOString();
      console.log('💾 Committing changes...');
      await execAsync(`git commit -m "Backup: Restaurant Management System - ${timestamp}"`);
    } else {
      console.log('ℹ️  No new changes to commit');
    }

    // Push to GitHub with authentication
    console.log('🚀 Pushing to GitHub...');
    const authenticatedUrl = `https://${token}@github.com/${owner}/${repo}.git`;
    
    // Try to push to main first, then master as fallback
    try {
      await execAsync(`git push ${authenticatedUrl} HEAD:main -f`, { timeout: 120000 });
      console.log('✅ Pushed to main branch');
    } catch (mainError: any) {
      if (mainError.message.includes('main')) {
        console.log('⚠️  Main branch not found, trying master...');
        await execAsync(`git push ${authenticatedUrl} HEAD:master -f`, { timeout: 120000 });
        console.log('✅ Pushed to master branch');
      } else {
        throw mainError;
      }
    }

    console.log('');
    console.log('✅ SUCCESS!');
    console.log(`🔗 Repository: https://github.com/${owner}/${repo}`);
    console.log('');
    console.log('Your entire restaurant management system has been pushed to GitHub!');
    
  } catch (error: any) {
    console.error('');
    console.error('❌ ERROR:', error.message);
    console.error('');
    
    if (error.message.includes('lock')) {
      console.error('💡 Git lock file detected. Trying to clean up...');
      try {
        await execAsync('rm -f .git/*.lock .git/refs/heads/*.lock');
        console.error('   Lock files removed. Please try again.');
      } catch (e) {
        console.error('   Could not remove lock files automatically.');
      }
    }
    
    process.exit(1);
  }
}

main();
