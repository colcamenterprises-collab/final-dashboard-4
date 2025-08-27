/**
 * Jussi email service for daily management reports
 */
import nodemailer from 'nodemailer';

/**
 * Create email transporter
 */
function createTransporter() {
  return nodemailer.createTransporter({
    host: process.env.SMTP_HOST || 'smtp.gmail.com',
    port: parseInt(process.env.SMTP_PORT || '587'),
    secure: false,
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS
    }
  });
}

/**
 * Generate plain text report
 */
function generateTextReport(data) {
  const { restaurant, analytics, dailyStock, expenses, summary } = data;
  
  const lines = [
    `DAILY OPERATIONS REPORT - ${restaurant.name}`,
    `Report Date: ${new Date().toLocaleDateString('en-TH')}`,
    `Shift Date: ${analytics?.shiftDate ? new Date(analytics.shiftDate).toLocaleDateString('en-TH') : 'N/A'}`,
    '',
    '=== SALES OVERVIEW ===',
    `Total Sales: ฿${summary.totalSales?.toFixed(2) || '0.00'}`,
    `Payment Breakdown:`,
    `- Cash: ฿${summary.cashSales?.toFixed(2) || '0.00'}`,
    `- QR: ฿${summary.qrSales?.toFixed(2) || '0.00'}`,
    `- Grab: ฿${summary.grabSales?.toFixed(2) || '0.00'}`,
    `- Aroi Dee: ฿${summary.aroiDeeSales?.toFixed(2) || '0.00'}`,
    '',
    '=== TOP SELLERS ===',
    'By Quantity:'
  ];

  // Add top sellers by quantity
  if (analytics?.top5ByQty?.length) {
    analytics.top5ByQty.forEach((item, index) => {
      lines.push(`${index + 1}. ${item.name}: ${item.qty} units`);
    });
  } else {
    lines.push('No data available');
  }

  lines.push('', 'By Revenue:');
  
  // Add top sellers by revenue
  if (analytics?.top5ByRevenue?.length) {
    analytics.top5ByRevenue.forEach((item, index) => {
      lines.push(`${index + 1}. ${item.name}: ฿${item.revenue.toFixed(2)}`);
    });
  } else {
    lines.push('No data available');
  }

  // Stock information
  lines.push('', '=== STOCK STATUS ===');
  if (dailyStock) {
    lines.push(`Burger Buns: ${dailyStock.burgerBuns || 0}`);
    lines.push(`Meat: ${dailyStock.meatGrams || 0}g`);
    
    if (dailyStock.drinkStock && typeof dailyStock.drinkStock === 'object') {
      lines.push('Drinks:');
      Object.entries(dailyStock.drinkStock).forEach(([drink, qty]) => {
        lines.push(`- ${drink}: ${qty}`);
      });
    }
  } else {
    lines.push('Stock data not available');
  }

  // Variance analysis
  if (analytics?.variance) {
    lines.push('', '=== VARIANCE ANALYSIS ===');
    const { variance } = analytics;
    
    if (variance.buns) {
      lines.push(`Buns - Expected: ${variance.buns.expected}, Actual: ${variance.buns.actual}, Difference: ${variance.buns.difference}`);
    }
    if (variance.meat) {
      lines.push(`Meat - Expected: ${variance.meat.expected}g, Actual: ${variance.meat.actual}g, Difference: ${variance.meat.difference}g`);
    }
    if (variance.drinks) {
      lines.push(`Drinks - Expected: ${variance.drinks.expected}, Actual: ${variance.drinks.actual}, Difference: ${variance.drinks.difference}`);
    }
  }

  // Shopping list
  if (analytics?.shoppingList?.length) {
    lines.push('', '=== SHOPPING LIST ===');
    analytics.shoppingList.forEach(item => {
      lines.push(`- ${item.item}: ${item.suggestedQty} (${item.reason})`);
    });
  }

  // Expenses
  if (expenses?.length) {
    lines.push('', '=== NOTABLE EXPENSES ===');
    expenses.forEach(expense => {
      lines.push(`- ${expense.item}: ฿${(expense.costCents / 100).toFixed(2)} (${expense.supplier || 'Unknown supplier'})`);
    });
  }

  // Flags and action points
  if (analytics?.flags?.length) {
    lines.push('', '=== ACTION POINTS ===');
    analytics.flags.forEach(flag => {
      lines.push(`⚠️ ${flag}`);
    });
  }

  return lines.join('\n');
}

/**
 * Generate HTML report
 */
