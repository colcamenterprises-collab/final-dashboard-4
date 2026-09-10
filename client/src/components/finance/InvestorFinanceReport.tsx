import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { AlertTriangle, Download, ShieldCheck, WandSparkles } from "lucide-react";
import { Button } from "@/components/ui/button";

type VendorRule = {
  id: string;
  matchText: string;
  category: string;
  supplier?: string | null;
};

type OverviewResponse = {
  ok: boolean;
  overview: {
    receiptCount: number;
    grossSales: number;
    discounts: number;
    refunds: number;
    netSales: number;
    averageOrder: number;
    paymentSales: Record<string, number>;
    costing: {
      costOfGoods: number;
      grossProfit: number | null;
      knownGrossProfit: number;
      costedNetSales: number;
      uncostedNetSales: number;
      coveragePct: number | null;
      fullyCosted: boolean;
      foodCostPct: number | null;
      grossMarginPct: number | null;
    };
  };
  exceptions?: Array<{ code: string; severity: string; label: string; amount: number | null; count: number; message: string }>;
};

type DuplicateCandidate = {
  left: any;
  right: any;
  merchant: string;
  amount: number;
  dayGap: number;
  crossSource: boolean;
};

type CategorySuggestion = {
  id: string;
  category: string;
  reason: string;
  confidence: "rule" | "repeat";
};

function number(value: unknown) {
  const parsed = Number(value || 0);
  return Number.isFinite(parsed) ? Math.abs(parsed) : 0;
}

function money(value: unknown) {
  return `฿${number(value).toLocaleString("en-TH", { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;
}

function normalizeText(value: unknown) {
  return String(value || "")
    .toUpperCase()
    .replace(/[^A-Z0-9ก-๙]+/g, " ")
    .replace(/\b(CO|LTD|LIMITED|COMPANY|THAILAND|TH|PAYMENT|TRANSFER|DEBIT|CREDIT|QR|PROMPTPAY|ONLINE)\b/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function merchantKey(row: any) {
  const supplier = normalizeText(row?.supplier);
  if (supplier.length >= 3) return supplier;
  return normalizeText(row?.description).split(" ").slice(0, 5).join(" ");
}

function sourceKey(row: any) {
  if (row?.meta?.bankTxnId || String(row?.id || "").startsWith("bank_txn:")) return "bank";
  if (row?.submission_id || String(row?.id || "").startsWith("shift:")) return "shift";
  return String(row?.source || row?.payment_source || "manual").toLowerCase();
}

function rowDate(row: any) {
  return String(row?.date || row?.postedAt || "").slice(0, 10);
}

function dateDiffDays(a: string, b: string) {
  const left = Date.parse(`${a}T00:00:00Z`);
  const right = Date.parse(`${b}T00:00:00Z`);
  if (!Number.isFinite(left) || !Number.isFinite(right)) return 999;
  return Math.abs(Math.round((left - right) / 86400000));
}

function clearDuplicateCandidates(rows: any[]) {
  const candidates: DuplicateCandidate[] = [];
  for (let i = 0; i < rows.length; i += 1) {
    for (let j = i + 1; j < rows.length; j += 1) {
      const left = rows[i];
      const right = rows[j];
      const leftAmount = number(left.amount);
      const rightAmount = number(right.amount);
      if (!leftAmount || Math.abs(leftAmount - rightAmount) > 0.01) continue;
      const leftMerchant = merchantKey(left);
      const rightMerchant = merchantKey(right);
      if (!leftMerchant || !rightMerchant || leftMerchant !== rightMerchant) continue;
      const dayGap = dateDiffDays(rowDate(left), rowDate(right));
      if (dayGap > 2) continue;
      candidates.push({
        left,
        right,
        merchant: leftMerchant,
        amount: leftAmount,
        dayGap,
        crossSource: sourceKey(left) !== sourceKey(right),
      });
    }
  }
  return candidates.sort((a, b) => Number(b.crossSource) - Number(a.crossSource) || a.dayGap - b.dayGap || b.amount - a.amount);
}

function categorySuggestions(rows: any[], vendorRules: VendorRule[]) {
  const knownByMerchant = new Map<string, string[]>();
  for (const row of rows) {
    const category = String(row?.category || "").trim();
    if (!category || category === "Review" || category === "Other Business Expense") continue;
    const merchant = merchantKey(row);
    if (!merchant) continue;
    const existing = knownByMerchant.get(merchant) || [];
    existing.push(category);
    knownByMerchant.set(merchant, existing);
  }

  const suggestions: CategorySuggestion[] = [];
  for (const row of rows) {
    const id = String(row?.id || "");
    const current = String(row?.category || "Review").trim() || "Review";
    if (!id || (current !== "Review" && current !== "Other Business Expense")) continue;
    const searchable = `${normalizeText(row?.supplier)} ${normalizeText(row?.description)}`.trim();
    const matchingRule = vendorRules.find((rule) => {
      const match = normalizeText(rule.matchText);
      return match.length >= 3 && searchable.includes(match);
    });
    if (matchingRule?.category && matchingRule.category !== current) {
      suggestions.push({ id, category: matchingRule.category, reason: `Existing vendor rule: ${matchingRule.matchText}`, confidence: "rule" });
      continue;
    }

    const merchant = merchantKey(row);
    const history = knownByMerchant.get(merchant) || [];
    if (history.length < 2) continue;
    const counts = history.reduce<Record<string, number>>((acc, category) => {
      acc[category] = (acc[category] || 0) + 1;
      return acc;
    }, {});
    const ranked = Object.entries(counts).sort((a, b) => b[1] - a[1]);
    const [topCategory, topCount] = ranked[0] || [];
    if (!topCategory || topCount !== history.length) continue;
    suggestions.push({ id, category: topCategory, reason: `${history.length} prior ${merchant} expenses use this category`, confidence: "repeat" });
  }
  return suggestions;
}

function csvCell(value: unknown) {
  const text = value == null ? "" : String(value);
  return `"${text.replace(/"/g, '""')}"`;
}

