import nodemailer from 'nodemailer';
import type { Transporter } from 'nodemailer';
import { google } from 'googleapis';

class EmailService {
  private transporter: Transporter | null = null;
  private initialized = false;

  async initialize() {
    if (this.initialized) return;

    // Check if we have all required OAuth2 credentials
    const hasOAuth2Creds = process.env.GOOGLE_CLIENT_ID && 
                          process.env.GOOGLE_CLIENT_SECRET && 
                          process.env.GOOGLE_REFRESH_TOKEN &&
                          process.env.GMAIL_USER;

    if (hasOAuth2Creds) {
      try {
        console.log('🔐 Initializing Gmail OAuth2 authentication...');
        await this.setupOAuth2();
        console.log('✅ OAuth2 email service initialized successfully');
        this.initialized = true;
        return;
      } catch (error) {
        console.error('❌ OAuth2 authentication failed:', error);
      }
    }

    // Fallback to app password authentication
    console.log('🔐 Using Gmail app password authentication...');
    this.setupAppPassword();
    this.initialized = true;
  }

  private async setupOAuth2() {
    const oauth2Client = new google.auth.OAuth2(
      process.env.GOOGLE_CLIENT_ID,
      process.env.GOOGLE_CLIENT_SECRET,
      'https://developers.google.com/oauthplayground'
    );

    oauth2Client.setCredentials({
      refresh_token: process.env.GOOGLE_REFRESH_TOKEN
    });

    try {
      const accessToken = await oauth2Client.getAccessToken();
      
      if (!accessToken.token) {
        throw new Error('Failed to get access token');
      }

      // Use the GMAIL_USER environment variable which now contains the actual email address
      const userEmail = process.env.GMAIL_USER || 'colcamenterprises@gmail.com';
      
      this.transporter = nodemailer.createTransport({
        service: 'gmail',
        auth: {
          type: 'OAuth2',
          user: userEmail,
          clientId: process.env.GOOGLE_CLIENT_ID,
          clientSecret: process.env.GOOGLE_CLIENT_SECRET,
          refreshToken: process.env.GOOGLE_REFRESH_TOKEN,
          accessToken: accessToken.token,
        },
      });

      console.log('✅ OAuth2 email service initialized successfully');
    } catch (error) {
      console.error('❌ OAuth2 setup failed:', error);
      throw error;
    }
  }

  private setupAppPassword() {
    // Use the GMAIL_USER environment variable which now contains the actual email address
    const gmailUser = process.env.GMAIL_USER || 'colcamenterprises@gmail.com';
    // Clean up the app password by removing quotes, spaces, and other potential formatting issues
    const gmailPassword = (process.env.GMAIL_APP_PASSWORD || '')
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
          <li>Total Sales: THB ${parseFloat(reportData.totalSales || '0').toFixed(2)}</li>
          <li>Cash Sales: THB ${parseFloat(reportData.cashSales || '0').toFixed(2)}</li>
          <li>Grab Sales: THB ${parseFloat(reportData.grabSales || '0').toFixed(2)}</li>
          <li>QR Scan Sales: THB ${parseFloat(reportData.qrScanSales || '0').toFixed(2)}</li>
        </ul>
        
        <h3>Cash Management</h3>
        <ul>
          <li>Starting Cash: THB ${parseFloat(reportData.startingCash || '0').toFixed(2)}</li>
          <li>Ending Cash: THB ${parseFloat(reportData.endingCash || '0').toFixed(2)}</li>
          <li>Total Expenses: THB ${parseFloat(reportData.totalExpenses || '0').toFixed(2)}</li>
        </ul>
        
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