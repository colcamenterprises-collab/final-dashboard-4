// PATCH 7 — SHIFT REPORT EMAIL SUMMARY
import { db } from "../lib/prisma";
import { transporter } from "../email/mailer";
import { DateTime } from "luxon";
import { getDailySalesFormNormalized, getShiftSnapshot, upsertFormSnapshot } from "./shiftApprovalService";
import { storeShiftSnapshot } from "./loyverseService";

function getAppBaseUrl(context: string): string | null {
  const appBaseUrl = process.env.APP_BASE_URL?.replace(/\/$/, '');
  if (!appBaseUrl) {
    console.error(`❌ APP_BASE_URL not configured - cannot build ${context} links`);
    return null;
  }
  return appBaseUrl;
}

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
  const appBaseUrl = getAppBaseUrl("shift report email");
  if (!appBaseUrl) return false;

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
${appBaseUrl}/reports/shift-report/view/${report.id}

Download PDF:
${appBaseUrl}/api/shift-report/pdf/${report.id}
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

function toNumber(v: any): number {
  const n = Number(v ?? 0);
  return Number.isFinite(n) ? n : 0;
}

type AuditFlag = {
  category: string;
  form: number;
  pos: number | null;
  diff: number | null;
  flagged: boolean;
  status: 'OK' | 'FLAG' | 'UNAVAILABLE';
};

function computeFlags(formData: any, posData: any): AuditFlag[] {
  // POS reconciliation is sales-only. Expenses are reconciled from their own
  // canonical expense sources and must not be compared to a made-up POS zero.
  const categories = ['total', 'cash', 'qr', 'grab', 'other'];
  const sourceAvailable = posData?.sourceAvailable === true;

  return categories.map((category): AuditFlag => {
    const form = toNumber(formData?.[category]);
    if (!sourceAvailable) {
      return {
        category,
        form,
        pos: null,
        diff: null,
        flagged: true,
        status: 'UNAVAILABLE',
      };
    }

    const pos = toNumber(posData?.[category]);
    const diff = Math.abs(form - pos);
    const threshold = Math.max(5, Math.abs(pos) * 0.05);
    const flagged = diff > threshold;
    return {
      category,
      form,
      pos,
      diff,
      flagged,
      status: flagged ? 'FLAG' : 'OK',
    };
  });
}

export async function runDailyShiftAnomalyAudit(targetDate?: string) {
  const date = targetDate
    ? DateTime.fromISO(targetDate, { zone: 'Asia/Bangkok' })
    : DateTime.now().setZone('Asia/Bangkok').minus({ days: 1 });
  const dateISO = date.toISODate()!;

  // Rebuild the comparison side from the live SBB POS for this exact business
  // day before reading the snapshot. If the POS query fails, the audit fails
  // rather than emailing false 0.00 values.
  await storeShiftSnapshot(dateISO);
  const formData = await getDailySalesFormNormalized(dateISO);
  await upsertFormSnapshot(dateISO, formData);

  const snapshot = await getShiftSnapshot(dateISO);
  const posData = snapshot?.pos_data ?? null;
  const approved = Boolean(snapshot?.approved);
  const flags = computeFlags(formData, posData);
  const anomalies = flags.filter((f) => f.flagged);

  if (approved && anomalies.length === 0) {
    return { skipped: true, reason: 'approved_and_clean', date: dateISO };
  }

  const rows = flags
    .map((f) => `<tr>
      <td>${String(f.category)}</td>
      <td>${f.form.toFixed(2)}</td>
      <td>${f.pos == null ? 'UNAVAILABLE' : f.pos.toFixed(2)}</td>
      <td>${f.diff == null ? '—' : f.diff.toFixed(2)}</td>
      <td>${f.status}</td>
    </tr>`)
    .join('');

  const appBaseUrl = getAppBaseUrl('shift anomaly summary');
  if (!appBaseUrl) return { sent: false, date: dateISO, reason: 'missing_APP_BASE_URL' };

  const shiftUrl = `${appBaseUrl}/operations/analysis/daily-shift-analysis?date=${dateISO}`;
  const sourceSummary = posData?.sourceAvailable === true
    ? `SBB POS · ${toNumber(posData.receipt_count)} receipts · ${posData.window_start ?? ''} → ${posData.window_end ?? ''}`
    : 'SBB POS data unavailable';

  await transporter.sendMail({
    from: "Shift Reports <colcamenterprises@gmail.com>",
    to: process.env.SHIFT_ALERT_EMAIL || "smashbrothersburgersth@gmail.com",
    subject: `Shift anomaly summary ${dateISO} (approved: ${approved ? 'yes' : 'no'})`,
    html: `
      <h3>Shift Reconciliation Summary</h3>
      <p><strong>POS source:</strong> ${sourceSummary}</p>
      <table border="1" cellpadding="6" cellspacing="0">
        <thead>
          <tr><th>Category</th><th>Form</th><th>POS</th><th>Difference</th><th>Status</th></tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>
      <p>Approved: ${approved ? 'YES' : 'NO'}</p>
      <p><a href="${shiftUrl}">Open Shift Analysis</a></p>
    `,
  });

  return {
    sent: true,
    date: dateISO,
    anomalies: anomalies.length,
    approved,
    posReceiptCount: posData?.sourceAvailable === true ? toNumber(posData.receipt_count) : null,
  };
}