function downloadBlob(filename: string, type: string, content: string) {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}

function escapeHtml(value: unknown) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

export default function InvestorFinanceReport({
  dateFrom,
  dateTo,
  businessExpenses,
  inShiftExpenses,
  deposits,
  vendorRules,
  onStageCategories,
}: {
  dateFrom: string;
  dateTo: string;
  businessExpenses: any[];
  inShiftExpenses: any[];
  deposits: any[];
  vendorRules: VendorRule[];
  onStageCategories: (changes: Record<string, string>) => void;
}) {
  const params = useMemo(() => new URLSearchParams({
    fromDate: dateFrom,
    fromTime: "00:00",
    toDate: dateTo,
    toTime: "23:59",
    timezone: "Asia/Bangkok",
  }).toString(), [dateFrom, dateTo]);

  const overviewQuery = useQuery<OverviewResponse>({
    queryKey: ["finance-investor-overview", dateFrom, dateTo],
    enabled: Boolean(dateFrom && dateTo),
    queryFn: async () => {
      const response = await fetch(`/api/reports/receipt-analytics/unified/overview?${params}`, { credentials: "include", cache: "no-store" });
      const payload = await response.json().catch(() => null);
      if (!response.ok || !payload?.ok) throw new Error(payload?.error || "Failed to load investor reporting sales data");
      return payload;
    },
  });

  const allExpenseRows = useMemo(() => [...businessExpenses, ...inShiftExpenses], [businessExpenses, inShiftExpenses]);
  const duplicateCandidates = useMemo(() => clearDuplicateCandidates(allExpenseRows), [allExpenseRows]);
  const suggestions = useMemo(() => categorySuggestions(businessExpenses, vendorRules), [businessExpenses, vendorRules]);
  const businessTotal = useMemo(() => businessExpenses.reduce((sum, row) => sum + number(row.amount), 0), [businessExpenses]);
  const shiftTotal = useMemo(() => inShiftExpenses.reduce((sum, row) => sum + number(row.amount), 0), [inShiftExpenses]);
  const expenseTotal = businessTotal + shiftTotal;
  const depositTotal = useMemo(() => deposits.reduce((sum, row) => sum + number(row.amount), 0), [deposits]);
  const overview = overviewQuery.data?.overview;
  const hasFoodPurchaseOverlap = businessExpenses.some((row) => ["Food & Beverage", "Kitchen Supplies & Packaging"].includes(String(row?.category || "")))
    || inShiftExpenses.some((row) => ["Food & Beverage", "Kitchen Supplies & Packaging"].includes(String(row?.category || "")));
  const canShowOperatingResult = Boolean(overview?.costing?.fullyCosted && !hasFoodPurchaseOverlap);
  const operatingResult = canShowOperatingResult ? number(overview?.netSales) - number(overview?.costing?.costOfGoods) - expenseTotal : null;
  const duplicateExposure = duplicateCandidates.reduce((sum, candidate) => sum + candidate.amount, 0);

  const stageSuggestions = () => {
    onStageCategories(Object.fromEntries(suggestions.map((item) => [item.id, item.category])));
  };

  const downloadInvestorHtml = () => {
    if (!overview) return;
    const categoryTotals = new Map<string, number>();
    for (const row of allExpenseRows) {
      const category = String(row?.category || "Review");
      categoryTotals.set(category, (categoryTotals.get(category) || 0) + number(row?.amount));
    }
    const categories = [...categoryTotals.entries()].sort((a, b) => b[1] - a[1]);
    const paymentSales = Object.entries(overview.paymentSales || {}).sort((a, b) => Number(b[1]) - Number(a[1]));
    const duplicateRows = duplicateCandidates.map((candidate) => `<tr><td>${escapeHtml(rowDate(candidate.left))}</td><td>${escapeHtml(rowDate(candidate.right))}</td><td>${escapeHtml(candidate.merchant)}</td><td style="text-align:right">${escapeHtml(money(candidate.amount))}</td><td>${candidate.crossSource ? "Cross-source" : "Same-source"}</td></tr>`).join("");
    const categoryRows = categories.map(([category, amount]) => `<tr><td>${escapeHtml(category)}</td><td style="text-align:right">${escapeHtml(money(amount))}</td></tr>`).join("");
    const paymentRows = paymentSales.map(([channel, amount]) => `<tr><td>${escapeHtml(channel)}</td><td style="text-align:right">${escapeHtml(money(amount))}</td></tr>`).join("");
    const warnings = [
      !overview.costing.fullyCosted ? `COGS coverage is ${overview.costing.coveragePct == null ? "unknown" : `${overview.costing.coveragePct.toFixed(1)}%`}; full gross profit is withheld.` : "",
      hasFoodPurchaseOverlap ? "Net profit is deliberately withheld because food/packaging purchase expenses overlap with recipe-based COGS and would risk double counting." : "",
      duplicateCandidates.length ? `${duplicateCandidates.length} clear duplicate candidate pair(s) require owner review before any ledger deletion or adjustment.` : "",
    ].filter(Boolean);
    const html = `<!doctype html><html><head><meta charset="utf-8"><title>SBB Investor Finance Summary ${escapeHtml(dateFrom)} to ${escapeHtml(dateTo)}</title><style>body{font-family:Arial,sans-serif;color:#111827;margin:40px;line-height:1.45}h1{font-size:28px;margin-bottom:4px}h2{font-size:17px;margin-top:28px;border-bottom:1px solid #d1d5db;padding-bottom:6px}.muted{color:#6b7280}.grid{display:grid;grid-template-columns:repeat(4,1fr);gap:12px;margin:20px 0}.card{border:1px solid #e5e7eb;border-radius:14px;padding:14px}.label{font-size:11px;text-transform:uppercase;color:#6b7280;font-weight:700}.value{font-size:22px;font-weight:800;margin-top:6px}table{width:100%;border-collapse:collapse;margin-top:10px}th,td{padding:8px;border-bottom:1px solid #e5e7eb;font-size:12px;text-align:left}.warn{background:#fff7ed;border:1px solid #fdba74;padding:12px;border-radius:10px;margin:8px 0}.ok{background:#ecfdf5;border:1px solid #6ee7b7;padding:12px;border-radius:10px;margin:8px 0}@media print{body{margin:20px}.grid{grid-template-columns:repeat(4,1fr)}}</style></head><body><div class="muted">Smash Brothers Burgers · Investor-style financial summary</div><h1>${escapeHtml(dateFrom)} to ${escapeHtml(dateTo)}</h1><div class="grid"><div class="card"><div class="label">Gross sales</div><div class="value">${escapeHtml(money(overview.grossSales))}</div></div><div class="card"><div class="label">Net sales</div><div class="value">${escapeHtml(money(overview.netSales))}</div></div><div class="card"><div class="label">Recorded expenses</div><div class="value">${escapeHtml(money(expenseTotal))}</div></div><div class="card"><div class="label">Bank deposits / credits</div><div class="value">${escapeHtml(money(depositTotal))}</div></div></div><h2>Income</h2><table><tr><td>Gross sales</td><td style="text-align:right">${escapeHtml(money(overview.grossSales))}</td></tr><tr><td>Discounts</td><td style="text-align:right">${escapeHtml(money(overview.discounts))}</td></tr><tr><td>Refunds</td><td style="text-align:right">${escapeHtml(money(overview.refunds))}</td></tr><tr><td><strong>Net sales</strong></td><td style="text-align:right"><strong>${escapeHtml(money(overview.netSales))}</strong></td></tr></table><h2>Profitability</h2><table><tr><td>COGS</td><td style="text-align:right">${overview.costing.fullyCosted ? escapeHtml(money(overview.costing.costOfGoods)) : "Withheld — incomplete costing"}</td></tr><tr><td>Gross profit</td><td style="text-align:right">${overview.costing.grossProfit == null ? "Withheld" : escapeHtml(money(overview.costing.grossProfit))}</td></tr><tr><td>Operating result before tax / owner adjustments</td><td style="text-align:right">${operatingResult == null ? "Withheld — accounting overlap/incomplete costing" : escapeHtml(money(operatingResult))}</td></tr></table><h2>Expenses</h2><table><tr><td>Business expenses</td><td style="text-align:right">${escapeHtml(money(businessTotal))}</td></tr><tr><td>Shift expenses</td><td style="text-align:right">${escapeHtml(money(shiftTotal))}</td></tr><tr><td><strong>Total recorded expenses</strong></td><td style="text-align:right"><strong>${escapeHtml(money(expenseTotal))}</strong></td></tr>${categoryRows}</table><h2>Payment sales</h2><table>${paymentRows}</table><h2>Reconciliation</h2><table><tr><td>Net sales</td><td style="text-align:right">${escapeHtml(money(overview.netSales))}</td></tr><tr><td>Bank deposits / credits</td><td style="text-align:right">${escapeHtml(money(depositTotal))}</td></tr><tr><td>Deposit less net sales (timing/classification indicator only)</td><td style="text-align:right">${escapeHtml(money(depositTotal - overview.netSales))}</td></tr></table><p class="muted">Bank credits are reconciliation evidence, not income. Settlement timing, owner transfers and cash banking can cause a legitimate difference from sales.</p><h2>Duplicate expense audit</h2>${duplicateCandidates.length ? `<div class="warn">Potential duplicate exposure: ${escapeHtml(money(duplicateExposure))}. These are flags only; nothing is automatically deleted.</div><table><tr><th>Date 1</th><th>Date 2</th><th>Supplier / payee</th><th style="text-align:right">Amount</th><th>Risk</th></tr>${duplicateRows}</table>` : `<div class="ok">No clear duplicate pairs found using the conservative same-amount, same-normalised-merchant, within-2-days rule.</div>`}<h2>Data quality / investor notes</h2>${warnings.length ? warnings.map((warning) => `<div class="warn">${escapeHtml(warning)}</div>`).join("") : `<div class="ok">No major accounting-quality exception was detected in this selected period.</div>`}<p class="muted">Generated from the SBB reporting ledger and Finance Expenses selected period. This report intentionally withholds derived profit figures when doing otherwise could double count costs or imply false precision.</p></body></html>`;
    downloadBlob(`sbb-investor-finance-${dateFrom}-to-${dateTo}.html`, "text/html;charset=utf-8", html);
  };

  const downloadAuditCsv = () => {
    const rows: unknown[][] = [
      ["Section", "Date 1", "Date 2", "Supplier / Payee", "Amount THB", "Current Category", "Suggested Category", "Reason", "Risk"],
      ...duplicateCandidates.map((candidate) => ["Duplicate candidate", rowDate(candidate.left), rowDate(candidate.right), candidate.merchant, candidate.amount.toFixed(2), candidate.left?.category || "", "", "Same amount + same normalised merchant + within 2 days", candidate.crossSource ? "Cross-source" : "Same-source"]),
      ...suggestions.map((suggestion) => {
        const row = businessExpenses.find((item) => String(item?.id || "") === suggestion.id);
        return ["Category suggestion", rowDate(row), "", row?.supplier || row?.description || "", number(row?.amount).toFixed(2), row?.category || "Review", suggestion.category, suggestion.reason, suggestion.confidence === "rule" ? "Existing rule" : "Repeated pattern"];
      }),
    ];
    downloadBlob(`sbb-expense-audit-${dateFrom}-to-${dateTo}.csv`, "text/csv;charset=utf-8", `\uFEFF${rows.map((row) => row.map(csvCell).join(",")).join("\n")}`);
  };

  return (
    <section className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-[0_12px_32px_rgba(15,23,42,.08)]">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <p className="text-[10px] font-black uppercase tracking-[.22em] text-blue-600">Investor reporting & expense intelligence</p>
          <h2 className="mt-2 text-xl font-black text-slate-950">Financial Control Summary</h2>
          <p className="mt-1 max-w-3xl text-xs text-slate-500">Sales, recorded expenses, reconciliation evidence, conservative duplicate detection and high-confidence repeat-category suggestions for the selected period.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button size="sm" variant="outline" onClick={downloadAuditCsv}><Download className="mr-2 h-4 w-4" />Expense Audit CSV</Button>
          <Button size="sm" className="bg-slate-950 text-white hover:bg-slate-800" disabled={!overview} onClick={downloadInvestorHtml}><Download className="mr-2 h-4 w-4" />Investor Summary</Button>
        </div>
      </div>

      <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        <div className="rounded-2xl border border-slate-200 p-4"><p className="text-[10px] font-black uppercase text-slate-400">Net sales</p><p className="mt-1 text-xl font-black">{overview ? money(overview.netSales) : overviewQuery.isLoading ? "Loading…" : "—"}</p></div>
        <div className="rounded-2xl border border-slate-200 p-4"><p className="text-[10px] font-black uppercase text-slate-400">Recorded expenses</p><p className="mt-1 text-xl font-black">{money(expenseTotal)}</p></div>
        <div className="rounded-2xl border border-slate-200 p-4"><p className="text-[10px] font-black uppercase text-slate-400">Bank credits</p><p className="mt-1 text-xl font-black">{money(depositTotal)}</p></div>
        <div className={`rounded-2xl border p-4 ${duplicateCandidates.length ? "border-amber-300 bg-amber-50" : "border-emerald-200 bg-emerald-50"}`}><p className="text-[10px] font-black uppercase text-slate-500">Clear duplicate flags</p><p className="mt-1 text-xl font-black">{duplicateCandidates.length}</p><p className="mt-1 text-[10px] text-slate-500">Exposure {money(duplicateExposure)}</p></div>
        <div className={`rounded-2xl border p-4 ${suggestions.length ? "border-blue-200 bg-blue-50" : "border-slate-200"}`}><p className="text-[10px] font-black uppercase text-slate-500">Auto-category suggestions</p><p className="mt-1 text-xl font-black">{suggestions.length}</p><p className="mt-1 text-[10px] text-slate-500">Existing rules + repeated history only</p></div>
      </div>

      {overviewQuery.isError ? <div className="mt-4 rounded-2xl border border-red-200 bg-red-50 p-4 text-xs font-bold text-red-700">{(overviewQuery.error as Error).message}</div> : null}

      <div className="mt-5 grid gap-4 xl:grid-cols-2">
        <div className="rounded-2xl border border-slate-200 p-4">
          <div className="flex items-center gap-2"><AlertTriangle className="h-4 w-4 text-amber-600" /><h3 className="text-sm font-black">Duplicate expense review</h3></div>
          <p className="mt-1 text-[11px] text-slate-500">Only flags exact amounts with the same normalised supplier/payee within two days. No expense is automatically deleted or excluded.</p>
          <div className="mt-3 max-h-64 overflow-auto">
            {duplicateCandidates.length === 0 ? <div className="rounded-xl bg-emerald-50 p-3 text-xs font-bold text-emerald-800"><ShieldCheck className="mr-2 inline h-4 w-4" />No clear duplicate pairs found.</div> : duplicateCandidates.slice(0, 40).map((candidate, index) => <div key={`${candidate.left?.id}-${candidate.right?.id}-${index}`} className="mb-2 rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs"><div className="flex justify-between gap-3"><span className="font-black text-amber-950">{candidate.merchant}</span><span className="font-mono font-black">{money(candidate.amount)}</span></div><div className="mt-1 text-[11px] text-amber-800">{rowDate(candidate.left)} ↔ {rowDate(candidate.right)} · {candidate.dayGap} day gap · {candidate.crossSource ? "cross-source" : "same-source"}</div></div>)}
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200 p-4">
          <div className="flex items-center justify-between gap-3"><div><div className="flex items-center gap-2"><WandSparkles className="h-4 w-4 text-blue-600" /><h3 className="text-sm font-black">Repeated expense categories</h3></div><p className="mt-1 text-[11px] text-slate-500">Suggests categories only from an existing vendor rule or a merchant with at least two prior rows that all use the same category.</p></div><Button size="sm" variant="outline" disabled={!suggestions.length} onClick={stageSuggestions}>Stage {suggestions.length}</Button></div>
          <div className="mt-3 max-h-64 overflow-auto">
            {suggestions.length === 0 ? <div className="rounded-xl bg-slate-50 p-3 text-xs font-bold text-slate-600">No unambiguous repeated-category suggestions in this period.</div> : suggestions.slice(0, 40).map((suggestion) => {
              const row = businessExpenses.find((item) => String(item?.id || "") === suggestion.id);
              return <div key={suggestion.id} className="mb-2 rounded-xl border border-blue-100 bg-blue-50 p-3 text-xs"><div className="flex justify-between gap-3"><span className="font-black text-blue-950">{row?.supplier || row?.description || suggestion.id}</span><span className="rounded-full bg-white px-2 py-1 text-[10px] font-black text-blue-700">{suggestion.category}</span></div><div className="mt-1 text-[11px] text-blue-700">{suggestion.reason}</div></div>;
            })}
          </div>
        </div>
      </div>

      {overview ? <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 p-4 text-xs text-slate-600"><strong>Accounting guardrail:</strong> {overview.costing.fullyCosted ? "COGS is fully costed for this range." : `COGS is incomplete (${overview.costing.coveragePct == null ? "unknown" : `${overview.costing.coveragePct.toFixed(1)}%`} coverage).`} {hasFoodPurchaseOverlap ? "Net profit is withheld in the downloadable summary because recorded food/packaging purchases overlap with recipe-based COGS and subtracting both would risk double counting." : canShowOperatingResult ? `Indicative operating result before tax/owner adjustments: ${money(operatingResult)}` : "Derived operating profit is withheld until cost coverage is complete."}</div> : null}
    </section>
  );
}
