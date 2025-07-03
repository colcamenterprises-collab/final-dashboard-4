import nodemailer from 'nodemailer';
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

    const email = process.env.GOOGLE_EMAIL || process.env.GMAIL_USER || '';
    const password = process.env.GOOGLE_PASSWORD || process.env.GMAIL_APP_PASSWORD || '';
    
    console.log('Email config - User:', email ? 'Set' : 'Missing', 'Password:', password ? 'Set' : 'Missing');
    
    if (!email || !password) {
      console.error('Gmail credentials are missing');
      return null;
    }

    // Gmail SMTP configuration - try both TLS ports
    const config: EmailConfig = {
      host: 'smtp.gmail.com',
      port: 465,
      secure: true, // true for 465, false for other ports
      auth: {
        user: email,
        pass: password,
      }
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
          <h1>Daily Stock & Sales Management Summary</h1>
          <p>Submitted: ${submissionTime.toLocaleString('en-GB', { timeZone: 'Asia/Bangkok' })} (Bangkok Time)</p>
          <p>Completed by: ${formData.completedBy}</p>
          <p>Shift: ${formData.shiftType} - ${new Date(formData.shiftDate).toLocaleDateString()}</p>
        </div>

        <div class="content">
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
        console.error('Failed to initialize email transporter');
        // Log the email content for debugging purposes
        const emailHTML = this.generateEmailHTML(data);
        console.log('Email content that would have been sent:', emailHTML.substring(0, 500) + '...');
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
      
      console.log('\n📧 EMAIL CONTENT PREVIEW:');
      console.log('Subject:', `Daily Sales Summary - ${data.formData.shiftType} ${new Date(data.formData.shiftDate).toLocaleDateString()} ${balance.isBalanced ? '✅' : '❌ IMBALANCED'}`);
      console.log('Balance Status:', balance.isBalanced ? '✅ BALANCED' : '❌ IMBALANCED');
      console.log('Cash Difference:', this.formatCurrency(balance.difference));
      console.log('Total Sales:', this.formatCurrency(data.formData.totalSales));
      console.log('Shopping List Items:', data.shoppingList.length);
      console.log('Receipt Photos:', data.receiptPhotos.length);
      console.log('\n💡 Gmail Setup Help: This requires an App Password from Google Account Settings > Security > 2-Step Verification > App passwords');
      
      return false;
    }
  }
}

export const emailService = new EmailService();