import nodemailer from 'nodemailer';
import sgMail from '@sendgrid/mail';
import type { DailyStockSales, ShoppingList } from '@shared/schema';

interface EmailConfig {
  host: string;
  port: number;
  secure: boolean;
  auth: {
    user: string;
    pass: string;
  };
}

interface ManagementSummaryData {
  formData: DailyStockSales;
  shoppingList: ShoppingList[];
  receiptPhotos: Array<{filename: string, base64Data: string, uploadedAt: string}>;
  submissionTime: Date;
}

class EmailService {
  private transporter: nodemailer.Transporter | null = null;

  private initializeTransporter() {
    if (this.transporter) return this.transporter;

    const email = process.env.GOOGLE_EMAIL || process.env.GMAIL_USER || 'smashbrothersburgersth@gmail.com';
    const password = process.env.GOOGLE_PASSWORD || process.env.GMAIL_APP_PASSWORD;
    
    console.log('🔧 Email config - User:', email, 'Password length:', password?.length);
    const cleanPassword = password?.replace(/['"]/g, '').trim();
    console.log('🔧 Clean password:', cleanPassword, 'Length:', cleanPassword?.length);
    
    if (!email || !password) {
      console.error('Gmail credentials are missing');
      return null;
    }

    // Gmail SMTP configuration - try TLS port 587
    const config: EmailConfig = {
      host: 'smtp.gmail.com',
      port: 587,
      secure: false, // true for 465, false for other ports
      auth: {
        user: email,
        pass: cleanPassword,
      },
      // Additional Gmail-specific settings
      tls: {
        rejectUnauthorized: false
      },
      // Connection timeout settings
      connectionTimeout: 60000,
      greetingTimeout: 30000,
      socketTimeout: 60000
    };

    this.transporter = nodemailer.createTransport(config);
    return this.transporter;
  }

  private calculateCashBalance(formData: DailyStockSales) {
    const startingCash = parseFloat(formData.startingCash);
    const totalSales = parseFloat(formData.totalSales);
    const cashSales = parseFloat(formData.cashSales);
    const totalExpenses = parseFloat(formData.totalExpenses);
    
    const expectedCash = startingCash + cashSales - totalExpenses;
    const actualCash = parseFloat(formData.endingCash);
    const difference = actualCash - expectedCash;
    const isBalanced = Math.abs(difference) <= 40; // 40 baht tolerance
    
    return {
      startingCash,
      expectedCash,
      actualCash,
      difference,
      isBalanced,
      shortfall: difference < 0 ? Math.abs(difference) : 0,
      overage: difference > 0 ? difference : 0
    };
  }

  private formatCurrency(amount: string | number): string {
    const num = typeof amount === 'string' ? parseFloat(amount) : amount;
    return `฿${num.toFixed(2)}`;
  }

  private generateFoodItemsHTML(formData: any): string {
    let html = '';
    
    const formatFieldName = (key: string) => {
      return key.replace(/([A-Z])/g, ' $1').trim()
        .replace(/^./, str => str.toUpperCase());
    };
    
    // Fresh Food Items
    if (formData.freshFood && Object.keys(formData.freshFood).length > 0) {
      const hasItems = Object.values(formData.freshFood).some((value: any) => value > 0);
      if (hasItems) {
        html += `
          <div class="section">
            <h2>🥬 Fresh Food Items</h2>
            <table>
              ${Object.entries(formData.freshFood).map(([key, value]) => 
                value > 0 ? `<tr><td><strong>${formatFieldName(key)}:</strong></td><td>${value}</td></tr>` : ''
              ).join('')}
            </table>
          </div>
        `;
      }
    }
    
    // Packaging Items
    if (formData.packagingItems && Object.keys(formData.packagingItems).length > 0) {
      const hasItems = Object.values(formData.packagingItems).some((value: any) => value > 0);
      if (hasItems) {
        html += `
          <div class="section">
            <h2>📦 Packaging & Supplies</h2>
            <table>
              ${Object.entries(formData.packagingItems).map(([key, value]) => 
                value > 0 ? `<tr><td><strong>${formatFieldName(key)}:</strong></td><td>${value}</td></tr>` : ''
              ).join('')}
            </table>
          </div>
        `;
      }
    }
    
    return html;
  }

  private generateEmailHTML(data: ManagementSummaryData): string {
    const { formData, shoppingList, receiptPhotos, submissionTime } = data;
    const balance = this.calculateCashBalance(formData);
    
    const receiptImagesHTML = receiptPhotos.map((photo, index) => `
      <div style="margin: 10px 0;">
        <p><strong>Receipt ${index + 1}:</strong> ${photo.filename}</p>
        <img src="${photo.base64Data}" alt="Receipt ${index + 1}" style="max-width: 300px; max-height: 200px; border: 1px solid #ddd; border-radius: 4px;" />
      </div>
    `).join('');

    const shoppingListHTML = shoppingList.map(item => `
      <tr>
        <td style="padding: 8px; border: 1px solid #ddd;">${item.itemName}</td>
        <td style="padding: 8px; border: 1px solid #ddd;">${item.quantity} ${item.unit}</td>
        <td style="padding: 8px; border: 1px solid #ddd;">${item.supplier}</td>
        <td style="padding: 8px; border: 1px solid #ddd;">${this.formatCurrency(item.pricePerUnit)}</td>
        <td style="padding: 8px; border: 1px solid #ddd;">${item.priority}</td>
      </tr>
    `).join('');

    return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <title>Daily Stock & Sales Summary</title>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .header { background: #2563eb; color: white; padding: 20px; text-align: center; }
          .content { padding: 20px; }
          .section { margin: 20px 0; padding: 15px; border: 1px solid #ddd; border-radius: 5px; }
          .alert { padding: 10px; border-radius: 4px; margin: 10px 0; }
          .alert-success { background: #d4edda; border: 1px solid #c3e6cb; color: #155724; }
          .alert-warning { background: #fff3cd; border: 1px solid #ffeaa7; color: #856404; }
          .alert-danger { background: #f8d7da; border: 1px solid #f5c6cb; color: #721c24; }
          table { width: 100%; border-collapse: collapse; margin: 10px 0; }
          th { background: #f8f9fa; padding: 10px; border: 1px solid #ddd; text-align: left; }
          td { padding: 8px; border: 1px solid #ddd; }
          .balance-summary { font-size: 18px; font-weight: bold; }
        </style>
      </head>
      <body>
        <div class="header">
          <h1>Completed Sales and Stock Form</h1>
          <p>Submitted: ${submissionTime.toLocaleString('en-GB', { timeZone: 'Asia/Bangkok' })} (Bangkok Time)</p>
          <p>Completed by: ${formData.completedBy}</p>
          <p>Shift: ${formData.shiftType} - ${new Date(formData.shiftDate).toLocaleDateString()}</p>
        </div>

        <div class="content">
          <!-- Sales Data -->
          <div class="section">
            <h2>📊 Sales Summary</h2>
            <table>
              <tr><td><strong>Grab Sales:</strong></td><td>${this.formatCurrency(formData.grabSales)}</td></tr>
              <tr><td><strong>FoodPanda Sales:</strong></td><td>${this.formatCurrency(formData.foodPandaSales)}</td></tr>
              <tr><td><strong>AroiDee Sales:</strong></td><td>${this.formatCurrency(formData.aroiDeeSales)}</td></tr>
              <tr><td><strong>QR Scan Sales:</strong></td><td>${this.formatCurrency(formData.qrScanSales)}</td></tr>
              <tr><td><strong>Cash Sales:</strong></td><td>${this.formatCurrency(formData.cashSales)}</td></tr>
              <tr style="background: #f8f9fa; font-weight: bold;"><td><strong>Total Sales:</strong></td><td>${this.formatCurrency(formData.totalSales)}</td></tr>
            </table>
          </div>

          <!-- Stock Details -->
          <div class="section">
            <h2>📦 Stock Details</h2>
            <table>
              <tr><td><strong>Burger Buns:</strong></td><td>${formData.burgerBunsStock}</td></tr>
              <tr><td><strong>Rolls Ordered:</strong></td><td>${formData.rollsOrderedCount}</td></tr>
              <tr><td><strong>Meat Weight:</strong></td><td>${formData.meatWeight} kg</td></tr>
              <tr><td><strong>Drink Stock:</strong></td><td>${formData.drinkStockCount}</td></tr>
              <tr><td><strong>Rolls Confirmed:</strong></td><td>${formData.rollsOrderedConfirmed ? 'Yes' : 'No'}</td></tr>
            </table>
          </div>

          ${this.generateFoodItemsHTML(formData)}

          <!-- Cash Balance Summary -->
          <div class="section">
            <h2>💰 Cash Balance Summary</h2>
            <div class="${balance.isBalanced ? 'alert alert-success' : 'alert alert-danger'}">
              <div class="balance-summary">
                Status: ${balance.isBalanced ? '✅ BALANCED' : '❌ IMBALANCED'}
                ${balance.difference !== 0 ? `(${balance.difference > 0 ? '+' : ''}${this.formatCurrency(balance.difference)})` : ''}
              </div>
            </div>
            
            <table>
              <tr><td><strong>Starting Cash:</strong></td><td>${this.formatCurrency(balance.startingCash)}</td></tr>
              <tr><td><strong>Cash Sales:</strong></td><td>${this.formatCurrency(formData.cashSales)}</td></tr>
              <tr><td><strong>Total Expenses:</strong></td><td>${this.formatCurrency(formData.totalExpenses)}</td></tr>
              <tr><td><strong>Expected Ending Cash:</strong></td><td>${this.formatCurrency(balance.expectedCash)}</td></tr>
              <tr><td><strong>Actual Ending Cash:</strong></td><td>${this.formatCurrency(balance.actualCash)}</td></tr>
              ${balance.shortfall > 0 ? `<tr style="color: #721c24;"><td><strong>Shortfall:</strong></td><td>${this.formatCurrency(balance.shortfall)}</td></tr>` : ''}
              ${balance.overage > 0 ? `<tr style="color: #155724;"><td><strong>Overage:</strong></td><td>${this.formatCurrency(balance.overage)}</td></tr>` : ''}
            </table>
          </div>

          <!-- Sales Summary -->
          <div class="section">
            <h2>📊 Sales Summary</h2>
            <table>
              <tr><td><strong>Grab Sales:</strong></td><td>${this.formatCurrency(formData.grabSales)}</td></tr>
              <tr><td><strong>Food Panda Sales:</strong></td><td>${this.formatCurrency(formData.foodPandaSales)}</td></tr>
              <tr><td><strong>Aroi Dee Sales:</strong></td><td>${this.formatCurrency(formData.aroiDeeSales)}</td></tr>
              <tr><td><strong>QR Scan Sales:</strong></td><td>${this.formatCurrency(formData.qrScanSales)}</td></tr>
              <tr><td><strong>Cash Sales:</strong></td><td>${this.formatCurrency(formData.cashSales)}</td></tr>
              <tr style="background: #f8f9fa; font-weight: bold;"><td><strong>Total Sales:</strong></td><td>${this.formatCurrency(formData.totalSales)}</td></tr>
            </table>
          </div>

          <!-- Expenses Breakdown -->
          <div class="section">
            <h2>💸 Expenses Breakdown</h2>
            <table>
              <tr><td><strong>Total Wages:</strong></td><td>${this.formatCurrency(formData.salaryWages)}</td></tr>
              <tr><td><strong>Shopping & Other:</strong></td><td>${this.formatCurrency(formData.shopping)}</td></tr>
              <tr><td><strong>Gas Expense:</strong></td><td>${this.formatCurrency(formData.gasExpense)}</td></tr>
              <tr style="background: #f8f9fa; font-weight: bold;"><td><strong>Total Expenses:</strong></td><td>${this.formatCurrency(formData.totalExpenses)}</td></tr>
            </table>
          </div>

          <!-- Shopping List -->
          ${shoppingList.length > 0 ? `
          <div class="section">
            <h2>🛒 Generated Shopping List (${shoppingList.length} items)</h2>
            <table>
              <thead>
                <tr>
                  <th>Item</th>
                  <th>Quantity</th>
                  <th>Supplier</th>
                  <th>Price/Unit</th>
                  <th>Priority</th>
                </tr>
              </thead>
              <tbody>
                ${shoppingListHTML}
              </tbody>
            </table>
          </div>
          ` : ''}

          <!-- Receipt Images -->
          ${receiptPhotos.length > 0 ? `
          <div class="section">
            <h2>📸 Receipt Images (${receiptPhotos.length} photos)</h2>
            ${receiptImagesHTML}
          </div>
          ` : ''}

          <!-- Footer -->
          <div class="section" style="text-align: center; color: #666; font-size: 12px;">
            <p>This is an automated management summary from the Restaurant Management System</p>
            <p>Generated at: ${new Date().toLocaleString('en-GB', { timeZone: 'Asia/Bangkok' })} (Bangkok Time)</p>
          </div>
        </div>
      </body>
      </html>
    `;
  }

  async sendManagementSummary(data: ManagementSummaryData): Promise<boolean> {
    try {
      const transporter = this.initializeTransporter();
      if (!transporter) {
        console.error('Failed to initialize email transporter - Gmail credentials missing');
        // Log the email content for debugging purposes
        const emailHTML = this.generateEmailHTML(data);
        console.log('=== EMAIL PREVIEW (Would be sent with proper credentials) ===');
        console.log(`From: smashbrothersburgersth@gmail.com`);
        console.log(`To: smashbrothersburgersth@gmail.com`);
        console.log(`Subject: Daily Shift Report - ${data.formData.completedBy} - ${data.formData.shiftType}`);
        console.log(`Attachments: ${data.receiptPhotos.length} receipt photos`);
        console.log('Content Preview:', emailHTML.substring(0, 800) + '...');
        console.log('=== END EMAIL PREVIEW ===');
        return false;
      }
      
      const emailHTML = this.generateEmailHTML(data);
      const balance = this.calculateCashBalance(data.formData);
      
      const subject = `Daily Sales Summary - ${data.formData.shiftType} ${new Date(data.formData.shiftDate).toLocaleDateString()} ${balance.isBalanced ? '✅' : '❌ IMBALANCED'}`;

      const mailOptions = {
        from: process.env.GOOGLE_EMAIL || process.env.GMAIL_USER,
        to: process.env.MANAGEMENT_EMAIL || process.env.GOOGLE_EMAIL || process.env.GMAIL_USER, // Fallback to sender if no management email set
        subject,
        html: emailHTML,
        attachments: data.receiptPhotos.map((photo, index) => ({
          filename: photo.filename || `receipt_${index + 1}.jpg`,
          content: photo.base64Data.split(',')[1], // Remove data:image/jpeg;base64, prefix
          encoding: 'base64'
        }))
      };

      await transporter.sendMail(mailOptions);
      console.log(`✅ Management summary email sent successfully for ${data.formData.completedBy}'s ${data.formData.shiftType}`);
      return true;
    } catch (error) {
      console.error('❌ Failed to send management summary email:', error);
      
      // Log email content for debugging
      const emailHTML = this.generateEmailHTML(data);
      const balance = this.calculateCashBalance(data.formData);
      
      const shiftDate = new Date(data.formData.shiftDate);
      const formattedDate = `${shiftDate.getDate().toString().padStart(2, '0')}/${(shiftDate.getMonth() + 1).toString().padStart(2, '0')}/${shiftDate.getFullYear()}`;
      const subject = `Completed Sales and Stock Form - ${formattedDate}`;
      
      const mailOptions = {
        from: 'smashbrothersburgersth@gmail.com',
        to: 'smashbrothersburgersth@gmail.com',
        subject: subject,
        html: emailHTML,
        attachments: data.receiptPhotos.map((photo, index) => ({
          filename: `receipt_${index + 1}_${photo.filename}`,
          content: photo.base64Data.split(',')[1],
          encoding: 'base64'
        }))
      };

      const transporter = this.initializeTransporter();
      if (!transporter) {
        throw new Error('Failed to initialize email transporter');
      }
      
      await transporter.sendMail(mailOptions);
      console.log('✅ Form summary email sent successfully to: smashbrothersburgersth@gmail.com');
      return true;
    }
  }
}

export const emailService = new EmailService();