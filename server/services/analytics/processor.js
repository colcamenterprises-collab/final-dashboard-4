/**
 * Analytics processing service
 */
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

/**
 * Compute shift date for analytics (5pm previous day to 3am current day)
 */
function computeShiftDate(date = new Date()) {
  const hour = date.getHours();
  const shiftDate = new Date(date);
  
  // If before 3am, shift date is previous day
  if (hour < 3) {
    shiftDate.setDate(shiftDate.getDate() - 1);
  }
  
  // Set to 5pm of shift date
  shiftDate.setHours(17, 0, 0, 0);
  return shiftDate;
}

/**
 * Get receipts for a shift window
 */
async function getShiftReceipts(restaurantId, shiftDate) {
  const startTime = new Date(shiftDate);
  const endTime = new Date(shiftDate);
  endTime.setDate(endTime.getDate() + 1);
  endTime.setHours(3, 0, 0, 0);

  return await prisma.receipt.findMany({
    where: {
      restaurantId,
      createdAtUTC: {
        gte: startTime,
        lt: endTime
      }
    },
    include: {
      items: true,
      payments: true
    }
  });
}

/**
 * Calculate payment breakdown
 */
function calculatePaymentBreakdown(receipts) {
  const breakdown = {
    cash: 0,
    card: 0,
    qr: 0,
    delivery: 0,
    other: 0
  };

  for (const receipt of receipts) {
    for (const payment of receipt.payments) {
      const amount = payment.amount / 100; // Convert from cents
      
      switch (payment.method) {
        case 'CASH':
          breakdown.cash += amount;
          break;
        case 'CARD':
          breakdown.card += amount;
          break;
        case 'QR':
          breakdown.qr += amount;
          break;
        case 'DELIVERY_PARTNER':
          breakdown.delivery += amount;
          break;
        default:
          breakdown.other += amount;
      }
    }
  }

  return breakdown;
}

/**
 * Calculate top sellers by quantity and revenue
 */
function calculateTopSellers(receipts) {
  const itemStats = new Map();

  for (const receipt of receipts) {
    for (const item of receipt.items) {
      const key = item.name;
      const existing = itemStats.get(key) || { name: key, qty: 0, revenue: 0 };
      
      existing.qty += item.qty;
      existing.revenue += item.total / 100; // Convert from cents
      
      itemStats.set(key, existing);
    }
  }

  const items = Array.from(itemStats.values());
  
  const top5ByQty = items
    .sort((a, b) => b.qty - a.qty)
    .slice(0, 5)
    .map(item => ({ name: item.name, qty: item.qty }));

  const top5ByRevenue = items
    .sort((a, b) => b.revenue - a.revenue)
    .slice(0, 5)
    .map(item => ({ name: item.name, revenue: item.revenue }));

  return { top5ByQty, top5ByRevenue };
}

/**
 * Calculate expected stock usage based on menu items and portion sizes
 */
function calculateExpectedUsage(receipts, menuItems) {
  let expectedBunsUsed = 0;
  let expectedMeatGrams = 0;
  let expectedDrinksUsed = 0;

  for (const receipt of receipts) {
    for (const item of receipt.items) {
      const menuItem = menuItems.find(m => m.sku === item.sku || m.name === item.name);
      
      if (menuItem) {
        if (menuItem.isBurger) {
          expectedBunsUsed += item.qty;
          expectedMeatGrams += (menuItem.portionGrams || 150) * item.qty;
        }
        if (menuItem.isDrink) {
          expectedDrinksUsed += item.qty;
        }
      } else {
        // Fallback based on item name
        const itemName = item.name.toLowerCase();
        if (itemName.includes('burger')) {
          expectedBunsUsed += item.qty;
          expectedMeatGrams += 150 * item.qty; // Default 150g per burger
        }
        if (itemName.includes('drink') || itemName.includes('coke') || itemName.includes('sprite')) {
          expectedDrinksUsed += item.qty;
        }
      }
    }
  }

  return { expectedBunsUsed, expectedMeatGrams, expectedDrinksUsed };
}

/**
 * Calculate variance between expected and actual stock
 */
