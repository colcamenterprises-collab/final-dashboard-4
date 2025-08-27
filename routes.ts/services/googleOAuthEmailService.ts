import nodemailer from 'nodemailer';
import { google } from 'googleapis';
import type { Transporter } from 'nodemailer';

const OAuth2 = google.auth.OAuth2;

class GoogleOAuthEmailService {
  private transporter: Transporter | null = null;
  private oauth2Client: any;

  constructor() {
    this.initializeOAuth();
  }

  private initializeOAuth() {
    // Use the OAuth credentials from your Google Developer Console
    this.oauth2Client = new OAuth2(
      process.env.GOOGLE_CLIENT_ID,
      process.env.GOOGLE_CLIENT_SECRET,
      'https://developers.google.com/oauthplayground' // Redirect URL
    );

    this.oauth2Client.setCredentials({
      refresh_token: process.env.GOOGLE_REFRESH_TOKEN
    });
  }

  private async createTransporter(): Promise<Transporter> {
    try {
      const accessToken = await this.oauth2Client.getAccessToken();

      const transporter = nodemailer.createTransport({
        service: 'gmail',
        auth: {
          type: 'OAuth2',
          user: process.env.GOOGLE_USER_EMAIL,
          clientId: process.env.GOOGLE_CLIENT_ID,
          clientSecret: process.env.GOOGLE_CLIENT_SECRET,
          refreshToken: process.env.GOOGLE_REFRESH_TOKEN,
          accessToken: accessToken.token,
        },
      });

      return transporter;
    } catch (error) {
      console.error('❌ Failed to create OAuth2 transporter:', error);
      throw error;
    }
  }

  async sendDailyShiftReport(reportData: any, pdfBuffer: Buffer): Promise<boolean> {
    try {
      console.log('📧 Creating OAuth2 email transporter...');
      const transporter = await this.createTransporter();

      const mailOptions = {
        from: process.env.GOOGLE_USER_EMAIL,
        to: process.env.MANAGEMENT_EMAIL || process.env.GOOGLE_USER_EMAIL,
        subject: `Daily Shift Report - ${reportData.shiftDate} - ${reportData.shiftType} Shift`,
        html: this.generateEmailTemplate(reportData),
        attachments: [
          {
            filename: `Daily-Shift-Report-${reportData.shiftDate}-${reportData.shiftType}.pdf`,
            content: pdfBuffer,
            contentType: 'application/pdf'
          }
        ]
      };

      console.log('📧 Sending OAuth2 email notification...');
      const result = await transporter.sendMail(mailOptions);
      console.log('✅ OAuth2 email sent successfully:', result.messageId);
      return true;

    } catch (error) {
      console.error('❌ OAuth2 email sending failed:', error);
      return false;
    }
  }

  private generateEmailTemplate(data: any): string {
    const totalSales = parseFloat(data.totalSales || '0');
    const totalExpenses = parseFloat(data.totalExpenses || '0');
    const endingCash = parseFloat(data.endingCash || '0');

    return `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #f9f9f9;">
        <div style="background-color: white; padding: 30px; border-radius: 10px; box-shadow: 0 2px 10px rgba(0,0,0,0.1);">
          <h2 style="color: #2c3e50; border-bottom: 3px solid #3498db; padding-bottom: 10px;">
            🍔 Daily Shift Report - ${data.shiftDate}
          </h2>
          
          <div style="background-color: #ecf0f1; padding: 15px; border-radius: 5px; margin: 20px 0;">
            <h3 style="color: #34495e; margin-top: 0;">Shift Summary</h3>
            <p><strong>Completed by:</strong> ${data.completedBy}</p>
            <p><strong>Shift Type:</strong> ${data.shiftType}</p>
            <p><strong>Date:</strong> ${data.shiftDate}</p>
          </div>

          <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin: 20px 0;">
            <div style="background-color: #d5f4e6; padding: 15px; border-radius: 5px;">
              <h4 style="color: #27ae60; margin-top: 0;">💰 Total Sales</h4>
              <p style="font-size: 24px; font-weight: bold; color: #27ae60; margin: 0;">
                ฿${totalSales.toLocaleString()}
              </p>
            </div>
            
            <div style="background-color: #ffeaa7; padding: 15px; border-radius: 5px;">
              <h4 style="color: #f39c12; margin-top: 0;">💸 Total Expenses</h4>
              <p style="font-size: 24px; font-weight: bold; color: #f39c12; margin: 0;">
                ฿${totalExpenses.toLocaleString()}
              </p>
            </div>
          </div>

          <div style="background-color: #e8f4fd; padding: 15px; border-radius: 5px; margin: 20px 0;">
            <h4 style="color: #3498db; margin-top: 0;">💵 Cash Management</h4>
            <p><strong>Starting Cash:</strong> ฿${parseFloat(data.startingCash || '0').toLocaleString()}</p>
            <p><strong>Ending Cash:</strong> ฿${endingCash.toLocaleString()}</p>
            <p><strong>Banked Amount:</strong> ฿${parseFloat(data.bankedAmount || '0').toLocaleString()}</p>
          </div>

          <p style="color: #7f8c8d; font-size: 14px; text-align: center; margin-top: 30px; border-top: 1px solid #bdc3c7; padding-top: 20px;">
            📎 Complete shift details are attached as a PDF report.<br>
            Generated automatically by Smash Brothers Burgers Management System
          </p>
        </div>
      </div>
    `;
  }
}

export default GoogleOAuthEmailService;