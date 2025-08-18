#!/usr/bin/env tsx

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const stockData = [
  // Drinks (first 4 beef items excluded)
  { name: 'Coke', category: 'Drinks', isDrink: true, isExcluded: false, displayOrder: 1 },
  { name: 'Coke Zero', category: 'Drinks', isDrink: true, isExcluded: false, displayOrder: 2 },
  { name: 'Fanta Orange', category: 'Drinks', isDrink: true, isExcluded: false, displayOrder: 3 },
  { name: 'Fanta Strawberry', category: 'Drinks', isDrink: true, isExcluded: false, displayOrder: 4 },
  { name: 'Schweppes Manow', category: 'Drinks', isDrink: true, isExcluded: false, displayOrder: 5 },
  { name: 'Kids Juice (Orange)', category: 'Drinks', isDrink: true, isExcluded: false, displayOrder: 6 },
  { name: 'Kids Juice (Apple)', category: 'Drinks', isDrink: true, isExcluded: false, displayOrder: 7 },
  { name: 'Sprite', category: 'Drinks', isDrink: true, isExcluded: false, displayOrder: 8 },
  { name: 'Soda Water', category: 'Drinks', isDrink: true, isExcluded: false, displayOrder: 9 },
  { name: 'Bottled Water', category: 'Drinks', isDrink: true, isExcluded: false, displayOrder: 10 },
  
  // Fresh Food
  { name: 'Salad (Iceberg Lettuce)', category: 'Fresh Food', isDrink: false, isExcluded: false, displayOrder: 11 },
  { name: 'Milk', category: 'Fresh Food', isDrink: false, isExcluded: false, displayOrder: 12 },
  { name: 'Burger Bun', category: 'Fresh Food', isDrink: false, isExcluded: false, displayOrder: 13 },
  { name: 'Tomatos', category: 'Fresh Food', isDrink: false, isExcluded: false, displayOrder: 14 },
  { name: 'White Cabbage', category: 'Fresh Food', isDrink: false, isExcluded: false, displayOrder: 15 },
  { name: 'Purple Cabbage', category: 'Fresh Food', isDrink: false, isExcluded: false, displayOrder: 16 },
  { name: 'Onions Bulk 10kg', category: 'Fresh Food', isDrink: false, isExcluded: false, displayOrder: 17 },
  { name: 'Onions (small bags)', category: 'Fresh Food', isDrink: false, isExcluded: false, displayOrder: 18 },
  { name: 'Cheese', category: 'Fresh Food', isDrink: false, isExcluded: false, displayOrder: 19 },
  { name: 'Bacon Short', category: 'Fresh Food', isDrink: false, isExcluded: false, displayOrder: 20 },
  { name: 'Bacon Long', category: 'Fresh Food', isDrink: false, isExcluded: false, displayOrder: 21 },
  { name: 'Jalapenos', category: 'Fresh Food', isDrink: false, isExcluded: false, displayOrder: 22 },
  
  // Frozen Food
  { name: 'French Fries 7mm', category: 'Frozen Food', isDrink: false, isExcluded: false, displayOrder: 23 },
  { name: 'Chicken Nuggets', category: 'Frozen Food', isDrink: false, isExcluded: false, displayOrder: 24 },
  { name: 'Chicken Fillets', category: 'Frozen Food', isDrink: false, isExcluded: false, displayOrder: 25 },
  { name: 'Sweet Potato Fries', category: 'Frozen Food', isDrink: false, isExcluded: false, displayOrder: 26 },
  
  // Kitchen Supplies
  { name: 'Oil (Fryer)', category: 'Kitchen Supplies', isDrink: false, isExcluded: false, displayOrder: 27 },
  { name: 'Plastic Food Wrap', category: 'Kitchen Supplies', isDrink: false, isExcluded: false, displayOrder: 28 },
  { name: 'Paper Towel Long', category: 'Kitchen Supplies', isDrink: false, isExcluded: false, displayOrder: 29 },
  { name: 'Paper Towel Short (Serviettes)', category: 'Kitchen Supplies', isDrink: false, isExcluded: false, displayOrder: 30 },
  { name: 'Food Gloves (Large)', category: 'Kitchen Supplies', isDrink: false, isExcluded: false, displayOrder: 31 },
  { name: 'Food Gloves (Medium)', category: 'Kitchen Supplies', isDrink: false, isExcluded: false, displayOrder: 32 },
  { name: 'Food Gloves (Small)', category: 'Kitchen Supplies', isDrink: false, isExcluded: false, displayOrder: 33 },
  { name: 'Aluminum Foil', category: 'Kitchen Supplies', isDrink: false, isExcluded: false, displayOrder: 34 },
  { name: 'Plastic Meat Gloves', category: 'Kitchen Supplies', isDrink: false, isExcluded: false, displayOrder: 35 },
  { name: 'Kitchen Cleaner', category: 'Kitchen Supplies', isDrink: false, isExcluded: false, displayOrder: 36 },
  { name: 'Alcohol Sanitiser', category: 'Kitchen Supplies', isDrink: false, isExcluded: false, displayOrder: 37 },
  
  // Packaging
  { name: 'French Fries Box', category: 'Packaging', isDrink: false, isExcluded: false, displayOrder: 38 },
  { name: 'Plastic Carry Bags (Size- 6×14)', category: 'Packaging', isDrink: false, isExcluded: false, displayOrder: 39 },
  { name: 'Plastic Carry Bags (Size - 9×18)', category: 'Packaging', isDrink: false, isExcluded: false, displayOrder: 40 },
  { name: 'Brown Paper Food Bags', category: 'Packaging', isDrink: false, isExcluded: false, displayOrder: 41 },
  { name: 'Loaded Fries Boxes', category: 'Packaging', isDrink: false, isExcluded: false, displayOrder: 42 },
  { name: 'Packaging Labels', category: 'Packaging', isDrink: false, isExcluded: false, displayOrder: 43 },
  { name: 'Knife, Fork, Spoon Set', category: 'Packaging', isDrink: false, isExcluded: false, displayOrder: 44 },
  
  // Shelf Items
  { name: 'Cajun Fries Seasoning', category: 'Shelf Items', isDrink: false, isExcluded: false, displayOrder: 45 },
  { name: 'Crispy Fried Onions', category: 'Shelf Items', isDrink: false, isExcluded: false, displayOrder: 46 },
  { name: 'Pickles(standard dill pickles)', category: 'Shelf Items', isDrink: false, isExcluded: false, displayOrder: 47 },
  { name: 'Pickles Sweet (standard)', category: 'Shelf Items', isDrink: false, isExcluded: false, displayOrder: 48 },
  { name: 'Mustard', category: 'Shelf Items', isDrink: false, isExcluded: false, displayOrder: 49 },
  { name: 'Mayonnaise', category: 'Shelf Items', isDrink: false, isExcluded: false, displayOrder: 50 },
  { name: 'Tomato Sauce', category: 'Shelf Items', isDrink: false, isExcluded: false, displayOrder: 51 },
  { name: 'Chili Sauce (Sriracha)', category: 'Shelf Items', isDrink: false, isExcluded: false, displayOrder: 52 },
  { name: 'BBQ Sauce', category: 'Shelf Items', isDrink: false, isExcluded: false, displayOrder: 53 },
  { name: 'Sriracha Sauce', category: 'Shelf Items', isDrink: false, isExcluded: false, displayOrder: 54 },
  { name: 'Salt (Coarse Sea Salt)', category: 'Shelf Items', isDrink: false, isExcluded: false, displayOrder: 55 },
];

async function seedStockData() {
  try {
    console.log('🌱 Seeding stock data...');
    
    // Clear existing data
    await prisma.stockItem.deleteMany();
    
    // Insert stock items
    for (const item of stockData) {
      await prisma.stockItem.create({
        data: item
      });
    }
    
    const count = await prisma.stockItem.count();
    console.log(`✅ Seeded ${count} stock items`);
    
    // Show categories
    const categories = await prisma.stockItem.groupBy({
      by: ['category'],
      _count: { category: true }
    });
    
    console.log('\n📦 Categories:');
    categories.forEach(cat => {
      console.log(`  ${cat.category}: ${cat._count.category} items`);
    });
    
  } catch (error) {
    console.error('❌ Seeding failed:', error);
  } finally {
    await prisma.$disconnect();
  }
}

seedStockData();