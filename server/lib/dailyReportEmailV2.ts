/**
 * DAILY REPORT EMAIL V2
 * Sends the neobrutalist A4 PDF daily report to management.
 */

import nodemailer from "nodemailer";

export async function sendDailyReportEmailV2(pdfBuffer: Buffer, shiftDate: string, reportJson?: any) {
  const transporter = nodemailer.createTransport({
    service: "gmail",
    auth: {
      user: process.env.SBB_EMAIL_USER,
      pass: process.env.SBB_EMAIL_PASS,
    },
  });

  const purchasedStock = reportJson?.purchasedStock ?? { rolls: 0, meatKg: "0.0", drinks: {} };
  const variance = reportJson?.variance ?? {};
  const insights = reportJson?.insights ?? {};
  const security = reportJson?.security ?? {};

  const htmlContent = `
    <h2 style="font-size:18px;font-weight:700;margin-top:30px;">AI Insights</h2>
    <p><strong>Risk Score:</strong> ${insights.riskScore || 0}/100</p>
    <ul>
      ${
        insights.insights && insights.insights.length > 0
          ? insights.insights.map((i: any) => `<li>${i.type.toUpperCase()}: ${i.message}</li>`).join("")
          : "<li>No insights generated.</li>"
      }
    </ul>

    <h2 style="font-size:18px;font-weight:700;margin-top:30px;">Purchased Stock</h2>
    <p><strong>Rolls Purchased:</strong> ${purchasedStock.rolls} units</p>
    <p><strong>Meat Purchased:</strong> ${purchasedStock.meatKg} kg</p>
    <p><strong>Drinks Purchased:</strong></p>
    <ul>
      ${
        Object.entries(purchasedStock.drinks || {})
          .map(([sku, qty]) => `<li>${sku}: ${qty}</li>`)
          .join("")
      }
    </ul>

    <h2 style="font-size:18px;font-weight:700;margin-top:30px;">Variance Summary</h2>
    <ul>
      <li><strong>Rolls:</strong> ${variance.rolls?.diff || 0}</li>
      <li><strong>Meat:</strong> ${variance.meat?.diffKg || "0.00"} kg</li>
      <li><strong>Drinks:</strong></li>
      ${
        Object.entries(variance.drinks || {})
          .map(([sku, obj]: any) => `<li>${sku}: ${obj.diff || 0}</li>`)
          .join("")
      }
    </ul>

    <h2 style="font-size:18px;font-weight:700;margin-top:30px;">Security & Theft Detection</h2>
    <p><strong>Risk Score:</strong> ${security.riskScore || 0}/100</p>
    <ul>
      ${
        security.risks && security.risks.length > 0
          ? security.risks.map((r: any) => `<li>${r.type}: ${r.message}</li>`).join("")
          : "<li>No security risks detected.</li>"
      }
    </ul>
  `;

  const mail = {
    from: process.env.SBB_EMAIL_USER,
    to: process.env.SBB_MANAGEMENT_EMAIL ?? "smashbrothersburgersth@gmail.com",
    subject: `SBB Daily Report — ${shiftDate}`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px;">
        <p>Daily Report for ${shiftDate}</p>
        ${htmlContent}
        <p style="margin-top: 30px; color: #666; font-size: 12px;">
          Please see the attached PDF for the complete report.
        </p>
      </div>
    `,
    attachments: [
      {
        filename: `SBB-Daily-Report-${shiftDate}.pdf`,
        content: pdfBuffer,
      },
    ],
  };

  await transporter.sendMail(mail);
}
