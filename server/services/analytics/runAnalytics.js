/**
 * Analytics worker - process daily analytics
 */
import { PrismaClient } from '@prisma/client';
import { processAnalytics } from './processor.js';

const prisma = new PrismaClient();

async function runAnalytics() {
  try {
    console.log('Starting analytics processing...');

    // Get all restaurants
    const restaurants = await prisma.restaurant.findMany();
    
    if (restaurants.length === 0) {
      console.log('No restaurants found');
      return;
    }

    for (const restaurant of restaurants) {
      console.log(`Processing analytics for ${restaurant.name}...`);
      
      try {
        const analytics = await processAnalytics(restaurant.id);
        
        if (analytics) {
          console.log(`Analytics completed for ${restaurant.name}:`, {
            shiftDate: analytics.shiftDate,
            expectedBunsUsed: analytics.expectedBunsUsed,
            expectedMeatGrams: analytics.expectedMeatGrams,
            flags: analytics.flags
          });
        } else {
          console.log(`No data to process for ${restaurant.name}`);
        }
      } catch (error) {
        console.error(`Analytics failed for ${restaurant.name}:`, error.message);
      }
    }

    console.log('Analytics processing completed');
    process.exit(0);
  } catch (error) {
    console.error('Analytics processing failed:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  runAnalytics();
}

export { runAnalytics };