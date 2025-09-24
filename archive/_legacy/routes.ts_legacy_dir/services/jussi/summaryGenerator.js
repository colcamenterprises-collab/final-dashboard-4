/**
 * Jussi summary generator - builds management reports
 */
import { PrismaClient } from '@prisma/client';
import { sendDailyReport } from './emailService.js';

const prisma = new PrismaClient();

/**
 * Compute shift date for summary (6pm previous day to 3am current day)
 */
function computeShiftDate(date = new Date()) {
  const hour = date.getHours();
  const shiftDate = new Date(date);
  
  if (hour < 3) {
    shiftDate.setDate(shiftDate.getDate() - 1);
  }
  
  shiftDate.setHours(18, 0, 0, 0);
  return shiftDate;
}

/**
 * Get daily sales summary for shift
 */
async function getDailySalesSummary(restaurantId, shiftDate) {
  // Get sales data from your existing DailySales table
  const salesData = await prisma.dailySales.findFirst({
    where: {
      createdAt: {
        gte: shiftDate,
        lt: new Date(shiftDate.getTime() + 24 * 60 * 60 * 1000)
      }
    },
    orderBy: { createdAt: 'desc' }
  });

  if (salesData) {
    return {
      totalSales: salesData.totalSales || 0,
      cashSales: salesData.cashSales || 0,
      qrSales: salesData.qrSales || 0,
      grabSales: salesData.grabSales || 0,
      aroiDeeSales: salesData.aroiDeeSales || 0,
      totalExpenses: salesData.totalExpenses || 0
    };
  }

  return {
    totalSales: 0,
    cashSales: 0,
    qrSales: 0,
    grabSales: 0,
    aroiDeeSales: 0,
    totalExpenses: 0
  };
}

/**
 * Get daily stock data for shift
 */
async function getDailyStock(shiftDate) {
  return await prisma.dailyStock.findFirst({
    where: {
      createdAt: {
        gte: shiftDate,
        lt: new Date(shiftDate.getTime() + 24 * 60 * 60 * 1000)
      }
    },
    orderBy: { createdAt: 'desc' }
  });
}

/**
 * Get expenses for shift
 */
async function getShiftExpenses(restaurantId, shiftDate) {
  return await prisma.expense.findMany({
    where: {
      restaurantId,
      shiftDate: {
        gte: shiftDate,
        lt: new Date(shiftDate.getTime() + 24 * 60 * 60 * 1000)
      }
    },
    orderBy: { costCents: 'desc' },
    take: 10 // Top 10 expenses
  });
}

/**
 * Get latest analytics data
 */
async function getAnalyticsData(restaurantId, shiftDate) {
  return await prisma.analyticsDaily.findFirst({
    where: {
      restaurantId,
      shiftDate
    }
  });
}

/**
 * Generate GPT summary if enabled
 */
async function generateGPTSummary(data) {
  if (process.env.USE_GPT_SUMMARY !== 'true' || !process.env.OPENAI_API_KEY) {
    return null;
  }

  // TODO: Implement OpenAI integration when needed
  return null;
}

/**
 * Generate and send daily summary
 */
export async function generateDailySummary(restaurantId = null, shiftDate = null) {
  if (!shiftDate) {
    shiftDate = computeShiftDate();
  }

  try {
    // Get restaurant data
    let restaurant;
    if (restaurantId) {
      restaurant = await prisma.restaurant.findUnique({
        where: { id: restaurantId }
      });
    } else {
      // Default to first restaurant (Smash Brothers Burgers)
      restaurant = await prisma.restaurant.findFirst({
        where: { slug: 'smash-brothers-burgers' }
      });
    }

    if (!restaurant) {
      throw new Error('Restaurant not found');
    }

    console.log(`Generating summary for ${restaurant.name}, shift date: ${shiftDate.toISOString()}`);

    // Gather all data
    const [summary, dailyStock, expenses, analytics] = await Promise.all([
      getDailySalesSummary(restaurant.id, shiftDate),
      getDailyStock(shiftDate),
      getShiftExpenses(restaurant.id, shiftDate),
      getAnalyticsData(restaurant.id, shiftDate)
    ]);

    const reportData = {
      restaurant,
      analytics,
      dailyStock,
      expenses,
      summary,
      shiftDate
    };

    // Generate GPT summary if enabled
    const gptSummary = await generateGPTSummary(reportData);
    if (gptSummary) {
      reportData.gptSummary = gptSummary;
    }

    // Send email report
    const emailResult = await sendDailyReport(reportData);
    console.log('Email sent successfully:', emailResult);

    // Log job in database
    const job = await prisma.job.create({
      data: {
        restaurantId: restaurant.id,
        type: 'EMAIL_SUMMARY',
        payload: {
          shiftDate: shiftDate.toISOString(),
          emailResult,
          reportData: {
            totalSales: summary.totalSales,
            stockStatus: dailyStock ? {
              burgerBuns: dailyStock.burgerBuns,
              meatGrams: dailyStock.meatGrams
            } : null,
            expenseCount: expenses.length,
            analyticsFlags: analytics?.flags || [],
            shoppingListItems: analytics?.shoppingList?.length || 0
          }
        },
        status: 'SUCCESS',
        runAt: new Date()
      }
    });

    return {
      jobId: job.id,
      emailResult,
      reportData
    };
  } catch (error) {
    console.error('Daily summary generation failed:', error);

    // Log failed job
    if (restaurant) {
      await prisma.job.create({
        data: {
          restaurantId: restaurant.id,
          type: 'EMAIL_SUMMARY',
          payload: {
            shiftDate: shiftDate.toISOString(),
            error: error.message
          },
          status: 'FAILED',
          lastError: error.message,
          runAt: new Date()
        }
      });
    }

    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

/**
 * Get latest summary job for a restaurant
 */
export async function getLatestSummary(restaurantId) {
  try {
    return await prisma.job.findFirst({
      where: {
        restaurantId,
        type: 'EMAIL_SUMMARY'
      },
      orderBy: { createdAt: 'desc' }
    });
  } finally {
    await prisma.$disconnect();
  }
}