import nodemailer from 'nodemailer';
import type { Transporter } from 'nodemailer';
import { google } from 'googleapis';

class EmailService {
  private transporter: Transporter | null = null;
  private initialized = false;

  async initialize() {
    if (this.initialized) return;

    // Always use Gmail app password authentication (OAuth2 removed)
    console.log('🔐 Using Gmail app password authentication...');
    this.setupAppPassword();
    this.initialized = true;
  }

  // OAuth2 method removed - using only Gmail App Password

  private setupAppPassword() {
    // Use GOOGLE_EMAIL for the actual email address
    const gmailUser = process.env.GOOGLE_EMAIL || 'colcamenterprises@gmail.com';
    // Use GOOGLE_PASSWORD for the app password, clean up formatting issues
    const gmailPassword = (process.env.GOOGLE_PASSWORD || process.env.GMAIL_APP_PASSWORD || '')
      .replace(/["\s-]/g, '')  // Remove quotes, spaces, and dashes
      .trim();
    
    console.log('🔐 Gmail User:', gmailUser);
    console.log('🔐 Gmail Password configured:', gmailPassword.length > 0 ? 'Yes' : 'No');
    console.log('🔐 Gmail Password length:', gmailPassword.length);
    
    this.transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: gmailUser,
        pass: gmailPassword
      },
      secure: true,
      tls: {
        rejectUnauthorized: false
      }
    });
  }

  async sendEmail(to: string, subject: string, html: string, attachments?: any[]) {
    if (!this.initialized) {
      await this.initialize();
    }

    if (!this.transporter) {
      throw new Error('Email transporter not initialized');
    }

    try {
      console.log('📧 Sending email to:', to);
      console.log('📧 Subject:', subject);
      
      const mailOptions = {
        from: 'colcamenterprises@gmail.com',
        to,
        subject,
        html,
        attachments: attachments || []
      };

      const result = await this.transporter.sendMail(mailOptions);
      console.log('✅ Email sent successfully:', result.messageId);
      return true;
    } catch (error) {
      console.error('❌ Email sending failed:', error);
      return false;
    }
  }

  async sendDailyShiftReport(reportData: any, pdfBuffer: Buffer) {
    const shiftDate = new Date(reportData.shiftDate).toLocaleDateString();
    
    const subject = `Daily Shift Report - Form ${reportData.id} - ${shiftDate}`;
    
    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #333;">Daily Shift Report</h2>
        <p><strong>Date:</strong> ${shiftDate}</p>
        <p><strong>Shift:</strong> ${reportData.shiftType}</p>
        <p><strong>Completed by:</strong> ${reportData.completedBy}</p>
        
        <h3>Sales Summary</h3>
        <ul>
          <li>Total Sales: ${Number(reportData.totalSales || 0).toLocaleString('en-US', {minimumFractionDigits: 2, maximumFractionDigits: 2})}</li>
          <li>Cash Sales: ${Number(reportData.cashSales || 0).toLocaleString('en-US', {minimumFractionDigits: 2, maximumFractionDigits: 2})}</li>
          <li>Grab Sales: ${Number(reportData.grabSales || 0).toLocaleString('en-US', {minimumFractionDigits: 2, maximumFractionDigits: 2})}</li>
          <li>QR Scan Sales: ${Number(reportData.qrScanSales || 0).toLocaleString('en-US', {minimumFractionDigits: 2, maximumFractionDigits: 2})}</li>
        </ul>
        
        <h3>Cash Management</h3>
        <ul>
          <li>Starting Cash: ${Number(reportData.startingCash || 0).toLocaleString('en-US', {minimumFractionDigits: 2, maximumFractionDigits: 2})}</li>
          <li>Ending Cash: ${Number(reportData.endingCash || 0).toLocaleString('en-US', {minimumFractionDigits: 2, maximumFractionDigits: 2})}</li>
          <li>Total Expenses: ${Number(reportData.totalExpenses || 0).toLocaleString('en-US', {minimumFractionDigits: 2, maximumFractionDigits: 2})}</li>
          <li>Banked Amount: ${Number(reportData.bankedAmount || 0).toLocaleString('en-US', {minimumFractionDigits: 2, maximumFractionDigits: 2})}</li>
        </ul>

        <h3>Stock Information</h3>
        <ul>
          <li>Rolls Remaining: ${reportData.rollsEnd || 'Not specified'}</li>
          <li>Meat Remaining: ${reportData.meatEnd || 'Not specified'}</li>
        </ul>
        
        <h3>Shopping List - Required Items</h3>
        ${reportData.shoppingList && reportData.shoppingList.length > 0 ? `
        <ul style="background-color: #f8f9fa; padding: 15px; border-left: 4px solid #28a745;">
          ${reportData.shoppingList.map((item: any) => 
            `<li><strong>${item.name}</strong> – ${item.qty} ${item.unit}</li>`
          ).join('')}
        </ul>
        ` : '<p style="color: #6c757d;">No shopping items required.</p>'}
        
        <h3>Balance Status</h3>
        <div style="padding: 10px; border-radius: 5px; ${reportData.balanced ? 'background-color: #d4edda; color: #155724;' : 'background-color: #f8d7da; color: #721c24;'}">
          <strong>${reportData.balanced ? '✅ BALANCED' : '❌ NOT BALANCED'}</strong>
        </div>

        <h3>Expenses Breakdown</h3>
        <p>${reportData.expenseDescription || 'No detailed expense breakdown provided.'}</p>
        
        <p>The complete daily shift report is attached as a PDF for your records.</p>
        
        <p style="color: #666; font-size: 12px;">This email was sent automatically when the form was submitted.</p>
      </div>
    `;

    const attachments = [{
      filename: `form-${reportData.id}-daily-shift-report.pdf`,
      content: pdfBuffer,
      contentType: 'application/pdf'
    }];

    return await this.sendEmail('colcamenterprises@gmail.com', subject, html, attachments);
  }
}

// Export singleton instance
export const emailService = new EmailService();
export default EmailService;