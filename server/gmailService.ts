import { google } from 'googleapis';
import type { DailyStockSales, ShoppingList } from '@shared/schema';

interface ManagementSummaryData {
  formData: DailyStockSales;
  shoppingList: ShoppingList[];
  receiptPhotos: Array<{filename: string, base64Data: string, uploadedAt: string}>;
  submissionTime: Date;
}

class GmailService {
  private gmail: any;
  private isInitialized = false;

  private async initialize() {
    if (this.isInitialized) return true;

    const clientId = process.env.GOOGLE_CLIENT_ID;
    const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
    const refreshToken = process.env.GOOGLE_REFRESH_TOKEN;

    if (!clientId || !clientSecret || !refreshToken) {
      console.log('📧 Gmail API credentials not found, falling back to SMTP');
      return false;
    }

    try {
      const oauth2Client = new google.auth.OAuth2(
        clientId,
        clientSecret,
        'https://developers.google.com/oauthplayground'
      );

      oauth2Client.setCredentials({
        refresh_token: refreshToken,
      });

      this.gmail = google.gmail({ version: 'v1', auth: oauth2Client });
      this.isInitialized = true;
      console.log('✅ Gmail API initialized successfully');
      return true;
    } catch (error) {
      console.error('❌ Failed to initialize Gmail API:', error);
      return false;
    }
  }

  private formatCurrency(amount: string | number): string {
    const numAmount = typeof amount === 'string' ? parseFloat(amount) : amount;
    return `฿${numAmount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
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

  private generateEmailHTML(data: ManagementSummaryData): string {
    const { formData, shoppingList, submissionTime } = data;
    const cashBalance = this.calculateCashBalance(formData);
    
    const balanceClass = cashBalance.isBalanced ? 'alert-success' : 'alert-danger';
    const balanceText = cashBalance.isBalanced ? 'BALANCED' : 'VARIANCE DETECTED';
    
    return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <title>Daily Stock & Sales Report</title>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .header { background: #2563eb; color: white; padding: 20px; text-align: center; }
          .content { padding: 20px; }
          .section { margin: 20px 0; padding: 15px; border: 1px solid #ddd; border-radius: 5px; }
          .alert { padding: 10px; border-radius: 4px; margin: 10px 0; }
          .alert-success { background: #d4edda; border: 1px solid #c3e6cb; color: #155724; }
          .alert-danger { background: #f8d7da; border: 1px solid #f5c6cb; color: #721c24; }
          table { width: 100%; border-collapse: collapse; margin: 10px 0; }
          th { background: #f8f9fa; padding: 10px; border: 1px solid #ddd; text-align: left; }
          td { padding: 8px; border: 1px solid #ddd; }
          .balance-summary { font-size: 18px; font-weight: bold; }
        </style>
      </head>
      <body>
        <div class="header">
          <h1>Daily Stock & Sales Report</h1>
          <p>Submitted: ${submissionTime.toLocaleString('en-GB', { timeZone: 'Asia/Bangkok' })} (Bangkok Time)</p>
          <p>Completed by: ${formData.completedBy}</p>
          <p>Shift: ${formData.shiftType} - ${new Date(formData.shiftDate).toLocaleDateString()}</p>
        </div>

        <div class="content">
          <!-- Cash Balance Summary -->
          <div class="alert ${balanceClass}">
            <div class="balance-summary">Cash Balance: ${balanceText}</div>
            <p>Expected Cash: ${this.formatCurrency(cashBalance.expectedCash)}</p>
            <p>Actual Cash: ${this.formatCurrency(cashBalance.actualCash)}</p>
            <p>Difference: ${this.formatCurrency(cashBalance.difference)}</p>
          </div>

          <!-- Sales Summary -->
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

          <!-- Shopping List -->
          ${shoppingList.length > 0 ? `
          <div class="section">
            <h2>🛒 Shopping List (${shoppingList.length} items)</h2>
            <table>
              <thead>
                <tr>
                  <th>Item</th>
                  <th>Quantity</th>
                  <th>Priority</th>
                  <th>Notes</th>
                </tr>
              </thead>
              <tbody>
                ${shoppingList.map(item => `
                  <tr>
                    <td>${item.itemName}</td>
                    <td>${item.quantity}</td>
                    <td>${item.priority}</td>
                    <td>${item.notes || '-'}</td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          </div>
          ` : ''}

          <!-- Receipt Photos -->
          ${data.receiptPhotos.length > 0 ? `
          <div class="section">
            <h2>📸 Receipt Photos (${data.receiptPhotos.length} attached)</h2>
            <p>Receipt photos have been attached to this email for your review.</p>
          </div>
          ` : ''}
        </div>
      </body>
      </html>
    `;
  }

  private createEmailMessage(to: string, subject: string, htmlContent: string, attachments: any[] = []) {
    const boundary = '----=_Part_' + Date.now() + '_' + Math.random().toString(36);
    
    let emailContent = [
      `To: ${to}`,
      `Subject: ${subject}`,
      `Content-Type: multipart/mixed; boundary="${boundary}"`,
      `MIME-Version: 1.0`,
      '',
      `--${boundary}`,
      `Content-Type: text/html; charset=UTF-8`,
      `Content-Transfer-Encoding: quoted-printable`,
      '',
      htmlContent,
      ''
    ];

    // Add attachments
    attachments.forEach(attachment => {
      emailContent.push(`--${boundary}`);
      emailContent.push(`Content-Type: image/jpeg; name="${attachment.filename}"`);
      emailContent.push(`Content-Transfer-Encoding: base64`);
      emailContent.push(`Content-Disposition: attachment; filename="${attachment.filename}"`);
      emailContent.push('');
      emailContent.push(attachment.content);
      emailContent.push('');
    });

    emailContent.push(`--${boundary}--`);

    return Buffer.from(emailContent.join('\r\n')).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  }

  async sendManagementSummary(data: ManagementSummaryData): Promise<boolean> {
    if (!await this.initialize()) {
      console.error('❌ Gmail API not initialized');
      return false;
    }

    const { formData, receiptPhotos, submissionTime } = data;
    const toEmail = process.env.GMAIL_USER || 'colcamenterprises@gmail.com';
    
    try {
      console.log('📧 Sending management summary via Gmail API...');
      
      const htmlContent = this.generateEmailHTML(data);
      const subject = `Daily Stock & Sales Report - ${formData.completedBy} (${new Date(formData.shiftDate).toLocaleDateString()})`;
      
      const attachments = receiptPhotos.map(photo => ({
        filename: photo.filename,
        content: photo.base64Data.split(',')[1] // Remove data:image/jpeg;base64, prefix
      }));

      const raw = this.createEmailMessage(toEmail, subject, htmlContent, attachments);

      await this.gmail.users.messages.send({
        userId: 'me',
        requestBody: {
          raw: raw
        }
      });

      console.log('✅ Management summary sent successfully via Gmail API');
      return true;
    } catch (error) {
      console.error('❌ Failed to send management summary via Gmail API:', error);
      return false;
    }
  }
}

export const gmailService = new GmailService();