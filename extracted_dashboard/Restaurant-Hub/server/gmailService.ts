import { google } from 'googleapis';
import { OAuth2Client } from 'google-auth-library';

interface GmailConfig {
  clientId: string;
  clientSecret: string;
  refreshToken: string;
}

interface EmailParams {
  to: string;
  from: string;
  subject: string;
  text?: string;
  html?: string;
  attachments?: Array<{
    filename: string;
    content: string;
    encoding: string;
  }>;
}

class GmailService {
  private oauth2Client: OAuth2Client | null = null;
  private gmail: any = null;

  private initializeGmail() {
    const clientId = process.env.GOOGLE_CLIENT_ID;
    const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
    const refreshToken = process.env.GOOGLE_REFRESH_TOKEN;

    if (!clientId || !clientSecret || !refreshToken) {
      console.error('Gmail OAuth credentials are missing');
      return null;
    }

    this.oauth2Client = new google.auth.OAuth2(
      clientId,
      clientSecret,
      'https://developers.google.com/oauthplayground'
    );

    this.oauth2Client.setCredentials({
      refresh_token: refreshToken,
    });

    this.gmail = google.gmail({ version: 'v1', auth: this.oauth2Client });
    return this.gmail;
  }

  private createMessage(params: EmailParams): string {
    const messageParts = [
      `From: ${params.from}`,
      `To: ${params.to}`,
      `Subject: ${params.subject}`,
      'MIME-Version: 1.0',
      'Content-Type: text/html; charset=utf-8',
      '',
      params.html || params.text || ''
    ];

    const message = messageParts.join('\n');
    return Buffer.from(message).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  }

  async sendEmail(params: EmailParams): Promise<boolean> {
    try {
      const gmail = this.initializeGmail();
      if (!gmail) {
        console.error('Gmail service not initialized');
        return false;
      }

      const encodedMessage = this.createMessage(params);

      const result = await gmail.users.messages.send({
        userId: 'me',
        requestBody: {
          raw: encodedMessage,
        },
      });

      console.log('✅ Gmail API: Email sent successfully', result.data.id);
      return true;
    } catch (error) {
      console.error('❌ Gmail API Error:', error);
      return false;
    }
  }

  async testConnection(): Promise<boolean> {
    try {
      const gmail = this.initializeGmail();
      if (!gmail) {
        return false;
      }

      const result = await gmail.users.getProfile({
        userId: 'me',
      });

      console.log('✅ Gmail API: Connection successful', result.data.emailAddress);
      return true;
    } catch (error) {
      console.error('❌ Gmail API: Connection failed', error);
      return false;
    }
  }
}

export const gmailService = new GmailService();

// Export a sendManagementSummary function that matches the expected interface
export async function sendManagementSummary(data: any): Promise<boolean> {
  const emailHTML = generateEmailHTML(data);
  
  return await gmailService.sendEmail({
    from: 'colcamenterprises@gmail.com',
    to: 'colcamenterprises@gmail.com',
    subject: `Daily Management Summary - ${data.formData.completedBy} - ${data.formData.shiftDate}`,
    html: emailHTML
  });
}

// Helper function to generate email HTML (simplified version)
function generateEmailHTML(data: any): string {
  const { formData } = data;
  return `
    <html>
    <head>
      <style>
        body { font-family: Arial, sans-serif; margin: 20px; }
        .header { background: #f8f9fa; padding: 15px; border-left: 4px solid #007bff; }
        .section { margin: 20px 0; padding: 15px; border: 1px solid #ddd; border-radius: 5px; }
        table { width: 100%; border-collapse: collapse; }
        td { padding: 8px; border-bottom: 1px solid #eee; }
        .alert { padding: 10px; margin: 10px 0; border-radius: 4px; }
        .alert-success { background: #d4edda; color: #155724; border: 1px solid #c3e6cb; }
        .alert-danger { background: #f8d7da; color: #721c24; border: 1px solid #f5c6cb; }
      </style>
    </head>
    <body>
      <div class="header">
        <h1>Daily Management Summary</h1>
        <p><strong>Completed by:</strong> ${formData.completedBy}</p>
        <p><strong>Shift:</strong> ${formData.shiftType}</p>
        <p><strong>Date:</strong> ${formData.shiftDate}</p>
      </div>
      
      <div class="section">
        <h2>Sales Summary</h2>
        <table>
          <tr><td><strong>Total Sales:</strong></td><td>฿${formData.totalSales}</td></tr>
          <tr><td><strong>Cash Sales:</strong></td><td>฿${formData.cashSales}</td></tr>
        </table>
      </div>
      
      <div class="section">
        <h2>Form Submission</h2>
        <p>This is a test email from your restaurant management system.</p>
        <p>Gmail API OAuth integration is working successfully!</p>
      </div>
    </body>
    </html>
  `;
}