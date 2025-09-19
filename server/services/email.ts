import nodemailer from "nodemailer";
import { getShiftReport, getLoyverseReceipts as getUtilReceipts } from '../utils/loyverse';
import { db } from '../db';
import { loyverse_shifts, loyverse_receipts, dailySalesV2 } from '../../shared/schema';
import { eq } from 'drizzle-orm';

// Helper function to get variances
async function getVariance(shiftDate: string) {
  // Mock implementation - would call actual variance calculation
  return [
    { item: 'beef', expected: 95.5, actual: 90.0, variance: 5.5 },
    { item: 'cheese', expected: 50.0, actual: 48.0, variance: 2.0 }
  ];
}

// Helper function to get Loyverse shifts data - now uses centralized utility
async function getLoyverseShifts(shiftDate: string) {
  if (!process.env.LOYVERSE_TOKEN) return { shifts: [], anomalies: ['Token missing'] };
  
  try {
    // Use centralized utility with enforced store filtering
    const shiftsData = await getShiftReport({ date: shiftDate });
    
    // Compare vs form
    const form = await db.select().from(dailySalesV2).where(eq(dailySalesV2.shiftDate, new Date(shiftDate))).limit(1);
    const anomalies = [];
    if (form[0] && shiftsData.shifts[0] && Math.abs(Number(shiftsData.shifts[0]?.net_sales) - Number(form[0].totalSales)) > Number(form[0].totalSales) * 0.01) {
      anomalies.push(`Sales discrepancy: Loyverse ${shiftsData.shifts[0]?.net_sales} vs Form ${form[0].totalSales}`);
    }
    return { shifts: shiftsData.shifts, anomalies };
  } catch (error: any) {
    console.error('Loyverse shifts error:', error);
    return { shifts: [], anomalies: [error.message] };
  }
}

// Helper function to get Loyverse receipts data - now uses centralized utility  
async function getLoyverseReceipts(shiftDate: string) {
  if (!process.env.LOYVERSE_TOKEN) return { receipts: [], itemsSold: {} };
  
  try {
    // Use centralized utility with enforced store filtering
    const receiptsData = await getUtilReceipts({ date: shiftDate });
    const receipts = receiptsData.receipts;
    
    const itemsSold = receipts.reduce((acc, r) => {
      r.line_items?.forEach((li: any) => {
        acc[li.item_name] = (acc[li.item_name] || 0) + li.quantity;
        li.modifiers?.forEach((m: any) => acc[`Modifier: ${m.name}`] = (acc[`Modifier: ${m.name}`] || 0) + 1);
      });
      return acc;
    }, {} as Record<string, number>);
    
    return { receipts, itemsSold };
  } catch (error: any) {
    console.error('Loyverse receipts error:', error);
    return { receipts: [], itemsSold: {} };
  }
}

export async function sendDailyEmail(latestSales: any) {
  const variances = await getVariance(latestSales.shiftDate);
  
  // Get Loyverse data for email
  const shifts = await getLoyverseShifts(latestSales.shiftDate);
  const receipts = await getLoyverseReceipts(latestSales.shiftDate);
  
  // Get shopping list data for email
  let shoppingListSection = '';
  try {
    // This would fetch from API in real implementation
    const mockShoppingList = {
      totalEstimatedCost: 2500,
      totalItems: 15,
      orderText: 'Meat: Beef 5kg, Chicken 3kg\nDrinks: Coke 24pcs, Water 48pcs'
    };
    
    shoppingListSection = `
Shopping List Summary:
- Total Items: ${mockShoppingList.totalItems}
- Estimated Cost: ฿${mockShoppingList.totalEstimatedCost}
- Order Details: ${mockShoppingList.orderText}
`;
  } catch (error) {
    console.log('Could not fetch shopping list for email:', error);
  }
  
  const varianceSection = variances.length > 0 ? 
    `\nVariance Analysis:\n${variances.map(v => `${v.item}: Expected ${v.expected.toFixed(1)} vs Actual ${v.actual} (Variance ${v.variance.toFixed(1)})`).join('\n')}` :
    '\nNo significant variances detected.';
  
  // Loyverse section
  const loyverseSection = `
Loyverse Shift Report: Sales Gross ${shifts.shifts[0]?.gross_sales || 'N/A'}, Net ${shifts.shifts[0]?.net_sales || 'N/A'}, Expenses ${shifts.shifts[0]?.expenses || 'N/A'}
Items Sold: ${Object.entries(receipts.itemsSold).map(([item, qty]) => `${item}: ${qty}`).join('\n')}
Anomalies: ${shifts.anomalies.join('\n')}
`;
  
  const content = `
<h2>Daily Sales Report for ${latestSales.shiftDate}</h2>

<h3>Sales Performance</h3>
<p>Total Sales: <strong>฿${latestSales.totalSales}</strong></p>

<h3>Loyverse POS Data</h3>
<pre>${loyverseSection}</pre>

<h3>Stock Variance</h3>
<pre>${varianceSection}</pre>

<h3>Shopping Requirements</h3>
<pre>${shoppingListSection}</pre>

<hr>
<p><em>Generated automatically by Restaurant Management System</em></p>
`;
  
  await sendReportEmail({
    to: 'smashbrothersburgersth@gmail.com',
    subject: `Daily Report - ${latestSales.shiftDate}`,
    html: content
  });
}

export async function sendReportEmail({ to, subject, html, attachments = [] as any[] }: {
  to: string; 
  subject: string; 
  html: string; 
  attachments?: any[]
}) {
  const user = process.env.GMAIL_USER as string;
  const pass = process.env.GMAIL_PASS as string;
  if (!user || !pass) throw new Error("GMAIL_USER or GMAIL_PASS not set");

  const transporter = nodemailer.createTransport({
    service: "gmail",
    auth: { user, pass }
  });

  await transporter.sendMail({
    from: user,
    to,
    subject,
    html,
    attachments
  });
}