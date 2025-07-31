import sgMail from '@sendgrid/mail';
import type { DailyStockSales, ShoppingList } from '@shared/schema';

interface ManagementSummaryData {
  formData: DailyStockSales;
  shoppingList: ShoppingList[];
  receiptPhotos: Array<{filename: string, base64Data: string, uploadedAt: string}>;
  submissionTime: Date;
}

class SendGridService {
  private isInitialized = false;

  private initialize() {
    if (this.isInitialized) return true;

    const sendGridApiKey = process.env.SENDGRID_API_KEY;
    
    if (!sendGridApiKey) {
      console.log('📧 SendGrid API key not found');
      return false;
    }
    
    console.log('📧 Initializing SendGrid email service');
    sgMail.setApiKey(sendGridApiKey);
    this.isInitialized = true;
    return true;
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

  async sendManagementSummary(data: ManagementSummaryData): Promise<boolean> {
    if (!this.initialize()) {
      console.error('❌ SendGrid not initialized');
      return false;
    }

    const { formData, receiptPhotos, submissionTime } = data;
    const fromEmail = process.env.SENDGRID_FROM_EMAIL || 'noreply@restaurant.com';
    const toEmail = process.env.SENDGRID_TO_EMAIL || 'colcamenterprises@gmail.com';
    
    try {
      console.log('📧 Sending management summary via SendGrid...');
      
      const msg = {
        to: toEmail,
        from: fromEmail,
        subject: `Daily Stock & Sales Report - ${formData.completedBy} (${new Date(formData.shiftDate).toLocaleDateString()})`,
        html: this.generateEmailHTML(data),
        attachments: receiptPhotos.map(photo => ({
          filename: photo.filename,
          content: photo.base64Data.split(',')[1], // Remove data:image/jpeg;base64, prefix
          type: 'image/jpeg',
          disposition: 'attachment'
        }))
      };

      await sgMail.send(msg);
      console.log('✅ Management summary sent successfully via SendGrid');
      return true;
    } catch (error) {
      console.error('❌ Failed to send management summary via SendGrid:', error);
      return false;
    }
  }
}

export const sendGridService = new SendGridService();