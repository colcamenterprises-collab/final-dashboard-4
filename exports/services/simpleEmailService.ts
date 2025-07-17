import { google } from 'googleapis';

const gmail = google.gmail('v1');

interface SimpleFormData {
  id: number;
  completedBy: string;
  shiftType: string;
  shiftDate: string;
  startingCash: string;
  endingCash: string;
  totalSales: string;
  notes: string;
  createdAt: Date;
}

export async function sendSimpleFormEmail(formData: SimpleFormData) {
  try {
    // Gmail API OAuth setup
    const oauth2Client = new google.auth.OAuth2(
      process.env.GOOGLE_CLIENT_ID,
      process.env.GOOGLE_CLIENT_SECRET,
      'urn:ietf:wg:oauth:2.0:oob'
    );

    oauth2Client.setCredentials({
      refresh_token: process.env.GOOGLE_REFRESH_TOKEN,
    });

    google.options({ auth: oauth2Client });

    const emailContent = `
      <html>
        <body style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <div style="background-color: #f8f9fa; padding: 20px; border-radius: 8px;">
            <h2 style="color: #333; margin-bottom: 20px;">Simple Stock & Sales Report</h2>
            
            <div style="background-color: white; padding: 20px; border-radius: 8px; margin-bottom: 20px;">
              <h3 style="color: #555; margin-bottom: 15px;">Basic Information</h3>
              <p><strong>Staff:</strong> ${formData.completedBy}</p>
              <p><strong>Shift:</strong> ${formData.shiftType}</p>
              <p><strong>Date:</strong> ${formData.shiftDate}</p>
              <p><strong>Submitted:</strong> ${formData.createdAt.toLocaleString('en-US', { timeZone: 'Asia/Bangkok' })}</p>
            </div>

            <div style="background-color: white; padding: 20px; border-radius: 8px; margin-bottom: 20px;">
              <h3 style="color: #555; margin-bottom: 15px;">Cash Summary</h3>
              <p><strong>Starting Cash:</strong> ฿${formData.startingCash || '0.00'}</p>
              <p><strong>Ending Cash:</strong> ฿${formData.endingCash || '0.00'}</p>
              <p><strong>Total Sales:</strong> ฿${formData.totalSales || '0.00'}</p>
            </div>

            ${formData.notes ? `
            <div style="background-color: white; padding: 20px; border-radius: 8px;">
              <h3 style="color: #555; margin-bottom: 15px;">Notes</h3>
              <p>${formData.notes}</p>
            </div>
            ` : ''}

            <div style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #eee; text-align: center; color: #666;">
              <p>This is an automated notification from Smash Brothers Burgers management system.</p>
            </div>
          </div>
        </body>
      </html>
    `;

    const message = {
      to: 'management@smashbrothers.co.th',
      subject: `Simple Stock Report - ${formData.completedBy} - ${formData.shiftDate}`,
      html: emailContent
    };

    const email = [
      `To: ${message.to}`,
      `Subject: ${message.subject}`,
      'Content-Type: text/html; charset=utf-8',
      '',
      message.html
    ].join('\n');

    const encodedMessage = Buffer.from(email).toString('base64').replace(/\+/g, '-').replace(/\//g, '_');

    const result = await gmail.users.messages.send({
      userId: 'me',
      requestBody: {
        raw: encodedMessage,
      },
    });

    console.log('Simple form email sent successfully:', result.data.id);
    return result.data;
  } catch (error) {
    console.error('Failed to send simple form email:', error);
    throw error;
  }
}