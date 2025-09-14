import nodemailer from "nodemailer";

// Helper function to get variances
async function getVariance(shiftDate: string) {
  // Mock implementation - would call actual variance calculation
  return [
    { item: 'beef', expected: 95.5, actual: 90.0, variance: 5.5 },
    { item: 'cheese', expected: 50.0, actual: 48.0, variance: 2.0 }
  ];
}

export async function sendDailyEmail(latestSales: any) {
  const variances = await getVariance(latestSales.shiftDate);
  
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
  
  const content = `
<h2>Daily Sales Report for ${latestSales.shiftDate}</h2>

<h3>Sales Performance</h3>
<p>Total Sales: <strong>฿${latestSales.totalSales}</strong></p>

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