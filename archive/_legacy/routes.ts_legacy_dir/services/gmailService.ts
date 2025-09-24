import nodemailer from 'nodemailer';

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
  private transporter: any = null;

  private initializeTransporter() {
    if (this.transporter) return this.transporter;

    console.log('🔐 Initializing Gmail with App Password...');
    
    this.transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: process.env.GMAIL_USER || 'colcamenterprises@gmail.com',
        pass: process.env.GMAIL_APP_PASSWORD
      }
    });

    return this.transporter;
  }

  async sendEmail(params: EmailParams): Promise<boolean> {
    try {
      const transporter = this.initializeTransporter();
      
      const mailOptions = {
        from: params.from,
        to: params.to,
        subject: params.subject,
        html: params.html || params.text,
        attachments: params.attachments?.map(att => ({
          filename: att.filename,
          content: att.content,
          encoding: att.encoding
        })) || []
      };

      const result = await transporter.sendMail(mailOptions);
      console.log('✅ Email sent successfully:', result.messageId);
      return true;
    } catch (error) {
      console.error('❌ Email sending failed:', error);
      return false;
    }
  }

  async testConnection(): Promise<boolean> {
    try {
      const transporter = this.initializeTransporter();
      
      // Test the connection by sending a verification email
      await transporter.verify();
      console.log('✅ Gmail App Password: Connection successful');
      return true;
    } catch (error) {
      console.error('❌ Gmail App Password: Connection failed', error);
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

      <h3 style="color: #007BFF;">Sales Summary</h3>
      <table style="width: 100%; border-collapse: collapse;">
        <tr>
          <td style="padding: 8px; border-bottom: 1px solid #ddd;"><strong>Total Sales:</strong></td>
          <td style="padding: 8px; border-bottom: 1px solid #ddd; text-align: right;">${totalSales}</td>
        </tr>
        <tr>
          <td style="padding: 8px; border-bottom: 1px solid #ddd;"><strong>Cash Sales:</strong></td>
          <td style="padding: 8px; border-bottom: 1px solid #ddd; text-align: right;">${cashSales}</td>
        </tr>
        <tr>
          <td style="padding: 8px; border-bottom: 1px solid #ddd;"><strong>Card/Digital Sales:</strong></td>
          <td style="padding: 8px; border-bottom: 1px solid #ddd; text-align: right;">${cardSales}</td>
        </tr>
        <tr>
          <td style="padding: 8px; border-bottom: 1px solid #ddd;"><strong>Starting Cash:</strong></td>
          <td style="padding: 8px; border-bottom: 1px solid #ddd; text-align: right;">${startingCash}</td>
        </tr>
        <tr>
          <td style="padding: 8px; border-bottom: 1px solid #ddd;"><strong>Ending Cash:</strong></td>
          <td style="padding: 8px; border-bottom: 1px solid #ddd; text-align: right;">${endingCash}</td>
        </tr>
      </table>

      <hr style="margin: 20px 0;" />

      <h3 style="color: #007BFF;">Stock Analysis</h3>
      <table style="width: 100%; border-collapse: collapse;">
        <tr>
          <th style="padding: 8px; border-bottom: 1px solid #ddd; text-align: left;">Item</th>
          <th style="padding: 8px; border-bottom: 1px solid #ddd; text-align: right;">Used</th>
          <th style="padding: 8px; border-bottom: 1px solid #ddd; text-align: right;">Variance</th>
        </tr>
        <tr>
          <td style="padding: 8px; border-bottom: 1px solid #ddd;">Burger Buns</td>
          <td style="padding: 8px; border-bottom: 1px solid #ddd; text-align: right;">${bunsUsed}</td>
          <td style="padding: 8px; border-bottom: 1px solid #ddd; text-align: right;">-</td>
        </tr>
        <tr>
          <td style="padding: 8px; border-bottom: 1px solid #ddd;">Meat (grams)</td>
          <td style="padding: 8px; border-bottom: 1px solid #ddd; text-align: right;">${meatUsed}g</td>
          <td style="padding: 8px; border-bottom: 1px solid #ddd; text-align: right;">${meatVariance > 0 ? '+' : ''}${meatVariance}g</td>
        </tr>
        <tr>
          <td style="padding: 8px; border-bottom: 1px solid #ddd;">Drinks</td>
          <td style="padding: 8px; border-bottom: 1px solid #ddd; text-align: right;">${drinksUsed}</td>
          <td style="padding: 8px; border-bottom: 1px solid #ddd; text-align: right;">-</td>
        </tr>
      </table>

      <hr style="margin: 20px 0;" />

      <h3 style="color: #007BFF;">Additional Notes</h3>
      <p style="background-color: #f8f9fa; padding: 15px; border-radius: 5px; margin: 10px 0;">
        ${discrepancyNotes}
      </p>

      <hr style="margin: 20px 0;" />

      <p style="font-size: 12px; color: #666; text-align: center;">
        This report was automatically generated by the Smash Brothers Burgers Management System<br>
        Report generated at: ${new Date().toLocaleString('en-US', { timeZone: 'Asia/Bangkok' })} (Bangkok Time)
      </p>
    </div>
  `;
}