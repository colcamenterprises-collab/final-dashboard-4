import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AlertTriangle, CheckCircle2, Download, Pencil, Plus, ShieldCheck, Trash2, UserRound, WandSparkles, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

type VendorRule = { id: string; matchText: string; category: string; supplier?: string | null };
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
};
type DuplicateCandidate = { left: any; right: any; merchant: string; amount: number; dayGap: number; crossSource: boolean; pairKey: string };
type CategorySuggestion = { id: string; category: string; reason: string; confidence: "rule" | "repeat" };
type DuplicateResolution = { pairKey: string; outcome: string; reviewedAt?: string; reviewedBy?: string };

const RULE_CATEGORIES = [
  "Food & Beverage",
  "Kitchen Supplies & Packaging",
  "Utilities",
  "Rent",
  "Staff Expenses",
  "Repairs & Maintenance",
  "Marketing",
  "Administration",
  "Software & Subscriptions",
  "Bank Fees",
  "Equipment",
  "Fuel & Transport",
  "Other Business Expense",
];

function absNumber(value: unknown) {
  const parsed = Number(value || 0);
  return Number.isFinite(parsed) ? Math.abs(parsed) : 0;
}
function rawNumber(value: unknown) {
  const parsed = Number(value || 0);
  return Number.isFinite(parsed) ? parsed : 0;
}
function money(value: unknown) {
  return `฿${absNumber(value).toLocaleString("en-TH", { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;
}
function signedMoney(value: unknown) {
  const parsed = rawNumber(value);
  return `${parsed < 0 ? "-" : ""}฿${Math.abs(parsed).toLocaleString("en-TH", { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;
}
function normalizeText(value: unknown) {
  return String(value || "")
    .toUpperCase()
    .replace(/[^A-Z0-9ก-๙]+/g, " ")
    .replace(/\b(CO|LTD|LIMITED|COMPANY|THAILAND|TH|PAYMENT|TRANSFER|DEBIT|CREDIT|QR|PROMPTPAY|ONLINE)\b/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}
function normalizeCategory(value: unknown) {
  return String(value || "").toUpperCase().replace(/&/g, " AND ").replace(/[^A-Z0-9]+/g, " ").replace(/\s+/g, " ").trim();
}
function isCogsOverlapCategory(value: unknown) {
  const category = normalizeCategory(value);
  return category === "FOOD AND BEVERAGE" || category === "KITCHEN SUPPLIES AND PACKAGING";
}
function merchantKey(row: any) {
  const supplier = normalizeText(row?.supplier);
  if (supplier.length >= 3) return supplier;
  return normalizeText(row?.description).split(" ").slice(0, 5).join(" ");
}
function sourceKey(row: any) {
  if (bankTxnId(row)) return "bank";
  if (row?.submission_id || String(row?.id || "").startsWith("shift:")) return "shift";
  return String(row?.source || row?.payment_source || "manual").toLowerCase();
}
function bankTxnId(row: any) {
  if (row?.meta?.bankTxnId) return String(row.meta.bankTxnId);
  const id = String(row?.id || "");
  return id.startsWith("bank_txn:") ? id.slice("bank_txn:".length) : null;
}
function rowDate(row: any) {
  return String(row?.date || row?.postedAt || "").slice(0, 10);
}
function rowRef(row: any) {
  const bankId = bankTxnId(row);
  if (bankId) return `bank:${bankId}`;
  if (row?.submission_id) {
    const fingerprint = [
      String(row.submission_id),
      String(row.kind ?? "expense"),
      rowDate(row),
      normalizeText(row?.supplier),
      normalizeText(row?.description),
      absNumber(row?.amount).toFixed(2),
    ].join(":");
    return `shift:${fingerprint}`;
  }
  return `expense:${String(row?.id || `${rowDate(row)}:${merchantKey(row)}:${absNumber(row?.amount)}`)}`;
}
function pairKeyFor(left: any, right: any) {
  return [rowRef(left), rowRef(right)].sort().join("||");
}
function dayValue(value: string) {
  const parsed = Date.parse(`${value}T00:00:00Z`);
  return Number.isFinite(parsed) ? parsed : Number.NaN;
}
function addDays(value: string, days: number) {
  const parsed = dayValue(value);
  if (!Number.isFinite(parsed)) return value;
  return new Date(parsed + days * 86400000).toISOString().slice(0, 10);
}
function dateDiffDays(a: string, b: string) {
  const left = dayValue(a);
  const right = dayValue(b);
  if (!Number.isFinite(left) || !Number.isFinite(right)) return 999;
  return Math.abs(Math.round((left - right) / 86400000));
}
function rowIdentity(row: any, fallback: number) {
  return rowRef(row) || `${sourceKey(row)}:${rowDate(row)}:${merchantKey(row)}:${absNumber(row?.amount)}:${fallback}`;
}
function clearDuplicateCandidates(rows: any[]) {
  const buckets = new Map<string, Array<{ row: any; index: number }>>();
  rows.forEach((row, index) => {
    const amount = absNumber(row?.amount);
    const merchant = merchantKey(row);
    if (!amount || !merchant || !rowDate(row)) return;
    const key = `${amount.toFixed(2)}|${merchant}`;
    const bucket = buckets.get(key) || [];
    bucket.push({ row, index });
    buckets.set(key, bucket);
  });
  const candidates: DuplicateCandidate[] = [];
  for (const bucket of Array.from(buckets.values())) {
    bucket.sort((a, b) => dayValue(rowDate(a.row)) - dayValue(rowDate(b.row)));
    for (let i = 0; i < bucket.length; i += 1) {
      for (let j = i + 1; j < bucket.length; j += 1) {
        const left = bucket[i].row;
        const right = bucket[j].row;
        if (rowIdentity(left, bucket[i].index) === rowIdentity(right, bucket[j].index)) continue;
        const dayGap = dateDiffDays(rowDate(left), rowDate(right));
        if (dayGap > 2) break;
        candidates.push({ left, right, merchant: merchantKey(left), amount: absNumber(left?.amount), dayGap, crossSource: sourceKey(left) !== sourceKey(right), pairKey: pairKeyFor(left, right) });
      }
    }
  }
  return candidates.sort((a, b) => Number(b.crossSource) - Number(a.crossSource) || a.dayGap - b.dayGap || b.amount - a.amount);
}
function duplicateExposureAmount(candidates: DuplicateCandidate[]) {
  const adjacency = new Map<any, Set<any>>();
  candidates.forEach((candidate) => {
    const leftLinks = adjacency.get(candidate.left) || new Set<any>();
    const rightLinks = adjacency.get(candidate.right) || new Set<any>();
    leftLinks.add(candidate.right);
    rightLinks.add(candidate.left);
    adjacency.set(candidate.left, leftLinks);
    adjacency.set(candidate.right, rightLinks);
  });
  const visited = new Set<any>();
  let exposure = 0;
  adjacency.forEach((_links, start) => {
    if (visited.has(start)) return;
    const stack = [start];
    let componentSize = 0;
    let componentAmount = absNumber(start?.amount);
    while (stack.length) {
      const node = stack.pop();
      if (!node || visited.has(node)) continue;
      visited.add(node);
      componentSize += 1;
      if (!componentAmount) componentAmount = absNumber(node?.amount);
      const links = adjacency.get(node);
      if (links) Array.from(links).forEach((linked) => { if (!visited.has(linked)) stack.push(linked); });
    }
    exposure += componentAmount * Math.max(0, componentSize - 1);
  });
  return exposure;
}
function categorySuggestions(rows: any[], vendorRules: VendorRule[]) {
  const knownByMerchant = new Map<string, string[]>();
  for (const row of rows) {
    const category = String(row?.category || "").trim();
    if (!category || category === "Review" || category === "Other Business Expense") continue;
    const merchant = merchantKey(row);
    if (!merchant) continue;
    knownByMerchant.set(merchant, [...(knownByMerchant.get(merchant) || []), category]);
  }
  const orderedRules = [...vendorRules].sort((a, b) => normalizeText(b.matchText).length - normalizeText(a.matchText).length);
  const suggestions: CategorySuggestion[] = [];
  for (const row of rows) {
    const id = String(row?.id || "");
    const current = String(row?.category || "Review").trim() || "Review";
    if (!id || (current !== "Review" && current !== "Other Business Expense")) continue;
    const searchable = `${normalizeText(row?.supplier)} ${normalizeText(row?.description)}`.trim();
    const matchingRule = orderedRules.find((rule) => {
      const match = normalizeText(rule.matchText);
      return match.length >= 2 && (normalizeText(row?.supplier) === match || (!normalizeText(row?.supplier) && searchable.includes(match)));
    });
    if (matchingRule?.category && matchingRule.category !== current) {
      suggestions.push({ id, category: matchingRule.category, reason: `Existing rule: ${matchingRule.matchText}`, confidence: "rule" });
      continue;
    }
    const merchant = merchantKey(row);
    const history = knownByMerchant.get(merchant) || [];
    if (history.length < 2) continue;
    const first = history[0];
    if (first && history.every((category) => category === first)) suggestions.push({ id, category: first, reason: `${history.length} prior ${merchant} expenses all use this category`, confidence: "repeat" });
  }
  return suggestions;
}
function ruleMatchesRow(rule: VendorRule, row: any) {
  const match = normalizeText(rule.matchText || rule.supplier);
  const supplier = normalizeText(row?.supplier);
  if (!match) return false;
  if (supplier) return supplier === match;
  return normalizeText(row?.description).includes(match);
}
function csvCell(value: unknown) {
  return `"${String(value ?? "").replace(/"/g, '""')}"`;
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
  return String(value ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#039;");
}

export default function InvestorFinanceReport({ dateFrom, dateTo, businessExpenses, inShiftExpenses, deposits, vendorRules, canManageCategories, onStageCategories }: {
  dateFrom: string;
  dateTo: string;
  businessExpenses: any[];
  inShiftExpenses: any[];
  deposits: any[];
  vendorRules: VendorRule[];
  canManageCategories: boolean;
  onStageCategories: (changes: Record<string, string>) => void;
}) {
  const queryClient = useQueryClient();
  const [newRuleSupplier, setNewRuleSupplier] = useState("");
  const [newRuleCategory, setNewRuleCategory] = useState(RULE_CATEGORIES[0]);
  const [editingRuleId, setEditingRuleId] = useState<string | null>(null);
  const [editingRuleSupplier, setEditingRuleSupplier] = useState("");
  const [editingRuleCategory, setEditingRuleCategory] = useState(RULE_CATEGORIES[0]);
  const inclusiveEndDate = addDays(dateTo, 1);
  const params = useMemo(() => new URLSearchParams({ fromDate: dateFrom, fromTime: "00:00", toDate: inclusiveEndDate, toTime: "00:00", timezone: "Asia/Bangkok" }).toString(), [dateFrom, inclusiveEndDate]);
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
  const resolutionQuery = useQuery<{ ok: boolean; resolutions: DuplicateResolution[] }>({
    queryKey: ["/api/finance/expense-review/duplicate-resolutions"],
    enabled: true,
    queryFn: async () => {
      const response = await fetch("/api/finance/expense-review/duplicate-resolutions", { credentials: "include", cache: "no-store" });
      const payload = await response.json().catch(() => null);
      if (!response.ok || !payload?.ok) throw new Error(payload?.error || "Failed to load duplicate review decisions");
      return payload;
    },
  });

  const allExpenseRows = useMemo(() => [...businessExpenses, ...inShiftExpenses], [businessExpenses, inShiftExpenses]);
  const allDuplicateCandidates = useMemo(() => clearDuplicateCandidates(allExpenseRows), [allExpenseRows]);
  const resolvedPairKeys = useMemo(() => new Set((resolutionQuery.data?.resolutions || []).map((item) => item.pairKey)), [resolutionQuery.data]);
  const duplicateCandidates = useMemo(() => allDuplicateCandidates.filter((candidate) => !resolvedPairKeys.has(candidate.pairKey)), [allDuplicateCandidates, resolvedPairKeys]);
  const suggestions = useMemo(() => categorySuggestions(businessExpenses, vendorRules), [businessExpenses, vendorRules]);
  const suggestionSignature = useMemo(() => suggestions.map((item) => `${item.id}:${item.category}`).sort().join("|"), [suggestions]);
  const vendorRulesReady = queryClient.getQueryState(["/api/bank-imports/rules"])?.status === "success";
  const businessTotal = useMemo(() => businessExpenses.reduce((sum, row) => sum + absNumber(row.amount), 0), [businessExpenses]);
  const shiftTotal = useMemo(() => inShiftExpenses.reduce((sum, row) => sum + absNumber(row.amount), 0), [inShiftExpenses]);
  const depositTotal = useMemo(() => deposits.reduce((sum, row) => sum + absNumber(row.amount), 0), [deposits]);
  const expenseTotal = businessTotal + shiftTotal;
  const duplicateExposure = duplicateExposureAmount(duplicateCandidates);
  const overview = overviewQuery.data?.overview;
  const hasFoodPurchaseOverlap = allExpenseRows.some((row) => isCogsOverlapCategory(row?.category));
  const canShowOperatingResult = Boolean(overview?.costing?.fullyCosted && !hasFoodPurchaseOverlap);
  const operatingResult = canShowOperatingResult ? rawNumber(overview?.netSales) - rawNumber(overview?.costing?.costOfGoods) - expenseTotal : null;

  const refreshFinance = () => {
    queryClient.invalidateQueries({ queryKey: ["/api/finance/expenses-dashboard"] });
    queryClient.invalidateQueries({ queryKey: ["/api/bank-imports/review-queue"] });
    queryClient.invalidateQueries({ queryKey: ["/api/bank-imports/rules"] });
    queryClient.invalidateQueries({ queryKey: ["/api/finance/expense-review/duplicate-resolutions"] });
  };

  useEffect(() => {
    if (!canManageCategories || !vendorRulesReady || !suggestionSignature) return;
    onStageCategories(Object.fromEntries(suggestions.map((item) => [item.id, item.category])));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canManageCategories, vendorRulesReady, suggestionSignature]);

  const recordResolution = async (candidate: DuplicateCandidate, outcome: string) => {
    const response = await fetch("/api/finance/expense-review/duplicate-resolutions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ pairKey: candidate.pairKey, leftRef: rowRef(candidate.left), rightRef: rowRef(candidate.right), outcome }),
    });
    const payload = await response.json().catch(() => null);
    if (!response.ok || !payload?.ok) throw new Error(payload?.error || "Failed to record duplicate decision");
  };

  const clearResolution = async (candidate: DuplicateCandidate) => {
    const response = await fetch(`/api/finance/expense-review/duplicate-resolutions/${encodeURIComponent(candidate.pairKey)}`, {
      method: "DELETE",
      credentials: "include",
    });
    const payload = await response.json().catch(() => null);
    if (!response.ok || !payload?.ok) throw new Error(payload?.error || "Failed to clear duplicate decision");
  };

  const actOnExpenseRow = async (row: any, action: "remove" | "personal") => {
    const bankId = bankTxnId(row);
    if (action === "personal") {
      if (!bankId) throw new Error("Only bank-statement expenses can be moved to Personal.");
      const response = await fetch(`/api/finance/bank-imports/txns/${encodeURIComponent(bankId)}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, credentials: "include", body: JSON.stringify({ category: "Personal / Owner" }) });
      const payload = await response.json().catch(() => null);
      if (!response.ok || !payload?.ok) throw new Error(payload?.error || payload?.reason || "Failed to move expense to Personal");
      return;
    }
    if (bankId) {
      const response = await fetch(`/api/finance/bank-imports/txns/${encodeURIComponent(bankId)}`, { method: "DELETE", credentials: "include" });
      const payload = await response.json().catch(() => null);
      if (!response.ok || !payload?.ok) throw new Error(payload?.error || "Failed to remove bank expense");
      return;
    }
    if (row?.submission_id) {
      const response = await fetch(`/api/finance/shift-expenses/${encodeURIComponent(row.submission_id)}/${encodeURIComponent(row.kind)}/${encodeURIComponent(row.ordinality)}`, { method: "DELETE", credentials: "include" });
      const payload = await response.json().catch(() => null);
      if (!response.ok || !payload?.ok) throw new Error(payload?.error || "Failed to remove shift expense");
      return;
    }
    const response = await fetch(`/api/expensesV2/${encodeURIComponent(String(row?.id || ""))}`, { method: "DELETE", credentials: "include" });
    const payload = await response.json().catch(() => null);
    if (!response.ok) throw new Error(payload?.error || "Failed to remove business expense");
  };

  const duplicateAction = useMutation({
    mutationFn: async ({ candidate, action, side }: { candidate: DuplicateCandidate; action: "keep" | "remove" | "personal"; side?: "left" | "right" }) => {
      if (action === "keep") {
        await recordResolution(candidate, "keep_both");
        return;
      }
      const row = side === "right" ? candidate.right : candidate.left;
      const outcome = `${action === "remove" ? "removed" : "personal"}_${side || "left"}`;
      await recordResolution(candidate, outcome);
      try {
        await actOnExpenseRow(row, action);
      } catch (error) {
        try {
          await clearResolution(candidate);
        } catch (rollbackError) {
          refreshFinance();
          const actionMessage = error instanceof Error ? error.message : String(error);
          throw new Error(`${actionMessage}. The duplicate decision could not be rolled back; refresh before retrying.`);
        }
        throw error;
      }
    },
    onSuccess: refreshFinance,
    onError: (error: Error) => { refreshFinance(); window.alert(error.message); },
  });

  const createRule = useMutation({
    mutationFn: async ({ supplier, category }: { supplier: string; category: string }) => {
      const cleanSupplier = supplier.trim();
      const response = await fetch("/api/finance/expense-review/vendor-rules", { method: "POST", headers: { "Content-Type": "application/json" }, credentials: "include", body: JSON.stringify({ matchText: cleanSupplier, supplier: cleanSupplier, category }) });
      const payload = await response.json().catch(() => null);
      if (!response.ok || !payload?.ok) throw new Error(payload?.error || "Failed to create expense category rule");
      return payload;
    },
    onSuccess: () => { setNewRuleSupplier(""); refreshFinance(); },
    onError: (error: Error) => window.alert(error.message),
  });
  const updateRule = useMutation({
    mutationFn: async ({ id, supplier, category }: { id: string; supplier: string; category: string }) => {
      const cleanSupplier = supplier.trim();
      const response = await fetch(`/api/finance/expense-review/vendor-rules/${encodeURIComponent(id)}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, credentials: "include", body: JSON.stringify({ matchText: cleanSupplier, supplier: cleanSupplier, category }) });
      const payload = await response.json().catch(() => null);
      if (!response.ok || !payload?.ok) throw new Error(payload?.error || "Failed to update expense category rule");
      return payload;
    },
    onSuccess: () => { setEditingRuleId(null); refreshFinance(); },
    onError: (error: Error) => window.alert(error.message),
  });
  const deleteRule = useMutation({
    mutationFn: async (id: string) => {
      const response = await fetch(`/api/finance/expense-review/vendor-rules/${encodeURIComponent(id)}`, { method: "DELETE", credentials: "include" });
      const payload = await response.json().catch(() => null);
      if (!response.ok || !payload?.ok) throw new Error(payload?.error || "Failed to delete expense category rule");
      return payload;
    },
    onSuccess: refreshFinance,
    onError: (error: Error) => window.alert(error.message),
  });
  const applyRule = useMutation({
    mutationFn: async (rule: VendorRule) => {
      const matches = businessExpenses.filter((row) => ruleMatchesRow(rule, row) && String(row?.category || "Review") !== rule.category);
      for (const row of matches) {
        const bankId = bankTxnId(row);
        if (bankId) {
          const response = await fetch(`/api/finance/bank-imports/txns/${encodeURIComponent(bankId)}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, credentials: "include", body: JSON.stringify({ category: rule.category }) });
          if (!response.ok) throw new Error(`Failed to apply rule to ${row?.supplier || row?.description || bankId}`);
        } else {
          const response = await fetch(`/api/expensesV2/${encodeURIComponent(String(row.id))}`, { method: "PUT", headers: { "Content-Type": "application/json" }, credentials: "include", body: JSON.stringify({ date: rowDate(row), supplier: String(row?.supplier || rule.supplier || rule.matchText).trim(), category: rule.category, description: String(row?.description || "").trim(), amount: Number(row?.amount || 0) }) });
          if (!response.ok) throw new Error(`Failed to apply rule to ${row?.supplier || row?.description || row.id}`);
        }
      }
      return matches.length;
    },
    onSuccess: (count) => { refreshFinance(); window.alert(`Rule applied to ${count} matching expense${count === 1 ? "" : "s"} in the selected period.`); },
    onError: (error: Error) => window.alert(error.message),
  });

  const downloadAuditCsv = () => {
    const rows: unknown[][] = [
      ["Section", "Date 1", "Date 2", "Supplier / Payee", "Amount THB", "Current Category", "Suggested Category", "Reason", "Risk"],
      ...duplicateCandidates.map((candidate) => ["Unresolved duplicate candidate", rowDate(candidate.left), rowDate(candidate.right), candidate.merchant, candidate.amount.toFixed(2), candidate.left?.category || "", "", "Same amount + same normalised supplier/payee + within 2 days", candidate.crossSource ? "Cross-source" : "Same-source"]),
      ...suggestions.map((suggestion) => { const row = businessExpenses.find((item) => String(item?.id || "") === suggestion.id); return ["Category suggestion", rowDate(row), "", row?.supplier || row?.description || "", absNumber(row?.amount).toFixed(2), row?.category || "Review", suggestion.category, suggestion.reason, suggestion.confidence === "rule" ? "Existing rule" : "Repeated pattern"]; }),
    ];
    downloadBlob(`sbb-expense-audit-${dateFrom}-to-${dateTo}.csv`, "text/csv;charset=utf-8", `\uFEFF${rows.map((row) => row.map(csvCell).join(",")).join("\n")}`);
  };

  const downloadInvestorHtml = () => {
    if (!overview) return;
    const categoryTotals = new Map<string, number>();
    allExpenseRows.forEach((row) => { const category = String(row?.category || "Review"); categoryTotals.set(category, (categoryTotals.get(category) || 0) + absNumber(row?.amount)); });
    const categoryRows = Array.from(categoryTotals.entries()).sort((a, b) => b[1] - a[1]).map(([category, amount]) => `<tr><td>${escapeHtml(category)}</td><td class="r">${escapeHtml(money(amount))}</td></tr>`).join("");
    const paymentRows = Object.entries(overview.paymentSales || {}).sort((a, b) => Number(b[1]) - Number(a[1])).map(([channel, amount]) => `<tr><td>${escapeHtml(channel)}</td><td class="r">${escapeHtml(money(amount))}</td></tr>`).join("");
    const duplicateRows = duplicateCandidates.map((candidate) => `<tr><td>${escapeHtml(rowDate(candidate.left))}</td><td>${escapeHtml(rowDate(candidate.right))}</td><td>${escapeHtml(candidate.merchant)}</td><td class="r">${escapeHtml(money(candidate.amount))}</td><td>${candidate.crossSource ? "Cross-source" : "Same-source"}</td></tr>`).join("");
    const warnings = [!overview.costing.fullyCosted ? `COGS coverage is ${overview.costing.coveragePct == null ? "unknown" : `${overview.costing.coveragePct.toFixed(1)}%`}; full profit is withheld.` : "", hasFoodPurchaseOverlap ? "Operating profit is deliberately withheld because food/packaging purchases overlap with recipe-based COGS and subtracting both could double count costs." : "", duplicateCandidates.length ? `${duplicateCandidates.length} unresolved duplicate candidate pair(s) require owner review.` : ""].filter(Boolean);
    const reconciliationDelta = depositTotal - rawNumber(overview.netSales);
    const html = `<!doctype html><html><head><meta charset="utf-8"><title>SBB Investor Finance Summary</title><style>body{font-family:Arial,sans-serif;color:#111827;margin:40px;line-height:1.45}h1{font-size:28px;margin:4px 0}h2{font-size:17px;margin-top:28px;border-bottom:1px solid #d1d5db;padding-bottom:6px}.muted{color:#6b7280}.grid{display:grid;grid-template-columns:repeat(4,1fr);gap:12px;margin:20px 0}.card{border:1px solid #e5e7eb;border-radius:14px;padding:14px}.label{font-size:11px;text-transform:uppercase;color:#6b7280;font-weight:700}.value{font-size:22px;font-weight:800;margin-top:6px}table{width:100%;border-collapse:collapse;margin-top:10px}th,td{padding:8px;border-bottom:1px solid #e5e7eb;font-size:12px;text-align:left}.r{text-align:right}.warn{background:#fff7ed;border:1px solid #fdba74;padding:12px;border-radius:10px;margin:8px 0}.ok{background:#ecfdf5;border:1px solid #6ee7b7;padding:12px;border-radius:10px;margin:8px 0}@media print{body{margin:20px}}</style></head><body><div class="muted">Smash Brothers Burgers · Investor-style financial summary</div><h1>${escapeHtml(dateFrom)} to ${escapeHtml(dateTo)}</h1><div class="grid"><div class="card"><div class="label">Gross sales</div><div class="value">${escapeHtml(money(overview.grossSales))}</div></div><div class="card"><div class="label">Net sales</div><div class="value">${escapeHtml(money(overview.netSales))}</div></div><div class="card"><div class="label">Recorded expenses</div><div class="value">${escapeHtml(money(expenseTotal))}</div></div><div class="card"><div class="label">Bank credits</div><div class="value">${escapeHtml(money(depositTotal))}</div></div></div><h2>Income</h2><table><tr><td>Gross sales</td><td class="r">${escapeHtml(money(overview.grossSales))}</td></tr><tr><td>Discounts</td><td class="r">${escapeHtml(money(overview.discounts))}</td></tr><tr><td>Refunds</td><td class="r">${escapeHtml(money(overview.refunds))}</td></tr><tr><td><strong>Net sales</strong></td><td class="r"><strong>${escapeHtml(money(overview.netSales))}</strong></td></tr></table><h2>Profitability</h2><table><tr><td>COGS</td><td class="r">${overview.costing.fullyCosted ? escapeHtml(money(overview.costing.costOfGoods)) : "Withheld — incomplete costing"}</td></tr><tr><td>Gross profit</td><td class="r">${overview.costing.grossProfit == null ? "Withheld" : escapeHtml(signedMoney(overview.costing.grossProfit))}</td></tr><tr><td>Operating result before tax / owner adjustments</td><td class="r">${operatingResult == null ? "Withheld — overlap/incomplete costing" : escapeHtml(signedMoney(operatingResult))}</td></tr></table><h2>Expenses</h2><table><tr><td>Business expenses</td><td class="r">${escapeHtml(money(businessTotal))}</td></tr><tr><td>Shift expenses</td><td class="r">${escapeHtml(money(shiftTotal))}</td></tr><tr><td><strong>Total recorded expenses</strong></td><td class="r"><strong>${escapeHtml(money(expenseTotal))}</strong></td></tr>${categoryRows}</table><h2>Payment sales</h2><table>${paymentRows}</table><h2>Reconciliation</h2><table><tr><td>Net sales</td><td class="r">${escapeHtml(money(overview.netSales))}</td></tr><tr><td>Bank deposits / credits</td><td class="r">${escapeHtml(money(depositTotal))}</td></tr><tr><td>Deposit less net sales (timing/classification indicator only)</td><td class="r">${escapeHtml(signedMoney(reconciliationDelta))}</td></tr></table><p class="muted">Bank credits are reconciliation evidence, not income.</p><h2>Duplicate expense audit</h2>${duplicateCandidates.length ? `<div class="warn">Unresolved potential duplicate exposure: ${escapeHtml(money(duplicateExposure))}.</div><table><tr><th>Date 1</th><th>Date 2</th><th>Supplier / payee</th><th class="r">Amount</th><th>Risk</th></tr>${duplicateRows}</table>` : `<div class="ok">No unresolved duplicate pairs remain for this period.</div>`}<h2>Data quality / investor notes</h2>${warnings.length ? warnings.map((warning) => `<div class="warn">${escapeHtml(warning)}</div>`).join("") : `<div class="ok">No major accounting-quality exception was detected for this selected period.</div>`}</body></html>`;
    downloadBlob(`sbb-investor-finance-${dateFrom}-to-${dateTo}.html`, "text/html;charset=utf-8", html);
  };

  const renderExpenseSide = (candidate: DuplicateCandidate, side: "left" | "right") => {
    const row = side === "left" ? candidate.left : candidate.right;
    const canPersonal = Boolean(bankTxnId(row));
    return <div className="rounded-xl border border-amber-200 bg-white p-3"><div className="flex items-start justify-between gap-3"><div><p className="font-black text-slate-950">{row?.supplier || row?.description || candidate.merchant}</p><p className="mt-1 text-[10px] uppercase tracking-wide text-slate-400">{sourceKey(row)} · {rowDate(row)}</p></div><span className="font-mono font-black">{money(row?.amount)}</span></div><p className="mt-2 text-[11px] text-slate-600">{row?.description || "No description"}</p><p className="mt-1 text-[10px] font-bold text-slate-500">Category: {row?.category || "Review"}</p>{canManageCategories ? <div className="mt-3 flex flex-wrap gap-2"><Button size="sm" variant="outline" className="h-7 px-2 text-[10px] text-red-700" disabled={duplicateAction.isPending || resolutionQuery.isError} onClick={() => window.confirm(`Remove this ${sourceKey(row)} expense from reporting?`) && duplicateAction.mutate({ candidate, action: "remove", side })}><Trash2 className="mr-1 h-3 w-3" />Remove</Button>{canPersonal ? <Button size="sm" variant="outline" className="h-7 px-2 text-[10px]" disabled={duplicateAction.isPending || resolutionQuery.isError} onClick={() => window.confirm("Move this bank expense to Personal / Owner?") && duplicateAction.mutate({ candidate, action: "personal", side })}><UserRound className="mr-1 h-3 w-3" />Personal</Button> : null}</div> : null}</div>;
  };

  return (
    <section className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-[0_12px_32px_rgba(15,23,42,.08)]">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between"><div><p className="text-[10px] font-black uppercase tracking-[.22em] text-blue-600">Investor reporting & expense intelligence</p><h2 className="mt-2 text-xl font-black text-slate-950">Financial Control Summary</h2><p className="mt-1 max-w-3xl text-xs text-slate-500">Sales, expenses, reconciliation, actionable duplicate review and owner-controlled expense category rules.</p></div><div className="flex flex-wrap gap-2"><Button size="sm" variant="outline" onClick={downloadAuditCsv}><Download className="mr-2 h-4 w-4" />Expense Audit CSV</Button><Button size="sm" className="bg-slate-950 text-white hover:bg-slate-800" disabled={!overview} onClick={downloadInvestorHtml}><Download className="mr-2 h-4 w-4" />Investor Summary</Button></div></div>
      <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-5"><div className="rounded-2xl border border-slate-200 p-4"><p className="text-[10px] font-black uppercase text-slate-400">Net sales</p><p className="mt-1 text-xl font-black">{overview ? money(overview.netSales) : overviewQuery.isLoading ? "Loading…" : "—"}</p></div><div className="rounded-2xl border border-slate-200 p-4"><p className="text-[10px] font-black uppercase text-slate-400">Recorded expenses</p><p className="mt-1 text-xl font-black">{money(expenseTotal)}</p></div><div className="rounded-2xl border border-slate-200 p-4"><p className="text-[10px] font-black uppercase text-slate-400">Bank credits</p><p className="mt-1 text-xl font-black">{money(depositTotal)}</p></div><div className={`rounded-2xl border p-4 ${duplicateCandidates.length ? "border-amber-300 bg-amber-50" : "border-emerald-200 bg-emerald-50"}`}><p className="text-[10px] font-black uppercase text-slate-500">Unresolved duplicates</p><p className="mt-1 text-xl font-black">{duplicateCandidates.length}</p><p className="mt-1 text-[10px] text-slate-500">Exposure {money(duplicateExposure)}</p></div><div className={`rounded-2xl border p-4 ${suggestions.length ? "border-blue-200 bg-blue-50" : "border-slate-200"}`}><p className="text-[10px] font-black uppercase text-slate-500">Category suggestions</p><p className="mt-1 text-xl font-black">{suggestions.length}</p><p className="mt-1 text-[10px] text-slate-500">Rules + unanimous repeat history</p></div></div>
      {overviewQuery.isError ? <div className="mt-4 rounded-2xl border border-red-200 bg-red-50 p-4 text-xs font-bold text-red-700">{(overviewQuery.error as Error).message}</div> : null}
      {resolutionQuery.isError ? <div className="mt-4 rounded-2xl border border-red-200 bg-red-50 p-4 text-xs font-bold text-red-700">Duplicate decisions could not be loaded. Do not resolve duplicates until the finance migration is applied.</div> : null}

      <div className="mt-5 rounded-2xl border border-slate-200 p-4"><div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between"><div><div className="flex items-center gap-2"><AlertTriangle className="h-4 w-4 text-amber-600" /><h3 className="text-sm font-black">Duplicate Expense Review</h3></div><p className="mt-1 text-[11px] text-slate-500">Review both records before acting. Keep Both permanently dismisses the pair. Remove deletes/excludes the chosen reporting expense; Personal is available for bank transactions.</p></div><span className="text-[10px] font-bold text-slate-400">{resolvedPairKeys.size} prior decision{resolvedPairKeys.size === 1 ? "" : "s"} recorded</span></div><div className="mt-4 max-h-[620px] overflow-auto">{duplicateCandidates.length === 0 ? <div className="rounded-xl bg-emerald-50 p-3 text-xs font-bold text-emerald-800"><ShieldCheck className="mr-2 inline h-4 w-4" />No unresolved duplicate pairs found.</div> : duplicateCandidates.slice(0, 60).map((candidate) => <div key={candidate.pairKey} className="mb-3 rounded-2xl border border-amber-200 bg-amber-50 p-3"><div className="mb-3 flex flex-wrap items-center justify-between gap-2"><div><span className="font-black text-amber-950">{candidate.merchant}</span><span className="ml-2 text-[10px] text-amber-700">{candidate.dayGap} day gap · {candidate.crossSource ? "cross-source" : "same-source"}</span></div>{canManageCategories ? <Button size="sm" variant="outline" className="h-7 bg-white px-2 text-[10px]" disabled={duplicateAction.isPending || resolutionQuery.isError} onClick={() => duplicateAction.mutate({ candidate, action: "keep" })}><CheckCircle2 className="mr-1 h-3 w-3" />Keep Both / Not Duplicate</Button> : null}</div><div className="grid gap-3 lg:grid-cols-2">{renderExpenseSide(candidate, "left")}{renderExpenseSide(candidate, "right")}</div></div>)}</div></div>

      <div className="mt-5 grid gap-4 xl:grid-cols-2">
        <div className="rounded-2xl border border-slate-200 p-4"><div className="flex items-center gap-2"><WandSparkles className="h-4 w-4 text-blue-600" /><h3 className="text-sm font-black">Suggested Rules</h3></div><p className="mt-1 text-[11px] text-slate-500">Suggestions are evidence, not permanent rules. Create a rule to make the supplier/category relationship automatic.</p><div className="mt-3 max-h-80 overflow-auto">{suggestions.length === 0 ? <div className="rounded-xl bg-slate-50 p-3 text-xs font-bold text-slate-600">No unambiguous category suggestions in this period.</div> : suggestions.slice(0, 50).map((suggestion) => { const row = businessExpenses.find((item) => String(item?.id || "") === suggestion.id); const supplier = String(row?.supplier || merchantKey(row)); return <div key={suggestion.id} className="mb-2 rounded-xl border border-blue-100 bg-blue-50 p-3 text-xs"><div className="flex flex-wrap items-start justify-between gap-2"><div><span className="font-black text-blue-950">{supplier || suggestion.id}</span><div className="mt-1 text-[11px] text-blue-700">{suggestion.reason}</div></div><div className="flex items-center gap-2"><span className="rounded-full bg-white px-2 py-1 text-[10px] font-black text-blue-700">{suggestion.category}</span>{canManageCategories && suggestion.confidence === "repeat" && supplier ? <Button size="sm" className="h-7 bg-blue-700 px-2 text-[10px] text-white hover:bg-blue-800" disabled={createRule.isPending} onClick={() => createRule.mutate({ supplier, category: suggestion.category })}><Plus className="mr-1 h-3 w-3" />Create Rule</Button> : null}</div></div></div>; })}</div></div>

        <div className="rounded-2xl border border-slate-200 p-4"><div className="flex items-center justify-between gap-3"><div><h3 className="text-sm font-black">Expense Category Rules</h3><p className="mt-1 text-[11px] text-slate-500">Approved supplier rules. Exact normalized supplier matching is used first; description matching is only a fallback when supplier is blank.</p></div><span className="rounded-full bg-slate-100 px-2 py-1 text-[10px] font-black">{vendorRules.length} rules</span></div>{canManageCategories ? <div className="mt-3 grid gap-2 sm:grid-cols-[1fr_180px_auto]"><Input value={newRuleSupplier} onChange={(event) => setNewRuleSupplier(event.target.value)} placeholder="Supplier, e.g. MAKRO 2" className="h-9" /><select value={newRuleCategory} onChange={(event) => setNewRuleCategory(event.target.value)} className="h-9 rounded-md border border-slate-200 bg-white px-2 text-xs font-semibold">{RULE_CATEGORIES.map((category) => <option key={category}>{category}</option>)}</select><Button size="sm" className="h-9 bg-slate-950 text-white" disabled={newRuleSupplier.trim().length < 2 || createRule.isPending} onClick={() => createRule.mutate({ supplier: newRuleSupplier, category: newRuleCategory })}><Plus className="mr-1 h-3.5 w-3.5" />Add Rule</Button></div> : null}<div className="mt-3 max-h-80 overflow-auto">{vendorRules.length === 0 ? <div className="rounded-xl bg-slate-50 p-3 text-xs text-slate-500">No saved category rules yet.</div> : vendorRules.map((rule) => { const matchCount = businessExpenses.filter((row) => ruleMatchesRow(rule, row)).length; const editing = editingRuleId === rule.id; return <div key={rule.id} className="mb-2 rounded-xl border border-slate-200 p-3 text-xs">{editing ? <div className="grid gap-2"><Input value={editingRuleSupplier} onChange={(event) => setEditingRuleSupplier(event.target.value)} className="h-8" /><select value={editingRuleCategory} onChange={(event) => setEditingRuleCategory(event.target.value)} className="h-8 rounded-md border border-slate-200 bg-white px-2 text-xs">{RULE_CATEGORIES.map((category) => <option key={category}>{category}</option>)}</select><div className="flex gap-2"><Button size="sm" className="h-7" disabled={editingRuleSupplier.trim().length < 2 || updateRule.isPending} onClick={() => updateRule.mutate({ id: rule.id, supplier: editingRuleSupplier, category: editingRuleCategory })}>Save</Button><Button size="sm" variant="outline" className="h-7" onClick={() => setEditingRuleId(null)}><X className="mr-1 h-3 w-3" />Cancel</Button></div></div> : <div className="flex flex-wrap items-center justify-between gap-2"><div><span className="font-black text-slate-950">{rule.supplier || rule.matchText}</span><span className="mx-2 text-slate-300">→</span><span className="font-bold text-blue-700">{rule.category}</span><div className="mt-1 text-[10px] text-slate-400">{matchCount} match{matchCount === 1 ? "" : "es"} in selected period</div></div>{canManageCategories ? <div className="flex flex-wrap gap-1"><Button size="sm" variant="outline" className="h-7 px-2 text-[10px]" disabled={!matchCount || applyRule.isPending} onClick={() => window.confirm(`Apply ${rule.supplier || rule.matchText} → ${rule.category} to ${matchCount} matching expense${matchCount === 1 ? "" : "s"} in this period?`) && applyRule.mutate(rule)}>Apply Existing</Button><Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => { setEditingRuleId(rule.id); setEditingRuleSupplier(rule.supplier || rule.matchText); setEditingRuleCategory(rule.category); }} aria-label="Edit rule"><Pencil className="h-3.5 w-3.5" /></Button><Button size="icon" variant="ghost" className="h-7 w-7 text-red-600" disabled={deleteRule.isPending} onClick={() => window.confirm(`Delete category rule for ${rule.supplier || rule.matchText}? Future expenses will no longer auto-match this rule.`) && deleteRule.mutate(rule.id)} aria-label="Delete rule"><Trash2 className="h-3.5 w-3.5" /></Button></div> : null}</div>}</div>; })}</div></div>
      </div>
      {overview ? <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 p-4 text-xs text-slate-600"><strong>Accounting guardrail:</strong> {overview.costing.fullyCosted ? "COGS is fully costed for this range." : `COGS is incomplete (${overview.costing.coveragePct == null ? "unknown" : `${overview.costing.coveragePct.toFixed(1)}%`} coverage).`} {hasFoodPurchaseOverlap ? " Operating profit is withheld because recorded food/packaging purchases overlap with recipe-based COGS and subtracting both could double count costs." : canShowOperatingResult ? ` Indicative operating result before tax/owner adjustments: ${signedMoney(operatingResult)}` : " Derived operating profit is withheld until costing coverage is complete."}</div> : null}
    </section>
  );
}
