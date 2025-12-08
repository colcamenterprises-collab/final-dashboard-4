// PATCH 7 — SHIFT REPORT EMAIL SUMMARY
import { db } from "../lib/prisma";
import { transporter } from "../email/mailer";

export async function sendShiftReportEmail(reportId: string) {
  const prisma = db();
  const report = await prisma.shift_report_v2.findUnique({
    where: { id: reportId }
  });

  if (!report) return;

  const v = (report.variances as any) || {};
  const date = new Date(report.shiftDate).toLocaleString("en-TH", {
    timeZone: "Asia/Bangkok"
  });

  const subject = `Shift Report — ${date} — Severity: ${v.level || "UNKNOWN"}`;

  const body = `
Shift Report Summary
Shift Date: ${date}
Severity: ${v.level || "N/A"}

Cash Variance: ${v.cashVariance ?? "N/A"}
QR Variance: ${v.qrVariance ?? "N/A"}
QR Settlement Variance: ${v.qrSettlementVariance ?? "N/A"}
Grab Variance: ${v.grabVariance ?? "N/A"}
Total Sales Variance: ${v.totalSalesVariance ?? "N/A"}

Warnings:
${(v.warnings || []).join("\n") || "None"}

Errors:
${(v.errors || []).join("\n") || "None"}

AI Insights:
${report.aiInsights || "No insights available."}

View Detailed Report:
https://smash-brothers-dashboard.replit.app/reports/shift-report/view/${report.id}

Download PDF:
https://smash-brothers-dashboard.replit.app/api/shift-report/pdf/${report.id}
`;

  await transporter.sendMail({
    from: "Shift Reports <colcamenterprises@gmail.com>",
    to: "smashbrothersburgersth@gmail.com",
    subject,
    text: body
  });

  console.log("[SHIFT REPORT EMAIL] Email sent for report:", reportId);
  return true;
}
