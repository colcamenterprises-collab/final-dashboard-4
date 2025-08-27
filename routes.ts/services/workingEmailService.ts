import nodemailer from 'nodemailer';
import type { Transporter } from 'nodemailer';

interface EmailAttachment {
  filename: string;
  content: string | Buffer;
  encoding?: string;
  cid?: string;
}

class WorkingEmailService {
  private transporter: Transporter;

  constructor() {
    const gmailUser = process.env.GMAIL_USER || 'colcamenterprises@gmail.com';
    const gmailPassword = (process.env.GMAIL_APP_PASSWORD || 'hqtc tsyn hxxr ocra').replace(/"/g, '');
    
    console.log('🔐 Gmail User:', gmailUser);
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

  async sendEmail(to: string, subject: string, html: string, text?: string, attachments?: EmailAttachment[]): Promise<boolean> {
    try {
      const mailOptions = {
        from: `"Smash Brothers Burgers" <${process.env.GMAIL_USER}>`,
        to,
        subject,
        html,
        text,
        attachments: attachments?.map(att => ({
          filename: att.filename,
          content: att.content,
          encoding: att.encoding as BufferEncoding,
          cid: att.cid
        }))
      };

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

export const workingEmailService = new WorkingEmailService();

export const sendEmailWithAttachment = async (
  to: string,
  subject: string,
  html: string,
  attachments: EmailAttachment[],
  text?: string
): Promise<boolean> => {
  return await workingEmailService.sendEmail(to, subject, html, text, attachments);
};

export const sendSimpleEmail = async (
  to: string,
  subject: string,
  html: string
): Promise<boolean> => {
  return await workingEmailService.sendEmail(to, subject, html);
};