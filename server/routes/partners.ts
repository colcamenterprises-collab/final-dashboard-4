// Partners Router - Dedicated endpoints for partner analytics
import { Router } from 'express';
import { db } from '../db.js';
import { partnerStatements } from '../../shared/schema.js';
import { eq, and } from 'drizzle-orm';

const router = Router();

// SECURE Authentication middleware - REQUIRES valid authentication
const requireAuth = (req: any, res: any, next: any) => {
  const restaurantId = req.headers['x-restaurant-id'];
  const userId = req.headers['x-user-id'];
  const userRole = req.headers['x-user-role'];
  
  // SECURITY: Reject requests without proper authentication
  if (!restaurantId || !userId || restaurantId === 'default' || userId === 'anonymous') {
    return res.status(401).json({ error: 'Authentication required: Missing or invalid restaurant/user credentials' });
  }
  
  req.restaurantId = restaurantId;
  req.userId = userId;
  req.userRole = userRole || 'user';
  next();
};

// Apply auth to all routes
router.use(requireAuth);

// GET /api/partners/summary
router.get('/summary', async (req, res) => {
  try {
    const restaurantId = req.restaurantId;
    
    // SECURITY: Filter by restaurantId to prevent cross-tenant data leakage
    const partnerSummaries = await db
      .select()
      .from(partnerStatements)
      .where(and(
        eq(partnerStatements.status, 'APPROVED'),
        eq(partnerStatements.restaurantId, req.restaurantId)
      ));

    // Calculate analytics
    const analytics = partnerSummaries.reduce((acc: any, statement: any) => {
      const partner = statement.partner || 'Unknown';
      
      if (!acc[partner]) {
        acc[partner] = {
          partner,
          totalSales: 0,
          totalCommission: 0,
          totalPayout: 0,
          statementCount: 0
        };
      }
      
      acc[partner].totalSales += statement.grossSalesCents || 0;
      acc[partner].totalCommission += statement.commissionCents || 0;
      acc[partner].totalPayout += statement.netPayoutCents || 0;
      acc[partner].statementCount += 1;
      
      return acc;
    }, {} as Record<string, any>);

    // Convert to array and calculate percentages
    const summaries = Object.values(analytics).map((summary: any) => ({
      ...summary,
      commissionRate: summary.totalSales > 0 ? (summary.totalCommission / summary.totalSales * 100) : 0,
      totalSalesTHB: summary.totalSales / 100,
      totalCommissionTHB: summary.totalCommission / 100,
      totalPayoutTHB: summary.totalPayout / 100
    }));

    res.json(summaries);

  } catch (error) {
    console.error('Partners summary error:', error);
    res.status(500).json({ error: 'Failed to fetch partner analytics' });
  }
});

export default router;