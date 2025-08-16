import nodemailer from "nodemailer";
import fs from "fs";

const SMTP_HOST = process.env.SMTP_HOST || "smtp.gmail.com";
const SMTP_PORT = parseInt(process.env.SMTP_PORT || "587");
const SMTP_USER = process.env.SMTP_USER;
const SMTP_PASS = process.env.SMTP_PASS;
const FROM_EMAIL = process.env.SMTP_FROM || "smashbrothersburgersth@gmail.com";

export async function sendDailyReportEmail(opts: {
  pdfPath: string;
  salesData: {
    id: string;
    shiftDate?: string;
    completedBy: string;
    totalSales: number;
    totalExpenses: number;
  };
  to?: string;
}) {
  const { pdfPath, salesData, to = "smashbrothersburgersth@gmail.com" } = opts;

  if (!SMTP_USER || !SMTP_PASS) {
    throw new Error("SMTP credentials not configured");
  }

  const transporter = nodemailer.createTransport({
    host: SMTP_HOST,
    port: SMTP_PORT,
    secure: false,
    auth: {
      user: SMTP_USER,
      pass: SMTP_PASS
    }
  });

  const subject = `Daily Report - ${salesData.shiftDate || new Date().toISOString().split('T')[0]}`;
  
  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <h2 style="color: #059669; text-align: center;">Smash Brothers Burgers - Daily Report</h2>
      
      <div style="background: #f8f9fa; padding: 20px; border-radius: 8px; margin: 20px 0;">
        <h3>Shift Summary</h3>
        <p><strong>Date:</strong> ${salesData.shiftDate || 'N/A'}</p>
        <p><strong>Completed By:</strong> ${salesData.completedBy}</p>
        <p><strong>Total Sales:</strong> ฿${salesData.totalSales.toLocaleString()}</p>
        <p><strong>Total Expenses:</strong> ฿${salesData.totalExpenses.toLocaleString()}</p>
        <p><strong>Form ID:</strong> ${salesData.id}</p>
      </div>
      
      <p>Please find the detailed daily report attached as a PDF.</p>
      
      <div style="text-align: center; margin-top: 30px; padding-top: 20px; border-top: 1px solid #e5e7eb; color: #6b7280; font-size: 14px;">
        Generated automatically by Smash Brothers Burgers Management System
      </div>
    </div>
  `;

  const info = await transporter.sendMail({
    from: FROM_EMAIL,
    to,
    subject,
    html,
    attachments: [
      {
        filename: `daily-report-${salesData.id}.pdf`,
        path: pdfPath
      }
    ]
  });

  console.log(`📧 Daily report email sent: ${info.messageId}`);
  return info;
}