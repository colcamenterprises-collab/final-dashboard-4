import nodemailer from "nodemailer";

const GMAIL_USER = process.env.GMAIL_USER || 'colcamenterprises@gmail.com';
const GMAIL_APP_PASSWORD = process.env.GMAIL_APP_PASSWORD;

if (!GMAIL_APP_PASSWORD) {
  console.warn("[mailer] GMAIL_APP_PASSWORD not set – using JSON transport for dev preview.");
}

export const transporter = GMAIL_APP_PASSWORD
  ? nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: GMAIL_USER,
        pass: GMAIL_APP_PASSWORD
      }
    })
  : nodemailer.createTransport({ jsonTransport: true });

export async function sendMail(opts: {
  to: string | string[];
  subject: string;
  html: string;
}) {
  const from = `"Smash Brothers Burgers" <${GMAIL_USER}>`;
  return transporter.sendMail({ from, ...opts });
}
