import nodemailer from "nodemailer";

// Helper function to get variances
async function getVariance(shiftDate: string) {
  // Mock implementation - would call actual variance calculation
  return [
    { item: 'beef', expected: 95.5, actual: 90.0, variance: 5.5 },
    { item: 'cheese', expected: 50.0, actual: 48.0, variance: 2.0 }
  ];
}

export async function sendDailyEmail(latestSales: any) {
  const variances = await getVariance(latestSales.shiftDate); // Internal
  let content = `
Daily Sales Report for ${latestSales.shiftDate}

Sales: ฿${latestSales.totalSales}

Discrepancies: ${variances.map(v => `${v.item}: Expected ${v.expected.toFixed(3)} vs Actual ${v.actual} (Variance ${v.variance.toFixed(3)})`).join('\n')}
`;
  
  // Est. costs from shopping (existing)
  await sendReportEmail({
    to: 'smashbrothersburgersth@gmail.com',
    subject: `Daily Report - ${latestSales.shiftDate}`,
    html: content
  });
}

export async function sendReportEmail({ to, subject, html, attachments = [] as any[] }: {
  to: string; 
  subject: string; 
  html: string; 
  attachments?: any[]
}) {
  const user = process.env.GMAIL_USER as string;
  const pass = process.env.GMAIL_PASS as string;
  if (!user || !pass) throw new Error("GMAIL_USER or GMAIL_PASS not set");

  const transporter = nodemailer.createTransport({
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