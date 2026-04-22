import { pool } from "../db";
import { getDailyAnalysis } from "./dataAnalystService";

export type BobAnalysisRunResult = {
  ok: true;
  shift_date: string;
  status: "ok" | "warning" | "critical";
  summary: string;
  issues: string[];
  recommendations: string[];
  data: Record<string, unknown>;
  report_id?: string;
  codex_handoff: Record<string, unknown> | null;
};

export type AiOpsIssuePayload = {
  title: string;
  issue_type: string;
  severity: "low" | "medium" | "high" | "critical";
  source_shift_date: string;
  supporting_evidence: string;
  summary: string;
  recommended_action: string;
};

function mapIssueType(issue: string): string {
  const normalized = issue.toLowerCase();
  if (normalized.includes("sales variance") || normalized.includes("pos")) return "sales_reconciliation";
  if (normalized.includes("rolls variance") || normalized.includes("meat variance")) return "stock_variance";
  if (normalized.includes("form")) return "form_submission_gap";
  return "operational_anomaly";
}

function mapSeverity(issue: string, runStatus: string): "low" | "medium" | "high" | "critical" {
  const normalized = issue.toLowerCase();
  if (normalized.includes("10% gap") || runStatus === "critical") return "critical";
  if (normalized.includes("no pos") || normalized.includes("variance")) return "high";
  if (runStatus === "warning") return "medium";
  return "low";
}

export async function runBobShiftAnalysis(shiftDate: string): Promise<BobAnalysisRunResult> {
  if (!pool) {
    throw new Error("Database unavailable");
  }

  const posResult = await pool.query(
    `SELECT
       ROUND(SUM(CASE WHEN receipt_type='SALE' THEN COALESCE(net_amount,0) ELSE 0 END)::numeric, 2) AS pos_total,
       ROUND(SUM(CASE WHEN receipt_type='REFUND' THEN ABS(COALESCE(net_amount,0)) ELSE 0 END)::numeric, 2) AS pos_refunds,
       COUNT(DISTINCT CASE WHEN receipt_type='SALE' THEN receipt_id END)::int  AS pos_txn_count,
       COUNT(DISTINCT CASE WHEN receipt_type='SALE' THEN item_name END)::int   AS pos_item_types
     FROM receipt_truth_line WHERE receipt_date=$1::date`,
    [shiftDate],
  );
  const pos = posResult.rows[0] || {};
  const posTotalBaht = Number(pos.pos_total || 0);
  const posRefundBaht = Number(pos.pos_refunds || 0);

  const formResult = await pool.query(
    `SELECT "totalSales","cashSales","qrSales","grabSales","totalExpenses","completedBy","submittedAtISO"
     FROM daily_sales_v2 WHERE "shiftDate"=$1
     ORDER BY "submittedAtISO" DESC NULLS LAST LIMIT 1`,
    [shiftDate],
  );
  const form = formResult.rows[0] || null;

  const stockResult = await pool.query(
    `SELECT rolls_variance, meat_variance_g, completed_by
     FROM manual_stock_ledger WHERE shift_date=$1::date ORDER BY created_at DESC LIMIT 1`,
    [shiftDate],
  );
  const stock = stockResult.rows[0] || null;

  const analyst = await getDailyAnalysis(shiftDate);

  const formTotalBaht = form ? Number(form.totalSales) / 100 : 0;
  const salesDiff = Math.abs(posTotalBaht - formTotalBaht);
  const salesDiffPct = posTotalBaht > 0 ? (salesDiff / posTotalBaht) * 100 : 0;
  const rollsVariance = stock ? Number(stock.rolls_variance) : null;
  const meatVarianceG = stock ? Number(stock.meat_variance_g) : null;

  let status: "ok" | "warning" | "critical" = "ok";
  const issues: string[] = [];
  const recommendations: string[] = [];

  if (!form) {
    status = "warning";
    issues.push("No staff daily sales form found for this shift.");
    recommendations.push("Staff must submit the daily sales form for this shift.");
  } else if (salesDiffPct > 10) {
    status = "critical";
    issues.push(`Sales variance: Form ฿${formTotalBaht.toFixed(2)} vs POS ฿${posTotalBaht.toFixed(2)} (${salesDiffPct.toFixed(1)}% gap).`);
    recommendations.push("Investigate cash handling — gap exceeds 10%. Review Loyverse receipts vs form entry.");
  } else if (salesDiffPct > 5) {
    status = "warning";
    issues.push(`Sales variance: ${salesDiffPct.toFixed(1)}% gap between form and POS data.`);
    recommendations.push("Follow up with shift manager on reconciliation.");
  }

  if (rollsVariance !== null && Math.abs(rollsVariance) > 10) {
    status = status === "ok" ? "warning" : status;
    issues.push(`Rolls variance: ${rollsVariance > 0 ? "+" : ""}${rollsVariance} pcs (threshold: ±10).`);
    recommendations.push("Check rolls delivery records and burger count for this shift.");
  }
  if (meatVarianceG !== null && Math.abs(meatVarianceG) > 1000) {
    status = status === "ok" ? "warning" : status;
    issues.push(`Meat variance: ${meatVarianceG > 0 ? "+" : ""}${meatVarianceG}g (threshold: ±1000g).`);
    recommendations.push("Cross-check meat delivery with supplier receipts.");
  }
  if (posTotalBaht === 0) {
    if (status === "ok") status = "warning";
    issues.push("No POS receipts found for this date — Loyverse data may not have been synced.");
    recommendations.push("Run a Loyverse sync for this date, or verify the business date mapping.");
  }

  const summaryText = issues.length === 0
    ? `Shift ${shiftDate} — all checks passed. POS total ฿${posTotalBaht.toFixed(2)}, ${pos.pos_txn_count || 0} transactions.`
    : `Shift ${shiftDate} — ${issues.length} issue(s) found. ${issues[0]}`;

  const codexHandoff = issues.length > 0 ? {
    handoff_type: "RECOMMENDED_FIX",
    shift_date: shiftDate,
    status,
    issues,
    recommendations,
    prepared_for: "Codex",
    requires_approval: true,
    instruction: recommendations[0] || "Review shift data manually.",
  } : null;

  const dataJson = {
    pos: { total_baht: posTotalBaht, refunds_baht: posRefundBaht, txn_count: Number(pos.pos_txn_count || 0), item_types: Number(pos.pos_item_types || 0) },
    form: form ? { total_baht: formTotalBaht, submitted_by: form.completedBy, submitted_at: form.submittedAtISO } : null,
    stock: stock ? { rolls_variance: rollsVariance, meat_variance_g: meatVarianceG } : null,
    analyst: analyst.data,
    analyst_blockers: analyst.blockers,
    issues,
    recommendations,
    codex_handoff: codexHandoff,
    run_at: new Date().toISOString(),
  };

  await pool.query(
    `INSERT INTO analysis_reports (shift_date, analysis_type, status, summary, data_json, created_by)
     VALUES ($1::date, 'shift_review', $2, $3, $4, 'system')
     ON CONFLICT DO NOTHING`,
    [shiftDate, status, summaryText, JSON.stringify(dataJson)],
  );

  const insertResult = await pool.query(
    `INSERT INTO analysis_reports (shift_date, analysis_type, status, summary, data_json, created_by)
     VALUES ($1::date, 'shift_review', $2, $3, $4, 'system')
     RETURNING id::text, created_at::text`,
    [shiftDate, status, summaryText, JSON.stringify(dataJson)],
  );

  return {
    ok: true,
    shift_date: shiftDate,
    status,
    summary: summaryText,
    issues,
    recommendations,
    data: dataJson,
    report_id: insertResult.rows[0]?.id,
    codex_handoff: codexHandoff,
  };
}

