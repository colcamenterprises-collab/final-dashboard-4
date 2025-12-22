// Table-based Daily Review email template. Uses canonical data sources.
export function dailySummaryTemplate(input: {
  dateISO: string;
  form: {
    totalSales: number | null;
    bankedCash: number | null;
    bankedQR: number | null;
    closingCash: number | null;
    balanced: boolean | null;
    itemisedSales: Array<{ name: string; qty: number; total: number }>;
    itemisedExpenses: Array<{ name: string; total: number }>;
    startingCash?: number | null;
    expectedRegister?: number | null;
    cashVariance?: number | null;
  };
  pos: {
    totalSales: number | null;
    expensesTotal: number | null;
    expectedCash: number | null;
    actualCash: number | null;
    balanced: boolean | null;
    itemisedSales: Array<{ name: string; qty: number; total: number }>;
    itemisedExpenses: Array<{ name: string; total: number }>;
  };
  anomalies: Array<{ title: string; detail?: string }>;
  managerNotes?: string | null;
  mtd: {
    businessExpenses: number;
    shiftExpenses: number;
    foodAndBeverageExpenses: number;
    salesIncome: number;
    fbVsSalesChartDataUrl?: string;
    businessExpensesToday: number;
    shiftExpensesToday: number;
  };
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
  // NEW: Canonical data sources
  canonical?: {
    salesChannels?: { cashSales: number; qrSales: number; grabSales: number; otherSales: number; totalSales: number };
    shiftExpenses?: Array<{ category: string; amount: number }>;
    totalShiftExpenses?: number;
    reconciliation?: {
      posSales: number;
      declaredSales: number;
      salesVariance: number;
      posCash?: number;
      declaredCash?: number;
      cashVariance?: number;
      expectedBuns: number;
      actualBuns: number;
      bunVariance: number;
      expectedMeat: number;
      actualMeat: number;
      meatVariance: number;
    } | null;
    itemsByCategory?: Array<{ category: string; qty: number; sales?: number }>;
    shoppingList?: Array<{ item: string; qty: number; cost: number }>;
    shoppingTotal?: number;
    cashControl?: {
      startingCash: number;
      cashSales: number;
      expectedRegister: number;
      actualRegister: number;
      cashVariance: number;
      balanced: boolean;
      cashToBank: number;
      qrToBank: number;
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
.table { width:100%; border-collapse:collapse; }
.table th, .table td { text-align:left; padding:8px 6px; border-bottom:1px solid #1F2430; color:#C7CFD9; font-size:13px; }
.table th { color:#9AA7B2; font-weight:600; }
.table td.right, .table th.right { text-align:right; }
.table tr.total td { font-weight:700; color:#E6EDF5; border-top:2px solid #3A4553; }
.tag { font-size:12px; padding:3px 8px; border-radius:999px; border:1px solid #2A3441; color:#B9C3CE; }
.tag.ok { border-color:#234B2A; color:#CFEAD3; background:#102015; }
.tag.flag { border-color:#5A1F22; color:#F2C6C9; background:#1F1011; }
.header { padding-bottom:8px; margin-bottom:16px; border-bottom:1px solid #1F2430; }
`;
  const currency = (n: number | null | undefined) =>
    n == null ? "—" : `฿${n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

  const qty = (n: number | null | undefined) => (n == null ? "—" : String(n));

  const statusTag = (s: "OK" | "FLAG" | "INSUFFICIENT_DATA") =>
    s === "OK"
      ? `✅`
      : s === "FLAG"
      ? `❌`
      : `⚠️`;

  // Use canonical data if available, otherwise fall back to form data
  const salesChannels = input.canonical?.salesChannels || {
    cashSales: input.form.itemisedSales.find(s => s.name === 'Cash')?.total || 0,
    qrSales: input.form.itemisedSales.find(s => s.name === 'QR/Promptpay')?.total || 0,
    grabSales: input.form.itemisedSales.find(s => s.name === 'Grab')?.total || 0,
    otherSales: input.form.itemisedSales.find(s => s.name === 'Other')?.total || 0,
    totalSales: input.form.totalSales || 0
  };

  const shiftExpenses = input.canonical?.shiftExpenses || input.form.itemisedExpenses.map(e => ({ category: e.name, amount: e.total }));
  const totalShiftExpenses = input.canonical?.totalShiftExpenses || shiftExpenses.reduce((sum, e) => sum + e.amount, 0);

  const recon = input.canonical?.reconciliation;
  const itemsByCategory = input.canonical?.itemsByCategory || [];
  const shoppingList = input.canonical?.shoppingList || [];
  const shoppingTotal = input.canonical?.shoppingTotal || 0;
  const cashControl = input.canonical?.cashControl;

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

    <!-- 1. SALES FIGURES TABLE -->
    <div class="card">
      <div class="h2">Sales Figures</div>
      <table class="table" width="100%" cellpadding="6" cellspacing="0">
        <thead>
          <tr>
            <th>Channel</th>
            <th class="right">Amount (THB)</th>
          </tr>
        </thead>
        <tbody>
          <tr><td>Cash</td><td class="right">${currency(salesChannels.cashSales)}</td></tr>
          <tr><td>QR</td><td class="right">${currency(salesChannels.qrSales)}</td></tr>
          <tr><td>Grab</td><td class="right">${currency(salesChannels.grabSales)}</td></tr>
          <tr><td>Other</td><td class="right">${currency(salesChannels.otherSales)}</td></tr>
          <tr class="total">
            <td><strong>Total Sales</strong></td>
            <td class="right"><strong>${currency(salesChannels.totalSales)}</strong></td>
          </tr>
        </tbody>
      </table>
    </div>

    <!-- 2. SHIFT EXPENSES TABLE -->
    <div class="card">
      <div class="h2">Shift Expenses</div>
      <table class="table" width="100%" cellpadding="6" cellspacing="0">
        <thead>
          <tr>
            <th>Category</th>
            <th class="right">Amount (THB)</th>
          </tr>
        </thead>
        <tbody>
          ${shiftExpenses.length > 0 
            ? shiftExpenses.map(e => `<tr><td>${e.category}</td><td class="right">${currency(e.amount)}</td></tr>`).join('')
            : `<tr><td colspan="2" style="color:#9AA7B2;">No shift expenses recorded</td></tr>`
          }
          <tr class="total">
            <td><strong>Total Shift Expenses</strong></td>
            <td class="right"><strong>${currency(totalShiftExpenses)}</strong></td>
          </tr>
        </tbody>
      </table>
    </div>

    <!-- 3. FINANCE / CASH CONTROL TABLE -->
    <div class="card">
      <div class="h2">Finance / Cash Control</div>
      <table class="table" width="100%" cellpadding="6" cellspacing="0">
        <tbody>
          <tr><td>Starting Cash</td><td class="right">${currency(cashControl?.startingCash ?? input.form.startingCash ?? 0)}</td></tr>
          <tr><td>Cash Sales</td><td class="right">${currency(cashControl?.cashSales ?? salesChannels.cashSales)}</td></tr>
          <tr><td>Expected Register</td><td class="right">${currency(cashControl?.expectedRegister ?? input.form.expectedRegister ?? null)}</td></tr>
          <tr><td>Actual Register</td><td class="right">${currency(cashControl?.actualRegister ?? input.form.closingCash)}</td></tr>
          <tr>
            <td>Variance</td>
            <td class="right"><strong>${currency(cashControl?.cashVariance ?? input.form.cashVariance ?? null)}</strong></td>
          </tr>
          <tr><td>Balanced</td><td class="right">${(cashControl?.balanced ?? input.form.balanced) === null ? "—" : (cashControl?.balanced ?? input.form.balanced) ? "✅" : "❌"}</td></tr>
          <tr><td>Cash to Bank</td><td class="right">${currency(cashControl?.cashToBank ?? input.form.bankedCash)}</td></tr>
          <tr><td>QR to Bank</td><td class="right">${currency(cashControl?.qrToBank ?? input.form.bankedQR)}</td></tr>
        </tbody>
      </table>
    </div>

    <!-- 4. POS vs DAILY SALES RECONCILIATION TABLE -->
    ${recon ? `
    <div class="card">
      <div class="h2">POS vs Daily Sales — Reconciliation</div>
      <table class="table" width="100%" cellpadding="6" cellspacing="0">
        <thead>
          <tr>
            <th>Metric</th>
            <th class="right">POS</th>
            <th class="right">Daily Form</th>
            <th class="right">Variance</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>Total Sales</td>
            <td class="right">${currency(recon.posSales)}</td>
            <td class="right">${currency(recon.declaredSales)}</td>
            <td class="right">${recon.salesVariance !== 0 ? `<strong>${currency(recon.salesVariance)}</strong>` : currency(recon.salesVariance)}</td>
          </tr>
          ${recon.posCash != null ? `
          <tr>
            <td>Cash</td>
            <td class="right">${currency(recon.posCash)}</td>
            <td class="right">${currency(recon.declaredCash)}</td>
            <td class="right">${recon.cashVariance !== 0 ? `<strong>${currency(recon.cashVariance)}</strong>` : currency(recon.cashVariance)}</td>
          </tr>` : ''}
        </tbody>
      </table>
    </div>

    <!-- 5. MEAT & BUNS — CRITICAL TABLE -->
    <div class="card">
      <div class="h2">Meat & Buns — Expected vs Actual</div>
      <table class="table" width="100%" cellpadding="6" cellspacing="0">
        <thead>
          <tr>
            <th>Item</th>
            <th class="right">Expected</th>
            <th class="right">Recorded</th>
            <th class="right">Variance</th>
            <th class="right">Status</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>Buns (units)</td>
            <td class="right">${qty(recon.expectedBuns)}</td>
            <td class="right">${qty(recon.actualBuns)}</td>
            <td class="right">${recon.bunVariance !== 0 ? `<strong>${qty(recon.bunVariance)}</strong>` : qty(recon.bunVariance)}</td>
            <td class="right">${Math.abs(recon.bunVariance) <= 5 ? '✅' : Math.abs(recon.bunVariance) <= 10 ? '⚠️' : '❌'}</td>
          </tr>
          <tr>
            <td>Meat (grams)</td>
            <td class="right">${qty(recon.expectedMeat)}</td>
            <td class="right">${qty(recon.actualMeat)}</td>
            <td class="right">${recon.meatVariance !== 0 ? `<strong>${qty(recon.meatVariance)}</strong>` : qty(recon.meatVariance)}</td>
            <td class="right">${Math.abs(recon.meatVariance) <= 500 ? '✅' : Math.abs(recon.meatVariance) <= 1000 ? '⚠️' : '❌'}</td>
          </tr>
        </tbody>
      </table>
      <div class="small" style="margin-top:8px; color:#9AA7B2;">Thresholds: Rolls ±5 units · Meat ±500 g</div>
    </div>
    ` : `
    <!-- FALLBACK: Priority Flags when no canonical recon data -->
    <div class="card">
      <div class="h2">Meat & Buns — Expected vs Actual</div>
      <table class="table" width="100%" cellpadding="6" cellspacing="0">
        <thead>
          <tr>
            <th>Item</th>
            <th class="right">Expected</th>
            <th class="right">Recorded</th>
            <th class="right">Variance</th>
            <th class="right">Status</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>Buns (units)</td>
            <td class="right">${qty(input.priority.rolls.expected ?? null)}</td>
            <td class="right">${qty(input.priority.rolls.recorded ?? null)}</td>
            <td class="right">${qty(input.priority.rolls.variance ?? null)}</td>
            <td class="right">${statusTag(input.priority.rolls.status)}</td>
          </tr>
          <tr>
            <td>Meat (grams)</td>
            <td class="right">${qty(input.priority.meat.expectedGrams ?? null)}</td>
            <td class="right">${qty(input.priority.meat.recordedGrams ?? null)}</td>
            <td class="right">${qty(input.priority.meat.varianceGrams ?? null)}</td>
            <td class="right">${statusTag(input.priority.meat.status)}</td>
          </tr>
        </tbody>
      </table>
      <div class="small" style="margin-top:8px; color:#9AA7B2;">Thresholds: Rolls ±5 units · Meat ±500 g</div>
    </div>
    `}

    <!-- 5. ITEMS SOLD BY CATEGORY TABLE -->
    ${itemsByCategory.length > 0 ? `
    <div class="card">
      <div class="h2">Items Sold — Category Summary</div>
      <table class="table" width="100%" cellpadding="6" cellspacing="0">
        <thead>
          <tr>
            <th>Category</th>
            <th class="right">Qty</th>
            <th class="right">Sales (THB)</th>
          </tr>
        </thead>
        <tbody>
          ${itemsByCategory.map(c => `<tr><td>${c.category}</td><td class="right">${c.qty}</td><td class="right">${currency(c.sales ?? 0)}</td></tr>`).join('')}
        </tbody>
      </table>
    </div>
    ` : ''}

    <!-- 6. PURCHASING TABLE -->
    ${shoppingList.length > 0 ? `
    <div class="card">
      <div class="h2">Purchasing</div>
      <table class="table" width="100%" cellpadding="6" cellspacing="0">
        <thead>
          <tr>
            <th>Item</th>
            <th class="right">Qty</th>
            <th class="right">Est. Cost</th>
          </tr>
        </thead>
        <tbody>
          ${shoppingList.map(s => `<tr><td>${s.item}</td><td class="right">${s.qty}</td><td class="right">${currency(s.cost)}</td></tr>`).join('')}
          <tr class="total">
            <td colspan="2"><strong>Total Est. Cost</strong></td>
            <td class="right"><strong>${currency(shoppingTotal)}</strong></td>
          </tr>
        </tbody>
      </table>
    </div>
    ` : ''}

    <!-- MTD FINANCE -->
    <div class="card">
      <div class="h2">Month-to-Date Finance</div>
      <table class="table" width="100%" cellpadding="6" cellspacing="0">
        <thead>
          <tr>
            <th>Metric</th>
            <th class="right">Amount (THB)</th>
          </tr>
        </thead>
        <tbody>
          <tr><td>MTD Sales Income</td><td class="right">${currency(input.mtd.salesIncome)}</td></tr>
          <tr><td>MTD Business Expenses</td><td class="right">${currency(input.mtd.businessExpenses)}</td></tr>
          <tr><td>MTD Shift Expenses</td><td class="right">${currency(input.mtd.shiftExpenses)}</td></tr>
          <tr><td>MTD F&B Expenses</td><td class="right">${currency(input.mtd.foodAndBeverageExpenses)}</td></tr>
        </tbody>
      </table>
    </div>

    <!-- ANOMALIES & NOTES -->
    ${input.anomalies.length > 0 || input.managerNotes ? `
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
    ` : ''}

    <div class="small" style="margin-top:12px; text-align:center; color:#8C98A4;">
      Smash Brothers Burgers — Daily Review Email
    </div>
  </div>
</body>
</html>`;
}
