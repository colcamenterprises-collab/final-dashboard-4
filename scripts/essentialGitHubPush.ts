#!/usr/bin/env tsx

import { getGitHubClient } from '../server/utils/githubBackup';
import { readFileSync, existsSync } from 'fs';

const ESSENTIAL_FILES = [
  // Core configuration
  'package.json',
  'tsconfig.json',
  'vite.config.ts',
  'README.md',
  '.env.example',
  '.gitignore',
  
  // Database schemas
  'shared/schema.ts',
  'prisma/schema.prisma',
  'drizzle.config.ts',
  
  // Backend entry
  'server/index.ts',
  'server/db.ts',
  'server/routes.ts',
  'server/storage.ts',
  'server/vite.ts',
  
  // Frontend entry
  'client/src/App.tsx',
  'client/src/main.tsx',
  'client/src/index.css',
  'client/index.html',
  
  // Backend routes (all of them)
  'server/routes/analytics.ts',
  'server/routes/balance.ts',
  'server/routes/bankImport.ts',
  'server/routes/chef.ts',
  'server/routes/costing.ts',
  'server/routes/dailySalesLibrary.ts',
  'server/routes/dailyStock.ts',
  'server/routes/expenses.ts',
  'server/routes/forms.ts',
  'server/routes/github.ts',
  'server/routes/ingredients.ts',
  'server/routes/loyverseEnhanced.ts',
  'server/routes/managerChecks.ts',
  'server/routes/membership.ts',
  'server/routes/menu.ts',
  'server/routes/purchaseTally.ts',
  'server/routes/recipes.ts',
  'server/routes/shoppingList.ts',
  'server/routes/uploads.ts',
  'server/routes/adminMenu.ts',
  'server/routes/onlineMenu.ts',
  'server/routes/onlineOrders.ts',
  
  // Frontend pages
  'client/src/pages/Dashboard.tsx',
  'client/src/pages/Expenses.tsx',
  'client/src/pages/CostCalculator.tsx',
  'client/src/pages/RecipeLibrary.tsx',
  'client/src/pages/ShoppingList.tsx',
  
  // Lib utilities
  'client/src/lib/queryClient.ts',
  'client/src/lib/format.ts',
  'server/lib/prisma.ts',
  
  // Forms
  'server/forms/dailySalesV2.ts',
  
  // Services
  'server/services/shiftAnalysisService.ts',
  'server/services/loyverseImportV2.ts',
  'server/services/shoppingList.ts'
];

async function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function main() {
  const owner = process.argv[2] || 'colcamenterprises-collab';
  const repo = process.argv[3] || 'restaurant-management-system';

  console.log('🚀 Essential Files Push');
  console.log(`📦 Repository: ${owner}/${repo}`);
  console.log(`📋 Pushing ${ESSENTIAL_FILES.length} essential files`);
  console.log('');

  try {
    const octokit = await getGitHubClient();
    
    // Verify repository
    const { data: repoData } = await octokit.repos.get({ owner, repo });
    const defaultBranch = repoData.default_branch || 'main';
    console.log(`✓ Repository verified (branch: ${defaultBranch})`);
    console.log('');

    const uploaded: string[] = [];
    const failed: string[] = [];
    const missing: string[] = [];

    console.log('⏳ Waiting 60 seconds for rate limit to clear...');
    await sleep(60000);
    console.log('✓ Ready to upload');
    console.log('');

    for (let i = 0; i < ESSENTIAL_FILES.length; i++) {
      const filePath = ESSENTIAL_FILES[i];
      
      if (!existsSync(filePath)) {
        console.log(`⚠️  [${i + 1}/${ESSENTIAL_FILES.length}] Missing: ${filePath}`);
        missing.push(filePath);
        continue;
      }

      try {
        const content = readFileSync(filePath);
        
        // Check if file already exists
        let sha: string | undefined;
        try {
          const { data: existing } = await octokit.repos.getContent({
            owner,
            repo,
            path: filePath
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
          path: filePath,
          message: sha ? `Update ${filePath}` : `Add ${filePath}`,
          content: content.toString('base64'),
          ...(sha ? { sha } : {})
        });

        uploaded.push(filePath);
        console.log(`✓ [${i + 1}/${ESSENTIAL_FILES.length}] ${filePath}`);
        
        // Wait between uploads to avoid rate limit
        if (i < ESSENTIAL_FILES.length - 1) {
          await sleep(1000); // 1 second delay
        }
        
      } catch (error: any) {
        failed.push(filePath);
        console.log(`✗ [${i + 1}/${ESSENTIAL_FILES.length}] Failed: ${filePath} - ${error.message}`);
        
        if (error.message.includes('rate limit')) {
          console.log('⚠️  Rate limit hit, waiting 2 minutes...');
          await sleep(120000);
        }
      }
    }

    console.log('');
    console.log('📊 Summary:');
    console.log(`   ✓ Uploaded: ${uploaded.length} files`);
    console.log(`   ✗ Failed: ${failed.length} files`);
    console.log(`   ⚠ Missing: ${missing.length} files`);
    console.log('');
    console.log(`🔗 View repository: https://github.com/${owner}/${repo}`);

    if (uploaded.length > 0) {
      console.log('');
      console.log('✅ Essential files pushed successfully!');
    }
    
  } catch (error: any) {
    console.error('❌ ERROR:', error.message);
    process.exit(1);
  }
}

main();
