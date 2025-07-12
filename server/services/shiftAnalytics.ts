import { db } from "../db";
import { shiftItemSales, shiftModifierSales, shiftSummary } from "@shared/schema";
import { eq } from "drizzle-orm";

// Category mapping function
const mapCategory = (name: string): string => {
  const n = name.toLowerCase();
  if (n.includes('burger')) return 'BURGERS';
  if (['fries', 'rings', 'nugget', 'side'].some(w => n.includes(w))) return 'SIDE_ORDERS';
  if (['cheese', 'bacon', 'animal style'].some(w => n.includes(w))) return 'BURGER_EXTRAS';
  if (['coke', 'water', 'juice', 'beer', 'fanta', 'sprite', 'drink'].some(w => n.includes(w))) return 'DRINKS';
  return 'OTHER';
};

// Bangkok timezone helper
const getBangkokDate = (date: Date): Date => {
  const bangkokOffset = 7 * 60; // UTC+7 in minutes
  return new Date(date.getTime() + bangkokOffset * 60 * 1000);
};

// Get shift date from any timestamp (6pm-3am cycle)
const getShiftDate = (timestamp: Date): Date => {
  const bangkokTime = getBangkokDate(timestamp);
  const hour = bangkokTime.getHours();
  
  // If before 6pm, this receipt belongs to previous day's shift
  if (hour < 18) {
    const shiftDate = new Date(bangkokTime);
    shiftDate.setDate(shiftDate.getDate() - 1);
    shiftDate.setHours(18, 0, 0, 0);
    return shiftDate;
  } else {
    // If 6pm or after, this is today's shift
    const shiftDate = new Date(bangkokTime);
    shiftDate.setHours(18, 0, 0, 0);
    return shiftDate;
  }
};

// Process receipt items and extract modifiers
const processReceiptItemsAndModifiers = (receipt: any) => {
  const items: { name: string; quantity: number; price: number }[] = [];
  const modifiers: { name: string; quantity: number; price: number }[] = [];
  
  if (!receipt.items || !Array.isArray(receipt.items)) {
    return { items, modifiers };
  }
  
  receipt.items.forEach((item: any) => {
    // Add main item
    items.push({
      name: item.name || item.item_name || 'Unknown Item',
      quantity: item.quantity || 1,
      price: parseFloat(item.price || item.total_price || 0)
    });
    
    // Process modifiers if they exist
    if (item.modifiers && Array.isArray(item.modifiers)) {
      item.modifiers.forEach((modifier: any) => {
        modifiers.push({
          name: modifier.name || modifier.modifier_name || 'Unknown Modifier',
          quantity: modifier.quantity || 1,
          price: parseFloat(modifier.price || modifier.cost || 0)
        });
      });
    }
  });
  
  return { items, modifiers };
};

