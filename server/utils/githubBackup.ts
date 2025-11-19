import { Octokit } from '@octokit/rest';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

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

// WARNING: Never cache this client.
// Access tokens expire, so a new client must be created each time.
export async function getGitHubClient() {
  const accessToken = await getAccessToken();
  return new Octokit({ auth: accessToken });
}

export async function createGitHubBackup(repoName: string, description: string, isPrivate: boolean = true) {
  const octokit = await getGitHubClient();
  
  // Get authenticated user
  const { data: user } = await octokit.users.getAuthenticated();
  
  // Create repository
  const { data: repo } = await octokit.repos.createForAuthenticatedUser({
    name: repoName,
    description: description,
    private: isPrivate,
    auto_init: false
  });

  console.log(`✅ Repository created: ${repo.html_url}`);

  // Add remote and push
  try {
    // Check if remote exists
    try {
      await execAsync('git remote get-url origin');
      // Remote exists, update it
      await execAsync(`git remote set-url origin ${repo.clone_url}`);
    } catch {
      // Remote doesn't exist, add it
      await execAsync(`git remote add origin ${repo.clone_url}`);
    }

    // Configure git user
    await execAsync(`git config user.name "${user.login}"`);
    await execAsync(`git config user.email "${user.email || user.login + '@users.noreply.github.com'}"`);

    // Add all files
    await execAsync('git add -A');

    // Commit
    const timestamp = new Date().toISOString();
    await execAsync(`git commit -m "Backup: Restaurant Management System - ${timestamp}" || true`);

    // Push to GitHub
    const accessToken = await getAccessToken();
    const authenticatedUrl = repo.clone_url.replace('https://', `https://${accessToken}@`);
    await execAsync(`git push ${authenticatedUrl} main -f`);

    console.log(`✅ Code pushed to: ${repo.html_url}`);

    return {
      success: true,
      repoUrl: repo.html_url,
      message: 'Backup completed successfully'
    };
  } catch (error: any) {
    console.error('Error pushing to GitHub:', error);
    throw new Error(`Failed to push code: ${error.message}`);
  }
}
