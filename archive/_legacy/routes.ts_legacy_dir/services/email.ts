import nodemailer from "nodemailer";

export async function sendReportEmail({ to, subject, html, attachments = [] as any[] }) {
  const user = process.env.GMAIL_USER as string;
  const pass = process.env.GMAIL_PASS as string;
  if (!user || !pass) throw new Error("GMAIL_USER or GMAIL_PASS not set");

  const transporter = nodemailer.createTransporter({
    service: "gmail",
    auth: { user, pass }
  });

  await transporter.sendMail({
    from: user,
    to,
    subject,
    html,
    attachments
  });
}