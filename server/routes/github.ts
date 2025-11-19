import { Router } from 'express';
import { createGitHubBackup } from '../utils/githubBackup';

const router = Router();

router.post('/backup', async (req, res) => {
  try {
    const { repoName, description, isPrivate } = req.body;
    
    if (!repoName) {
      return res.status(400).json({ error: 'Repository name is required' });
    }

    const result = await createGitHubBackup(
      repoName,
      description || 'Restaurant Management System Backup',
      isPrivate !== false // default to private
    );

    res.json(result);
  } catch (error: any) {
    console.error('GitHub backup error:', error);
    res.status(500).json({ 
      error: error.message || 'Failed to create GitHub backup' 
    });
  }
});

export default router;