function calculateVariance(expected, actual) {
  const variance = {
    buns: {
      expected: expected.expectedBunsUsed,
      actual: actual.burgerBuns || 0,
      difference: (actual.burgerBuns || 0) - expected.expectedBunsUsed,
      isSignificant: Math.abs((actual.burgerBuns || 0) - expected.expectedBunsUsed) >= 5
    },
    meat: {
      expected: expected.expectedMeatGrams,
      actual: actual.meatGrams || 0,
      difference: (actual.meatGrams || 0) - expected.expectedMeatGrams,
      isSignificant: Math.abs((actual.meatGrams || 0) - expected.expectedMeatGrams) >= 500
    },
    drinks: {
      expected: expected.expectedDrinksUsed,
      actual: actual.drinksCount || 0,
      difference: (actual.drinksCount || 0) - expected.expectedDrinksUsed,
      isSignificant: Math.abs((actual.drinksCount || 0) - expected.expectedDrinksUsed) >= 5
    }
  };

  return variance;
}

/**
 * Generate shopping list based on variance and stock levels
 */
function generateShoppingList(variance, stockData) {
  const shoppingList = [];

  // Check buns
  if (variance.buns.difference < -3 || (stockData?.burgerBuns || 0) < 20) {
    shoppingList.push({
      item: 'Burger Buns',
      reason: variance.buns.difference < -3 ? 'High usage variance' : 'Low stock',
      suggestedQty: 50,
      priority: 'high'
    });
  }

  // Check meat
  if (variance.meat.difference < -300 || (stockData?.meatGrams || 0) < 1000) {
    shoppingList.push({
      item: 'Ground Beef',
      reason: variance.meat.difference < -300 ? 'High usage variance' : 'Low stock',
      suggestedQty: '2kg',
      priority: 'high'
    });
  }

  // Check drinks
  if (variance.drinks.difference < -3) {
    shoppingList.push({
      item: 'Soft Drinks',
      reason: 'High usage variance',
      suggestedQty: 24,
      priority: 'medium'
    });
  }

  return shoppingList;
}

/**
 * Process analytics for a specific shift date
 */
export async function processAnalytics(restaurantId, shiftDate = null) {
  if (!shiftDate) {
    shiftDate = computeShiftDate();
  }

  try {
    // Get receipts for the shift
    const receipts = await getShiftReceipts(restaurantId, shiftDate);
    
    if (receipts.length === 0) {
      console.log('No receipts found for shift date:', shiftDate);
      return null;
    }

    // Get menu items for calculations
    const menuItems = await prisma.menuItem.findMany({
      where: { restaurantId, active: true }
    });

    // Get stock data for the shift
    const stockData = await prisma.dailyStock.findFirst({
      where: {
        createdAt: {
          gte: shiftDate,
          lt: new Date(shiftDate.getTime() + 24 * 60 * 60 * 1000)
        }
      }
    });

    // Calculate analytics
    const totalSales = receipts.reduce((sum, receipt) => sum + receipt.total / 100, 0);
    const paymentBreakdown = calculatePaymentBreakdown(receipts);
    const { top5ByQty, top5ByRevenue } = calculateTopSellers(receipts);
    const expectedUsage = calculateExpectedUsage(receipts, menuItems);
    const variance = calculateVariance(expectedUsage, stockData);
    const shoppingList = generateShoppingList(variance, stockData);

    // Identify flags/alerts
    const flags = [];
    if (totalSales < 5000) flags.push('Low sales day');
    if (variance.buns.isSignificant) flags.push('Significant bun variance');
    if (variance.meat.isSignificant) flags.push('Significant meat variance');
    if (shoppingList.length > 0) flags.push('Items need restocking');

    // Create or update analytics record
    const analyticsData = {
      restaurantId,
      shiftDate,
      top5ByQty,
      top5ByRevenue,
      expectedBunsUsed: expectedUsage.expectedBunsUsed,
      expectedMeatGrams: expectedUsage.expectedMeatGrams,
      expectedDrinksUsed: expectedUsage.expectedDrinksUsed,
      variance,
      shoppingList,
      flags
    };

    const analytics = await prisma.analyticsDaily.upsert({
      where: {
        restaurantId_shiftDate: {
          restaurantId,
          shiftDate
        }
      },
      update: analyticsData,
      create: analyticsData
    });

    return analytics;
  } finally {
    await prisma.$disconnect();
  }
}

/**
 * Get latest analytics for a restaurant
 */
export async function getLatestAnalytics(restaurantId) {
  try {
    return await prisma.analyticsDaily.findFirst({
      where: { restaurantId },
      orderBy: { shiftDate: 'desc' }
    });
  } finally {
    await prisma.$disconnect();
  }
}