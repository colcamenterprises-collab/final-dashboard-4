import nodemailer from "nodemailer";

const {
  SMTP_HOST,
  SMTP_PORT,
  SMTP_SECURE,
  SMTP_USER,
  SMTP_PASS,
  EMAIL_FROM,
} = process.env;

if (!SMTP_HOST) {
  console.warn("[mailer] SMTP env not set – using JSON transport for dev preview.");
}

export const transporter =
  SMTP_HOST && SMTP_USER && SMTP_PASS
    ? nodemailer.createTransport({
        host: SMTP_HOST,
        port: Number(SMTP_PORT ?? 465),
        secure: String(SMTP_SECURE ?? "true") === "true",
        auth: { user: SMTP_USER, pass: SMTP_PASS },
      })
    : nodemailer.createTransport({ jsonTransport: true });

export async function sendMail(opts: {
  to: string | string[];
  subject: string;
  html: string;
}) {
  const from = EMAIL_FROM ?? "Smash Brothers Burgers <noreply@sbb.local>";
  return transporter.sendMail({ from, ...opts });
}
