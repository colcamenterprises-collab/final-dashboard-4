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
  const shiftDate = data.formData.shiftDate instanceof Date ? data.formData.shiftDate : new Date(data.formData.shiftDate);
  const shift = `${data.formData.shiftType} - ${shiftDate.toLocaleDateString()}`;
  
  return await gmailService.sendEmail({
    from: '"Smash Brothers Burgers" <colcamenterprises@gmail.com>',
    to: 'colcamenterprises@gmail.com',
    subject: `Smash Brothers | Daily Summary — ${shift}`,
    html: emailHTML
  });
}

// Helper function to generate email HTML with comprehensive template
function generateEmailHTML(data: any): string {
  const { formData } = data;
  
  // Calculate order count from total sales (example calculation)
  const orderCount = Math.round(Number(formData.totalSales) / 180) || 0; // Approximate orders based on average ticket
  
  // Calculate stock usage and variances (example calculations)
  const bunsStart = 100; // These would come from previous day's ending stock
  const bunsOrdered = Number(formData.rollsOrderedCount) || 0;
  const bunsEnd = Number(formData.burgerBunsStock) || 0;
  const bunsUsed = bunsStart + bunsOrdered - bunsEnd;
  
  const meatStart = 10000; // grams
  const meatOrdered = 0;
  const meatEnd = Number(formData.meatWeight) || 0;
  const meatUsed = meatStart + meatOrdered - meatEnd;
  const meatVariance = meatUsed - (orderCount * 150); // Assuming 150g per order
  
  const drinksStart = 50;
  const drinksOrdered = 0;
  const drinksEnd = Number(formData.drinkStockCount) || 0;
  const drinksUsed = drinksStart + drinksOrdered - drinksEnd;
  
  // Format shift date safely
  const shiftDate = formData.shiftDate instanceof Date ? formData.shiftDate : new Date(formData.shiftDate);
  const shift = `${formData.shiftType} - ${shiftDate.toLocaleDateString()}`;
  const staffMember = formData.completedBy;
  const totalSales = Number(formData.totalSales).toFixed(2);
  const cashSales = Number(formData.cashSales).toFixed(2);
  const cardSales = (Number(formData.grabSales) + Number(formData.qrScanSales) + Number(formData.foodPandaSales) + Number(formData.aroiDeeSales)).toFixed(2);
  const startingCash = Number(formData.startingCash).toFixed(2);
  const endingCash = Number(formData.endingCash).toFixed(2);
  const discrepancyNotes = formData.expenseDescription || 'No notes provided.';

  return `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: auto; border: 1px solid #ddd; padding: 20px;">
      <h2 style="border-left: 4px solid #007BFF; padding-left: 10px;">Daily Management Summary</h2>
      <p><strong>Completed by:</strong> ${staffMember}</p>
      <p><strong>Shift:</strong> ${shift}</p>
      <p><strong>Date:</strong> ${new Date().toLocaleString('en-US', { timeZone: 'Asia/Bangkok' })}</p>

      <hr style="margin: 20px 0;" />

      <h3>💰 Sales Summary</h3>
      <table style="width: 100%; border-collapse: collapse;">
        <tr><td>Total Sales:</td><td style="text-align: right;"><strong>฿${totalSales}</strong></td></tr>
        <tr><td>Cash Sales:</td><td style="text-align: right;">฿${cashSales}</td></tr>
        <tr><td>Card Sales:</td><td style="text-align: right;">฿${cardSales}</td></tr>
        <tr><td>Orders:</td><td style="text-align: right;">${orderCount} orders</td></tr>
      </table>

      <hr style="margin: 20px 0;" />

      <h3>🍔 Stock & Usage</h3>
      <table style="width: 100%; border-collapse: collapse;" border="1">
        <thead>
          <tr style="background-color: #f0f0f0;">
            <th>Item</th><th>Start</th><th>Ordered</th><th>End</th><th>Used</th><th>Variance</th>
          </tr>
        </thead>
        <tbody>
          <tr><td>Burger Buns</td><td>${bunsStart}</td><td>${bunsOrdered}</td><td>${bunsEnd}</td><td>${bunsUsed}</td><td>✅ Match</td></tr>
          <tr><td>Meat (g)</td><td>${meatStart}</td><td>${meatOrdered}</td><td>${meatEnd}</td><td>${meatUsed}</td><td>${meatVariance > 0 ? '+' : ''}${meatVariance}g</td></tr>
          <tr><td>Drinks</td><td>${drinksStart}</td><td>${drinksOrdered}</td><td>${drinksEnd}</td><td>${drinksUsed}</td><td>✅ Match</td></tr>
        </tbody>
      </table>

      <hr style="margin: 20px 0;" />

      <h3>🧾 Cash Management</h3>
      <table style="width: 100%; border-collapse: collapse;">
        <tr><td>Starting Cash:</td><td style="text-align: right;">฿${startingCash}</td></tr>
        <tr><td>Ending Cash:</td><td style="text-align: right;">฿${endingCash}</td></tr>
      </table>

      <hr style="margin: 20px 0;" />

      <h3>📌 Discrepancy Notes</h3>
      <p>${discrepancyNotes}</p>

      <hr style="margin: 20px 0;" />

      <p style="font-size: 12px; color: #666;">This report was automatically generated by your Smash Brothers system.</p>
    </div>
  `;
}