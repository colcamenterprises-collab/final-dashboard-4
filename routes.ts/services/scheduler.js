/**
 * Service scheduler for automated operations
 */
import cron from 'node-cron';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

/**
 * Initialize restaurant and POS connection
 */
async function initializeRestaurant() {
  try {
    // Ensure Smash Brothers Burgers restaurant exists
    let restaurant = await prisma.restaurant.findFirst({
      where: { slug: 'smash-brothers-burgers' }
    });

    if (!restaurant) {
      restaurant = await prisma.restaurant.create({
        data: {
          name: 'Smash Brothers Burgers',
          slug: 'smash-brothers-burgers',
          email: 'smashbrothersburgersth@gmail.com',
          timezone: 'Asia/Bangkok',
          locale: 'en-TH'
        }
      });
      console.log('✅ Restaurant created:', restaurant.name);
    }

    // Ensure POS connection exists
    let posConnection = await prisma.posConnection.findFirst({
      where: {
        restaurantId: restaurant.id,
        provider: 'LOYVERSE',
        isActive: true
      }
    });

    if (!posConnection) {
      posConnection = await prisma.posConnection.create({
        data: {
          restaurantId: restaurant.id,
          provider: 'LOYVERSE',
          apiKey: process.env.LOYVERSE_API_TOKEN?.substring(0, 8) + '...',
          isActive: true
        }
      });
      console.log('✅ POS connection created for Loyverse');
    }

    return { restaurant, posConnection };
  } catch (error) {
    console.error('❌ Restaurant initialization failed:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

/**
 * Schedule incremental POS sync every 15 minutes
 */
function scheduleIncrementalSync() {
  cron.schedule('*/15 * * * *', async () => {
    try {
      console.log('🔄 Starting scheduled incremental POS sync...');
      
      const { syncReceiptsWindow } = await import('./pos-ingestion/ingester.js');
      
      const endDate = new Date();
      const startDate = new Date();
      startDate.setMinutes(startDate.getMinutes() - 15);
      
      const result = await syncReceiptsWindow(startDate, endDate, 'incremental');
      console.log('✅ Incremental sync completed:', result);
    } catch (error) {
      console.error('❌ Scheduled incremental sync failed:', error);
    }
  });
  
  console.log('📅 Incremental POS sync scheduled every 15 minutes');
}

/**
 * Schedule daily analytics processing at 3:30 AM Bangkok time
 */
function scheduleAnalyticsProcessing() {
  cron.schedule('30 3 * * *', async () => {
    try {
      console.log('📊 Starting scheduled analytics processing...');
      
      const { processAnalytics } = await import('./analytics/processor.js');
      const { PrismaClient } = await import('@prisma/client');
      const prisma = new PrismaClient();
      
      const restaurant = await prisma.restaurant.findFirst({
        where: { slug: 'smash-brothers-burgers' }
      });
      
      if (restaurant) {
        const analytics = await processAnalytics(restaurant.id);
        console.log('✅ Analytics processing completed:', {
          shiftDate: analytics?.shiftDate,
          flags: analytics?.flags?.length || 0
        });
      }
    } catch (error) {
      console.error('❌ Scheduled analytics processing failed:', error);
    }
  }, {
    timezone: 'Asia/Bangkok'
  });
  
  console.log('📅 Analytics processing scheduled daily at 3:30 AM Bangkok time');
}

/**
 * Schedule Jussi email summary at 8:00 AM Bangkok time
 */
function scheduleJussiSummary() {
  cron.schedule('0 8 * * *', async () => {
    try {
      console.log('📧 Starting scheduled Jussi summary generation...');
      
      const { generateDailySummary } = await import('./jussi/summaryGenerator.js');
      const result = await generateDailySummary();
      
      console.log('✅ Jussi summary completed:', {
        jobId: result.jobId,
        emailSent: !!result.emailResult,
        recipient: result.emailResult?.recipient
      });
    } catch (error) {
      console.error('❌ Scheduled Jussi summary failed:', error);
    }
  }, {
    timezone: 'Asia/Bangkok'
  });
  
  console.log('📅 Jussi email summary scheduled daily at 8:00 AM Bangkok time');
}

/**
 * Start all scheduled services
 */
export async function startScheduler() {
  console.log('🚀 Starting service scheduler...');
  
  try {
    // Initialize restaurant data
    await initializeRestaurant();
    
    // Schedule all services
    scheduleIncrementalSync();
    scheduleAnalyticsProcessing();
    scheduleJussiSummary();
    
    console.log('✅ All services scheduled successfully');
    
    return {
      incrementalSync: '*/15 * * * * (every 15 minutes)',
      analytics: '30 3 * * * (3:30 AM Bangkok)',
      jussiSummary: '0 8 * * * (8:00 AM Bangkok)'
    };
  } catch (error) {
    console.error('❌ Scheduler startup failed:', error);
    throw error;
  }
}

/**
 * Get scheduler status
 */
export function getSchedulerStatus() {
  return {
    active: true,
    timezone: 'Asia/Bangkok',
    schedules: [
      { service: 'Incremental POS Sync', cron: '*/15 * * * *', description: 'Every 15 minutes' },
      { service: 'Analytics Processing', cron: '30 3 * * *', description: '3:30 AM Bangkok' },
      { service: 'Jussi Email Summary', cron: '0 8 * * *', description: '8:00 AM Bangkok' }
    ]
  };
}