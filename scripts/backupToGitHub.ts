#!/usr/bin/env tsx

import { createGitHubBackup } from '../server/utils/githubBackup';

async function main() {
  const repoName = process.argv[2] || 'restaurant-management-system';
  const description = process.argv[3] || 'Smash Brothers Burgers - Restaurant Management System';
  const isPrivate = process.argv[4] !== 'public'; // Default to private

  console.log('🔄 Starting GitHub backup...');
  console.log(`📦 Repository Name: ${repoName}`);
  console.log(`📝 Description: ${description}`);
  console.log(`🔒 Private: ${isPrivate}`);
  console.log('');

  try {
    const result = await createGitHubBackup(repoName, description, isPrivate);
    console.log('');
    console.log('✅ SUCCESS!');
    console.log(`🔗 Repository URL: ${result.repoUrl}`);
    console.log('');
    console.log('Your entire restaurant management system has been backed up to GitHub!');
  } catch (error: any) {
    console.error('');
    console.error('❌ ERROR:', error.message);
    console.error('');
    if (error.message.includes('name already exists')) {
      console.error('💡 The repository name already exists. Try a different name:');
      console.error('   npm run backup:github <different-repo-name>');
    }
    process.exit(1);
  }
}

main();