export async function runDailyBobAnalystAiOpsLoop(shiftDate: string): Promise<{
  ok: true;
  shift_date: string;
  analysis_report_id?: string;
  status: "ok" | "warning" | "critical";
  issue_payloads: AiOpsIssuePayload[];
  ai_ops_result: { created: number; deduped: number; issue_ids: string[] };
}> {
  if (!pool) {
    throw new Error("Database unavailable");
  }

  const analysis = await runBobShiftAnalysis(shiftDate);
  const issuePayloads: AiOpsIssuePayload[] = analysis.issues.map((issue, idx) => ({
    title: `Shift ${shiftDate}: ${mapIssueType(issue).replaceAll("_", " ")}`,
    issue_type: mapIssueType(issue),
    severity: mapSeverity(issue, analysis.status),
    source_shift_date: shiftDate,
    supporting_evidence: issue,
    summary: analysis.summary,
    recommended_action: analysis.recommendations[idx] || analysis.recommendations[0] || "Review shift analysis and verify source records.",
  }));

  let created = 0;
  let deduped = 0;
  const issueIds: string[] = [];

  for (const payload of issuePayloads) {
    const dedupeTag = `[AUTO_LOOP|${payload.source_shift_date}|${payload.issue_type}|${payload.supporting_evidence}]`;
    const existing = await pool.query(
      `SELECT id::text
       FROM ai_issues
       WHERE title = $1 AND COALESCE(description, '') LIKE $2
       ORDER BY created_at DESC
       LIMIT 1`,
      [payload.title, `%${dedupeTag}%`],
    );

    if (existing.rows.length > 0) {
      deduped += 1;
      issueIds.push(existing.rows[0].id);
      continue;
    }

    const description = [
      `Type: ${payload.issue_type}`,
      `Source shift date: ${payload.source_shift_date}`,
      `Evidence: ${payload.supporting_evidence}`,
      `Summary: ${payload.summary}`,
      `Recommended action: ${payload.recommended_action}`,
      dedupeTag,
    ].join("\n");

    const inserted = await pool.query(
      `INSERT INTO ai_issues (title, description, severity, status, created_by, owner_agent, assignee)
       VALUES ($1, $2, $3, 'triage', 'system:daily-loop', 'Bob', NULL)
       RETURNING id::text`,
      [payload.title, description, payload.severity],
    );

    created += 1;
    issueIds.push(inserted.rows[0].id);
  }

  return {
    ok: true,
    shift_date: shiftDate,
    analysis_report_id: analysis.report_id,
    status: analysis.status,
    issue_payloads: issuePayloads,
    ai_ops_result: { created, deduped, issue_ids: issueIds },
  };
}
