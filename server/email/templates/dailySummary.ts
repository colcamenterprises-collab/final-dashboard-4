// Minimal, professional email template. No emojis. Montserrat with fallbacks.
// NOTE: Many email clients fall back to system fonts; we include sensible fallbacks.
export function dailySummaryTemplate(input: {
  dateISO: string;
  // Sales/Stock Form
  form: {
    totalSales: number | null;
    bankedCash: number | null;
    bankedQR: number | null;
    closingCash: number | null;
    balanced: boolean | null;
    itemisedSales: Array<{ name: string; qty: number; total: number }>;
    itemisedExpenses: Array<{ name: string; total: number }>;
  };
  // POS Shift
  pos: {
    totalSales: number | null;
    expensesTotal: number | null;
    expectedCash: number | null;
    actualCash: number | null;
    balanced: boolean | null;
    itemisedSales: Array<{ name: string; qty: number; total: number }>;
    itemisedExpenses: Array<{ name: string; total: number }>;
  };
  // Review / anomalies
  anomalies: Array<{ title: string; detail?: string }>;
  managerNotes?: string | null;

  // Finance / Expenses
  mtd: {
    businessExpenses: number;
    shiftExpenses: number;
    foodAndBeverageExpenses: number;
    salesIncome: number;
    fbVsSalesChartDataUrl?: string; // base64 image
    businessExpensesToday: number;
    shiftExpensesToday: number;
  };

  // Priority flags
  priority: {
    rolls: {
      expected?: number | null;
      recorded?: number | null;
      variance?: number | null;
      status: "OK" | "FLAG" | "INSUFFICIENT_DATA";
    };
    meat: {
      expectedGrams?: number | null;
      recordedGrams?: number | null;
      varianceGrams?: number | null;
      status: "OK" | "FLAG" | "INSUFFICIENT_DATA";
    };
  };
}) {
  const css = `
:root { color-scheme: light; }
* { box-sizing: border-box; }
body { margin:0; padding:0; background:#0B0C10; }
.container { max-width: 880px; margin:0 auto; padding:32px 20px; background:#0B0C10; }
.card { background:#11141A; border:1px solid #1F2430; border-radius:12px; padding:20px; margin:16px 0; }
.h1 { font-size:22px; font-weight:700; letter-spacing:.2px; margin:0 0 8px; }
.h2 { font-size:16px; font-weight:600; margin:0 0 12px; color:#D7DFEA; }
.p  { font-size:14px; line-height:1.6; color:#C7CFD9; margin:0; }
.small { font-size:12px; color:#9AA7B2; }
.row { display:flex; gap:16px; flex-wrap:wrap; }
.col { flex:1 1 300px; }
.kpi { display:flex; justify-content:space-between; padding:10px 0; border-top:1px solid #1F2430; }
.kpi:first-child { border-top:none; }
.kpi .label { color:#A9B4BF; font-size:12px; }
.kpi .value { color:#E6EDF5; font-weight:600; font-size:14px; }
.tag { font-size:12px; padding:3px 8px; border-radius:999px; border:1px solid #2A3441; color:#B9C3CE; }
.tag.ok { border-color:#234B2A; color:#CFEAD3; background:#102015; }
.tag.flag { border-color:#5A1F22; color:#F2C6C9; background:#1F1011; }
.table { width:100%; border-collapse:collapse; }
.table th, .table td { text-align:left; padding:8px 0; border-bottom:1px solid #1F2430; color:#C7CFD9; font-size:13px; }
.header { padding-bottom:8px; margin-bottom:16px; border-bottom:1px solid #1F2430; }
`;
  const currency = (n: number | null | undefined) =>
    n == null ? "—" : `฿${n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

  const qty = (n: number | null | undefined) => (n == null ? "—" : String(n));

  const statusTag = (s: "OK" | "FLAG" | "INSUFFICIENT_DATA") =>
    s === "OK"
      ? `<span class="tag ok">OK</span>`
      : s === "FLAG"
      ? `<span class="tag flag">FLAG</span>`
      : `<span class="tag">INSUFFICIENT DATA</span>`;

  // Build itemised lists
  const listRows = (rows: Array<{ name: string; qty?: number; total?: number }>) =>
    rows
      .map(
        (r) => `<tr>
  <td>${r.name}</td>
  ${"qty" in r ? `<td>${qty(r.qty as any)}</td>` : ""}
  ${"total" in r ? `<td>${currency(r.total as any)}</td>` : ""}
</tr>`
      )
      .join("");

  return `<!doctype html>
<html>
<head>
<meta charset="utf-8"/>
<meta name="viewport" content="width=device-width, initial-scale=1">
<link href="https://fonts.googleapis.com/css2?family=Montserrat:wght@400;600;700&display=swap" rel="stylesheet">
<style>${css}</style>
</head>
<body style="font-family: Montserrat, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Arial, sans-serif;">
  <div class="container">
    <div class="header">
      <div class="h1" style="color:#E6EDF5;">Daily Review — ${input.dateISO}</div>
      <div class="small">Generated automatically at 09:00 (Bangkok)</div>
    </div>

    <div class="row">
      <div class="col">
        <div class="card">
          <div class="h2">Daily Sales & Stock (Staff Form)</div>
          <div class="kpi"><span class="label">Total Sales</span><span class="value">${currency(input.form.totalSales)}</span></div>
          <div class="kpi"><span class="label">Closing Cash</span><span class="value">${currency(input.form.closingCash)}</span></div>
          <div class="kpi"><span class="label">Cash Banked</span><span class="value">${currency(input.form.bankedCash)}</span></div>
          <div class="kpi"><span class="label">QR Transfer</span><span class="value">${currency(input.form.bankedQR)}</span></div>
          <div class="kpi"><span class="label">Balanced?</span><span class="value">${input.form.balanced === null ? "—" : input.form.balanced ? "Yes" : "No"}</span></div>
          <div style="margin-top:12px" class="small">Itemised Sales</div>
          <table class="table">
            <thead><tr><th>Item</th><th>Qty</th><th>Total</th></tr></thead>
            <tbody>${listRows(input.form.itemisedSales as any)}</tbody>
          </table>
          <div style="margin-top:12px" class="small">Itemised Expenses</div>
          <table class="table">
            <thead><tr><th>Category</th><th>Total</th></tr></thead>
            <tbody>${listRows(input.form.itemisedExpenses as any)}</tbody>
          </table>
        </div>
      </div>

      <div class="col">
        <div class="card">
          <div class="h2">POS Shift Report</div>
          <div class="kpi"><span class="label">Total Sales</span><span class="value">${currency(input.pos.totalSales)}</span></div>
          <div class="kpi"><span class="label">Expenses</span><span class="value">${currency(input.pos.expensesTotal)}</span></div>
          <div class="kpi"><span class="label">Expected Cash</span><span class="value">${currency(input.pos.expectedCash)}</span></div>
          <div class="kpi"><span class="label">Actual Cash</span><span class="value">${currency(input.pos.actualCash)}</span></div>
          <div class="kpi"><span class="label">Balanced?</span><span class="value">${input.pos.balanced === null ? "—" : input.pos.balanced ? "Yes" : "No"}</span></div>
          <div style="margin-top:12px" class="small">Itemised Sales</div>
          <table class="table">
            <thead><tr><th>Item</th><th>Qty</th><th>Total</th></tr></thead>
            <tbody>${listRows(input.pos.itemisedSales as any)}</tbody>
          </table>
          <div style="margin-top:12px" class="small">Itemised Expenses</div>
          <table class="table">
            <thead><tr><th>Category</th><th>Total</th></tr></thead>
            <tbody>${listRows(input.pos.itemisedExpenses as any)}</tbody>
          </table>
        </div>
      </div>
    </div>

    <div class="card">
      <div class="h2">Anomalies & Manager Notes</div>
      ${
        input.anomalies.length
          ? `<ul style="margin:0; padding-left:18px; color:#C7CFD9; font-size:14px;">${input.anomalies
              .map((a) => `<li><strong>${a.title}</strong>${a.detail ? ` — ${a.detail}` : ""}</li>`)
              .join("")}</ul>`
          : `<div class="p">No anomalies recorded.</div>`
      }
      ${
        input.managerNotes
          ? `<div style="margin-top:12px"><div class="small">Manager Notes</div><div class="p">${input.managerNotes}</div></div>`
          : ""
      }
    </div>

    <div class="card">
      <div class="h2">Finance / Expenses</div>
      <div class="row">
        <div class="col">
          <div class="kpi"><span class="label">MTD Business Expenses</span><span class="value">${currency(input.mtd.businessExpenses)}</span></div>
          <div class="kpi"><span class="label">MTD Shift Expenses</span><span class="value">${currency(input.mtd.shiftExpenses)}</span></div>
          <div class="kpi"><span class="label">Business Expenses (Today)</span><span class="value">${currency(input.mtd.businessExpensesToday)}</span></div>
          <div class="kpi"><span class="label">Shift Expenses (Today)</span><span class="value">${currency(input.mtd.shiftExpensesToday)}</span></div>
        </div>
        <div class="col">
          <div class="kpi"><span class="label">MTD F&B Expenses</span><span class="value">${currency(input.mtd.foodAndBeverageExpenses)}</span></div>
          <div class="kpi"><span class="label">MTD Sales Income</span><span class="value">${currency(input.mtd.salesIncome)}</span></div>
          ${
            input.mtd.fbVsSalesChartDataUrl
              ? `<div style="margin-top:8px"><img alt="F&B vs Sales" src="${input.mtd.fbVsSalesChartDataUrl}" style="max-width:100%; border-radius:8px;"/></div>`
              : ""
          }
        </div>
      </div>
    </div>

    <div class="card">
      <div class="h2">Priority Flags — Rolls & Meat</div>
      <table class="table">
        <thead>
          <tr><th>Item</th><th>Expected</th><th>Recorded</th><th>Variance</th><th>Status</th></tr>
        </thead>
        <tbody>
          <tr>
            <td>Rolls (units)</td>
            <td>${qty(input.priority.rolls.expected ?? null)}</td>
            <td>${qty(input.priority.rolls.recorded ?? null)}</td>
            <td>${qty(input.priority.rolls.variance ?? null)}</td>
            <td>${statusTag(input.priority.rolls.status)}</td>
          </tr>
          <tr>
            <td>Meat (grams)</td>
            <td>${qty(input.priority.meat.expectedGrams ?? null)}</td>
            <td>${qty(input.priority.meat.recordedGrams ?? null)}</td>
            <td>${qty(input.priority.meat.varianceGrams ?? null)}</td>
            <td>${statusTag(input.priority.meat.status)}</td>
          </tr>
        </tbody>
      </table>
      <div class="small" style="margin-top:8px">Thresholds: Rolls ±5 units; Meat ±500 g.</div>
    </div>

    <div class="small" style="margin-top:12px; text-align:center; color:#8C98A4;">
      Smash Brothers Burgers — Daily Review Email
    </div>
  </div>
</body>
</html>`;
}
