/**
 * DAILY REPORT EMAIL V2
 * Sends the neobrutalist A4 PDF daily report to management.
 */

import nodemailer from "nodemailer";

export async function sendDailyReportEmailV2(pdfBuffer: Buffer, shiftDate: string) {
  const transporter = nodemailer.createTransport({
    service: "gmail",
    auth: {
      user: process.env.SBB_EMAIL_USER,
      pass: process.env.SBB_EMAIL_PASS,
    },
  });

  const mail = {
    from: process.env.SBB_EMAIL_USER,
    to: process.env.SBB_MANAGEMENT_EMAIL ?? "smashbrothersburgersth@gmail.com",
    subject: `SBB Daily Report — ${shiftDate}`,
    text: `Attached is the SBB Daily Report for ${shiftDate}.`,
    attachments: [
      {
        filename: `SBB-Daily-Report-${shiftDate}.pdf`,
        content: pdfBuffer,
      },
    ],
  };

  await transporter.sendMail(mail);
}