// Main function to process previous shift
export const processPreviousShift = async (): Promise<{ success: boolean; message: string }> => {
  try {
    // Calculate previous shift date (yesterday's 6pm-3am)
    const now = new Date();
    const yesterday = new Date(now);
    yesterday.setDate(yesterday.getDate() - 1);
    const shiftDate = getShiftDate(yesterday);
    
    // Get shift start and end times in UTC
    const shiftStart = new Date(shiftDate.getTime() - 7 * 60 * 60 * 1000); // Convert to UTC
    const shiftEnd = new Date(shiftStart.getTime() + 9 * 60 * 60 * 1000); // 9 hours later (6pm-3am)
    
    console.log(`Processing shift analytics for ${shiftDate.toISOString().split('T')[0]}`);
    console.log(`Shift period: ${shiftStart.toISOString()} to ${shiftEnd.toISOString()}`);
    
    // Import receipt service
    const { loyverseReceiptService } = await import("./loyverseReceipts");
    
    // Get receipts for the shift period
    const receipts = await loyverseReceiptService.getReceiptsByDateRange(
      shiftStart.toISOString(),
      shiftEnd.toISOString()
    );
    
    console.log(`Found ${receipts.length} receipts for shift analysis`);
    
    if (receipts.length === 0) {
      return { success: true, message: `No receipts found for shift ${shiftDate.toISOString().split('T')[0]}` };
    }
    
    // Maps to aggregate data
    const itemTotals = new Map<string, { category: string; quantity: number; sales: number }>();
    const modifierTotals = new Map<string, { quantity: number; sales: number }>();
    
    // Category counters for shift summary
    const categoryCounts = {
      BURGERS: 0,
      SIDE_ORDERS: 0,
      DRINKS: 0,
      BURGER_EXTRAS: 0,
      OTHER: 0
    };
    
    let totalSales = 0;
    let totalReceipts = receipts.length;
    
    // Process each receipt
    receipts.forEach(receipt => {
      const { items, modifiers } = processReceiptItemsAndModifiers(receipt);
      
      // Add to total sales
      totalSales += parseFloat(receipt.totalAmount || 0);
      
      // Process items
      items.forEach(item => {
        const category = mapCategory(item.name);
        const key = `${category}:${item.name}`;
        
        if (itemTotals.has(key)) {
          const existing = itemTotals.get(key)!;
          existing.quantity += item.quantity;
          existing.sales += item.price;
        } else {
          itemTotals.set(key, {
            category,
            quantity: item.quantity,
            sales: item.price
          });
        }
        
        // Update category counts
        if (category in categoryCounts) {
          categoryCounts[category as keyof typeof categoryCounts] += item.quantity;
        }
      });
      
      // Process modifiers
      modifiers.forEach(modifier => {
        if (modifierTotals.has(modifier.name)) {
          const existing = modifierTotals.get(modifier.name)!;
          existing.quantity += modifier.quantity;
          existing.sales += modifier.price;
        } else {
          modifierTotals.set(modifier.name, {
            quantity: modifier.quantity,
            sales: modifier.price
          });
        }
      });
    });
    
    // Clear existing data for this shift
    const shiftDateStr = shiftDate.toISOString().split('T')[0];
    await db.delete(shiftItemSales).where(eq(shiftItemSales.shiftDate, shiftDateStr));
    await db.delete(shiftModifierSales).where(eq(shiftModifierSales.shiftDate, shiftDateStr));
    await db.delete(shiftSummary).where(eq(shiftSummary.shiftDate, shiftDateStr));
    
    // Insert item sales data
    const itemSalesData = Array.from(itemTotals.entries()).map(([key, data]) => {
      const [category, itemName] = key.split(':');
      return {
        shiftDate: shiftDateStr,
        category,
        itemName,
        quantity: data.quantity,
        salesTotal: data.sales.toString()
      };
    });
    
    if (itemSalesData.length > 0) {
      await db.insert(shiftItemSales).values(itemSalesData);
    }
    
    // Insert modifier sales data
    const modifierSalesData = Array.from(modifierTotals.entries()).map(([modifierName, data]) => ({
      shiftDate: shiftDateStr,
      modifierName,
      quantity: data.quantity,
      salesTotal: data.sales.toString()
    }));
    
    if (modifierSalesData.length > 0) {
      await db.insert(shiftModifierSales).values(modifierSalesData);
    }
    
    // Insert shift summary
    await db.insert(shiftSummary).values({
      shiftDate: shiftDateStr,
      burgersSold: categoryCounts.BURGERS,
      drinksSold: categoryCounts.DRINKS,
      sidesSold: categoryCounts.SIDE_ORDERS,
      extrasSold: categoryCounts.BURGER_EXTRAS,
      otherSold: categoryCounts.OTHER,
      totalSales: totalSales.toString(),
      totalReceipts
    });
    
    console.log(`Shift analytics processed successfully:`);
    console.log(`- Items: ${itemSalesData.length} unique items`);
    console.log(`- Modifiers: ${modifierSalesData.length} unique modifiers`);
    console.log(`- Categories: Burgers ${categoryCounts.BURGERS}, Drinks ${categoryCounts.DRINKS}, Sides ${categoryCounts.SIDE_ORDERS}`);
    console.log(`- Total Sales: ฿${totalSales.toFixed(2)}`);
    
    return { 
      success: true, 
      message: `Shift analytics processed: ${itemSalesData.length} items, ${modifierSalesData.length} modifiers, ฿${totalSales.toFixed(2)} total sales` 
    };
    
  } catch (error) {
    console.error('Error processing shift analytics:', error);
    return { success: false, message: `Error processing shift analytics: ${error}` };
  }
};

// Get shift analytics data
export const getShiftAnalytics = async (shiftDateStr: string) => {
  try {
    // Get shift summary
    const [summary] = await db
      .select()
      .from(shiftSummary)
      .where(eq(shiftSummary.shiftDate, shiftDateStr))
      .limit(1);
    
    if (!summary) {
      return null;
    }
    
    // Get items breakdown
    const items = await db
      .select()
      .from(shiftItemSales)
      .where(eq(shiftItemSales.shiftDate, shiftDateStr));
    
    // Get modifiers breakdown
    const modifiers = await db
      .select()
      .from(shiftModifierSales)
      .where(eq(shiftModifierSales.shiftDate, shiftDateStr));
    
    return {
      shiftDate: shiftDateStr,
      totals: {
        burgers: summary.burgersSold,
        drinks: summary.drinksSold,
        sides: summary.sidesSold,
        extras: summary.extrasSold,
        other: summary.otherSold,
        totalSales: parseFloat(summary.totalSales || '0'),
        totalReceipts: summary.totalReceipts
      },
      items: items.map(item => ({
        category: item.category,
        name: item.itemName,
        quantity: item.quantity,
        sales: parseFloat(item.salesTotal || '0')
      })),
      modifiers: modifiers.map(modifier => ({
        name: modifier.modifierName,
        quantity: modifier.quantity,
        sales: parseFloat(modifier.salesTotal || '0')
      }))
    };
  } catch (error) {
    console.error('Error getting shift analytics:', error);
    return null;
  }
};