function generateHtmlReport(data) {
  const { restaurant, analytics, dailyStock, expenses, summary } = data;
  
  return `
<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <title>Daily Operations Report</title>
    <style>
        body { font-family: Arial, sans-serif; margin: 20px; color: #333; }
        .header { background: #1a365d; color: white; padding: 20px; border-radius: 8px; margin-bottom: 20px; }
        .section { margin-bottom: 25px; padding: 15px; border: 1px solid #e2e8f0; border-radius: 6px; }
        .section h3 { margin-top: 0; color: #1a365d; border-bottom: 2px solid #4299e1; padding-bottom: 5px; }
        .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; }
        .metric { background: #f7fafc; padding: 10px; border-radius: 4px; margin: 5px 0; }
        .metric strong { color: #2d3748; }
        .warning { background: #fed7d7; border-left: 4px solid #f56565; padding: 10px; margin: 5px 0; }
        .list-item { padding: 5px 0; border-bottom: 1px solid #e2e8f0; }
        .currency { color: #38a169; font-weight: bold; }
    </style>
</head>
<body>
    <div class="header">
        <h1>Daily Operations Report</h1>
        <p><strong>${restaurant.name}</strong></p>
        <p>Report Date: ${new Date().toLocaleDateString('en-TH')} | Shift Date: ${analytics?.shiftDate ? new Date(analytics.shiftDate).toLocaleDateString('en-TH') : 'N/A'}</p>
    </div>

    <div class="grid">
        <div class="section">
            <h3>Sales Overview</h3>
            <div class="metric">Total Sales: <span class="currency">฿${summary.totalSales?.toFixed(2) || '0.00'}</span></div>
            <div class="metric">Cash: <span class="currency">฿${summary.cashSales?.toFixed(2) || '0.00'}</span></div>
            <div class="metric">QR: <span class="currency">฿${summary.qrSales?.toFixed(2) || '0.00'}</span></div>
            <div class="metric">Grab: <span class="currency">฿${summary.grabSales?.toFixed(2) || '0.00'}</span></div>
            <div class="metric">Aroi Dee: <span class="currency">฿${summary.aroiDeeSales?.toFixed(2) || '0.00'}</span></div>
        </div>

        <div class="section">
            <h3>Stock Status</h3>
            ${dailyStock ? `
                <div class="metric">Burger Buns: <strong>${dailyStock.burgerBuns || 0}</strong></div>
                <div class="metric">Meat: <strong>${dailyStock.meatGrams || 0}g</strong></div>
                ${dailyStock.drinkStock ? Object.entries(dailyStock.drinkStock).map(([drink, qty]) => 
                    `<div class="metric">${drink}: <strong>${qty}</strong></div>`
                ).join('') : ''}
            ` : '<div class="metric">Stock data not available</div>'}
        </div>
    </div>

    ${analytics?.top5ByQty?.length ? `
    <div class="section">
        <h3>Top Sellers by Quantity</h3>
        ${analytics.top5ByQty.map((item, index) => 
            `<div class="list-item">${index + 1}. ${item.name}: <strong>${item.qty} units</strong></div>`
        ).join('')}
    </div>
    ` : ''}

    ${analytics?.shoppingList?.length ? `
    <div class="section">
        <h3>Shopping List</h3>
        ${analytics.shoppingList.map(item => 
            `<div class="list-item">
                <strong>${item.item}</strong>: ${item.suggestedQty} 
                <em>(${item.reason})</em>
                ${item.priority === 'high' ? '<span style="color: #f56565;">⚠️ High Priority</span>' : ''}
             </div>`
        ).join('')}
    </div>
    ` : ''}

    ${analytics?.flags?.length ? `
    <div class="section">
        <h3>Action Points</h3>
        ${analytics.flags.map(flag => 
            `<div class="warning">⚠️ ${flag}</div>`
        ).join('')}
    </div>
    ` : ''}

    <div class="section">
        <h3>Report Generated</h3>
        <p>This report was automatically generated by Jussi - Head of Operations AI System</p>
        <p>For questions or concerns, contact: ${restaurant.email || 'management@restaurant.com'}</p>
    </div>
</body>
</html>`;
}

/**
 * Send daily report email
 */
export async function sendDailyReport(reportData) {
  const { restaurant } = reportData;
  
  const recipientEmail = process.env.DAILY_REPORT_TO || restaurant.email || 'smashbrothersburgersth@gmail.com';
  const fromEmail = process.env.EMAIL_FROM || 'Smash Brothers Ops <smashbrothersburgersth@gmail.com>';
  
  const subject = `Daily Operations Report - ${restaurant.name} - ${new Date().toLocaleDateString('en-TH')}`;
  const textContent = generateTextReport(reportData);
  const htmlContent = generateHtmlReport(reportData);

  const transporter = createTransporter();
  
  await transporter.verify();
  
  const mailOptions = {
    from: fromEmail,
    to: recipientEmail,
    subject,
    text: textContent,
    html: htmlContent,
    replyTo: restaurant.email || 'smashbrothersburgersth@gmail.com'
  };

  const result = await transporter.sendMail(mailOptions);
  
  return {
    messageId: result.messageId,
    recipient: recipientEmail,
    subject
  };
}