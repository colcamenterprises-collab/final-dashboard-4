#!/usr/bin/env tsx
import { db } from '../db.js';
import { expenseTypeLkp, supplierLkp } from '../../shared/schema.js';

async function seed() {
  console.log('🌱 Starting to seed expense categories and suppliers...');

  // Categories as specified in requirements
  const categories = [
    'Food & Beverage',
    'Staff Expenses (from Account)', 
    'Rent',
    'Administration',
    'Advertising',
    'Delivery Fee',
    'Director Payment',
    'Fittings & Fixtures',
    'Kitchen Supplies',
    'Office Supplies',
    'Packaging',
    'Fees',
    'Subscriptions',
    'Travel',
    'Utilities',
    'Other'
  ];

  // Suppliers as specified in requirements  
  const suppliers = [
    'Makro',
    'Mr DIY', 
    'Bakery',
    'Big C',
    'Printers',
    'Supercheap',
    'Loyverse',
    'DTAC',
    'AIS',
    'Landlord',
    'Gas',
    'GO Wholesale',
    'Grab Merchant',
    'HomePro',
    'Lawyer',
    'Lazada',
    'Tesco Lotus',
    'Other'
  ];

  try {
    // Seed categories
    console.log('📋 Seeding expense categories...');
    for (const name of categories) {
      await db.insert(expenseTypeLkp).values({ name, active: true }).onConflictDoNothing();
      console.log(`  ✅ ${name}`);
    }

    // Seed suppliers
    console.log('🏪 Seeding suppliers...');
    for (const name of suppliers) {
      await db.insert(supplierLkp).values({ name, active: true }).onConflictDoNothing();
      console.log(`  ✅ ${name}`);
    }

    console.log('');
    console.log('🎉 Successfully seeded expense categories and suppliers!');
    console.log('');
    
    // Verify the seeding worked
    const categoryCount = await db.select().from(expenseTypeLkp);
    const supplierCount = await db.select().from(supplierLkp);
    
    console.log(`📊 Final counts:`);
    console.log(`  Categories: ${categoryCount.length}`);
    console.log(`  Suppliers: ${supplierCount.length}`);
    
  } catch (error) {
    console.error('❌ Error seeding data:', error);
    process.exit(1);
  }
  
  process.exit(0);
}

// Run the seed function
seed();