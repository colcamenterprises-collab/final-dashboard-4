import nodemailer from 'nodemailer';

interface EmailAttachment {
  filename: string;
  content: string;
  encoding: string;
}

class SimpleEmailService {
  private transporter: nodemailer.Transporter;

  constructor() {
    this.transporter = nodemailer.createTransporter({
      service: 'gmail',
      auth: {
        user: process.env.GMAIL_USER,
        pass: process.env.GMAIL_APP_PASSWORD
      },
      tls: {
        rejectUnauthorized: false
      }
    });
  }

  async sendEmail(to: string, subject: string, html: string, attachments?: EmailAttachment[]): Promise<boolean> {
    try {
      const mailOptions: nodemailer.SendMailOptions = {
        from: `"Smash Brothers Burgers" <${process.env.GMAIL_USER}>`,
        to,
        subject,
        html,
      };

      if (attachments && attachments.length > 0) {
        mailOptions.attachments = attachments.map(att => ({
          filename: att.filename,
          content: att.content,
          encoding: att.encoding as BufferEncoding
        }));
      }

      const result = await this.transporter.sendMail(mailOptions);
      console.log('✅ Email sent successfully:', result.messageId);
      return true;
    } catch (error) {
      console.error('❌ Email sending failed:', error);
      return false;
    }
  }

  async testConnection(): Promise<boolean> {
    try {
      await this.transporter.verify();
      console.log('✅ Email service connection verified');
      return true;
    } catch (error) {
      console.error('❌ Email service connection failed:', error);
      return false;
    }
  }
}

export const simpleEmailService = new SimpleEmailService();

export const sendEmailWithAttachment = async (
  to: string,
  subject: string,
  html: string,
  attachments: EmailAttachment[]
): Promise<boolean> => {
  return await simpleEmailService.sendEmail(to, subject, html, attachments);
};

export const sendSimpleEmail = async (
  to: string,
  subject: string,
  html: string
): Promise<boolean> => {
  return await simpleEmailService.sendEmail(to, subject, html);
};