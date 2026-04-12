import { useMemo, useState } from "react";
import * as XLSX from "xlsx";
import { parse, isValid, format } from "date-fns";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const RECON_START = new Date(2026, 2, 1, 0, 0, 0, 0);
const RECON_END = new Date(2026, 2, 31, 23, 59, 59, 999);

type Status =
  | "MATCHED"
  | "MISSING_IN_GRAB"
  | "MISSING_IN_LOYVERSE"
  | "TIME_MISMATCH"
  | "DUPLICATE_CONFLICT";

type NormalizedOrder = {
  timestamp: Date;
  amountCents: number;
  rawId: string;
  source: "GRAB" | "LOYVERSE";
};

type ParseResult = {
  orders: NormalizedOrder[];
  invalidRowsSkipped: number;
};

type ReconciliationRow = {
  status: Status;
  amountCents: number | null;
  grabTime: Date | null;
  grabOrderId: string | null;
  loyverseTime: Date | null;
  loyverseReceipt: string | null;
  timeDifferenceMins: number | null;
  notes: string;
};

type Summary = {
  grabOrders: number;
  loyverseOrders: number;
  matchedOrders: number;
  missingInGrab: number;
  missingInLoyverse: number;
  timeMismatches: number;
  duplicateConflicts: number;
  invalidGrabRowsSkipped: number;
  invalidLoyverseRowsSkipped: number;
  matchRatePct: number;
};

function parseAmountToCents(value: unknown): number | null {
  if (value === null || value === undefined) return null;
  const normalized = String(value).replace(/,/g, "").replace(/[^0-9.-]/g, "").trim();
  if (!normalized) return null;
  const parsed = Number.parseFloat(normalized);
  if (!Number.isFinite(parsed)) return null;
  return Math.round(parsed * 100);
}

function parseDateValue(raw: unknown): Date | null {
  if (raw instanceof Date && isValid(raw)) return raw;

  if (typeof raw === "number") {
    const parsed = XLSX.SSF.parse_date_code(raw);
    if (!parsed) return null;
    return new Date(parsed.y, parsed.m - 1, parsed.d, parsed.H, parsed.M, parsed.S || 0);
  }

  const value = String(raw ?? "").trim();
  if (!value) return null;

  const formats = [
    "dd MMM yyyy h:mm a",
    "d MMM yyyy h:mm a",
    "dd/MM/yyyy HH:mm",
    "d/M/yyyy HH:mm",
    "dd/MM/yyyy H:mm",
    "d/M/yyyy H:mm",
    "dd/MM/yyyy h:mm a",
    "d/M/yyyy h:mm a",
    "yyyy-MM-dd HH:mm:ss",
    "yyyy-MM-dd'T'HH:mm:ss",
    "yyyy-MM-dd'T'HH:mm:ss.SSSX",
  ];

  for (const fmt of formats) {
    const parsed = parse(value, fmt, new Date());
    if (isValid(parsed)) return parsed;
  }

  const fallback = new Date(value);
  return isValid(fallback) ? fallback : null;
}

function inMarch2026(date: Date): boolean {
  return date >= RECON_START && date <= RECON_END;
}

function readSheetRows(file: File): Promise<Record<string, unknown>[]> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const data = reader.result;
        const workbook = XLSX.read(data, { type: "array" });
        const firstSheet = workbook.SheetNames[0];
        if (!firstSheet) {
          resolve([]);
          return;
        }
        const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(workbook.Sheets[firstSheet], {
          defval: "",
          raw: true,
        });
        resolve(rows);
      } catch (error) {
        reject(error);
      }
    };
    reader.onerror = () => reject(reader.error);
    reader.readAsArrayBuffer(file);
  });
}

export function parseGrabRows(rows: Record<string, unknown>[]): ParseResult {
  const orders: NormalizedOrder[] = [];
  let invalidRowsSkipped = 0;

  for (const row of rows) {
    const timestamp = parseDateValue(row["Created On"]);
    const amountCents = parseAmountToCents(row["Net Sales"]);
    const rawId = String(row["Short Order ID"] ?? "").trim();

    if (!timestamp || amountCents === null || !rawId || !inMarch2026(timestamp)) {
      invalidRowsSkipped += 1;
      continue;
    }

    orders.push({
      timestamp,
      amountCents,
      rawId,
      source: "GRAB",
    });
  }

  return { orders, invalidRowsSkipped };
}

export function parseLoyverseRows(rows: Record<string, unknown>[]): ParseResult {
  const orders: NormalizedOrder[] = [];
  let invalidRowsSkipped = 0;

  for (const row of rows) {
    const timestamp = parseDateValue(row["Date"]);
    const amountCents = parseAmountToCents(row["Net sales"]);
    const rawId = String(row["Receipt number"] ?? "").trim();

    if (!timestamp || amountCents === null || !rawId || !inMarch2026(timestamp)) {
      invalidRowsSkipped += 1;
      continue;
    }

    orders.push({
      timestamp,
      amountCents,
      rawId,
      source: "LOYVERSE",
    });
  }

  return { orders, invalidRowsSkipped };
}

function centsToMoney(cents: number | null): string {
  if (cents === null) return "-";
  return (cents / 100).toFixed(2);
}

function formatDateTime(date: Date | null): string {
  if (!date) return "-";
  return format(date, "yyyy-MM-dd HH:mm");
}

function getStatusLabel(status: Status): string {
  switch (status) {
    case "MATCHED":
      return "Matched";
    case "MISSING_IN_GRAB":
      return "Missing in Grab";
    case "MISSING_IN_LOYVERSE":
      return "Missing in Loyverse";
    case "TIME_MISMATCH":
      return "Time Mismatch";
    case "DUPLICATE_CONFLICT":
      return "Duplicate Conflict";
    default:
      return status;
  }
}

export function buildReconciliation(
  grabOrders: NormalizedOrder[],
  loyverseOrders: NormalizedOrder[],
  toleranceMinutes: number,
  invalidGrabRowsSkipped: number,
  invalidLoyverseRowsSkipped: number,
): { rows: ReconciliationRow[]; summary: Summary } {
  const rows: ReconciliationRow[] = [];
  const matchedLoyverse = new Set<number>();

  grabOrders.forEach((grabOrder) => {
    const sameAmountCandidates = loyverseOrders
      .map((order, idx) => ({ order, idx }))
      .filter(({ order, idx }) => !matchedLoyverse.has(idx) && order.amountCents === grabOrder.amountCents);

    const withinTolerance = sameAmountCandidates.filter(({ order }) => {
      const diffMins = Math.abs(order.timestamp.getTime() - grabOrder.timestamp.getTime()) / 60000;
      return diffMins <= toleranceMinutes;
    });

    if (withinTolerance.length === 1) {
      const match = withinTolerance[0];
      const diff = Math.abs(match.order.timestamp.getTime() - grabOrder.timestamp.getTime()) / 60000;
      matchedLoyverse.add(match.idx);
      rows.push({
        status: "MATCHED",
        amountCents: grabOrder.amountCents,
        grabTime: grabOrder.timestamp,
        grabOrderId: grabOrder.rawId,
        loyverseTime: match.order.timestamp,
        loyverseReceipt: match.order.rawId,
        timeDifferenceMins: Number(diff.toFixed(2)),
        notes: "Exact amount and within selected tolerance.",
      });
      return;
    }

    if (withinTolerance.length > 1) {
      rows.push({
        status: "DUPLICATE_CONFLICT",
        amountCents: grabOrder.amountCents,
        grabTime: grabOrder.timestamp,
        grabOrderId: grabOrder.rawId,
        loyverseTime: null,
        loyverseReceipt: null,
        timeDifferenceMins: null,
        notes: `Multiple unmatched Loyverse candidates (${withinTolerance.length}) within tolerance.`,
      });
      return;
    }

    if (sameAmountCandidates.length > 0) {
      const closest = sameAmountCandidates
        .map(({ order }) => Math.abs(order.timestamp.getTime() - grabOrder.timestamp.getTime()) / 60000)
        .sort((a, b) => a - b)[0];

      rows.push({
        status: "TIME_MISMATCH",
        amountCents: grabOrder.amountCents,
        grabTime: grabOrder.timestamp,
        grabOrderId: grabOrder.rawId,
        loyverseTime: null,
        loyverseReceipt: null,
        timeDifferenceMins: Number(closest.toFixed(2)),
        notes: "Exact amount exists, but all unmatched candidates are outside tolerance.",
      });
      return;
    }

    rows.push({
      status: "MISSING_IN_LOYVERSE",
      amountCents: grabOrder.amountCents,
      grabTime: grabOrder.timestamp,
      grabOrderId: grabOrder.rawId,
      loyverseTime: null,
      loyverseReceipt: null,
      timeDifferenceMins: null,
      notes: "No unmatched Loyverse order with exact amount.",
    });
  });

  loyverseOrders.forEach((loyverseOrder, idx) => {
    if (matchedLoyverse.has(idx)) return;
    rows.push({
      status: "MISSING_IN_GRAB",
      amountCents: loyverseOrder.amountCents,
      grabTime: null,
      grabOrderId: null,
      loyverseTime: loyverseOrder.timestamp,
      loyverseReceipt: loyverseOrder.rawId,
      timeDifferenceMins: null,
      notes: "Unmatched Loyverse receipt after strict Grab pass.",
    });
  });

  const summary: Summary = {
    grabOrders: grabOrders.length,
    loyverseOrders: loyverseOrders.length,
    matchedOrders: rows.filter((row) => row.status === "MATCHED").length,
    missingInGrab: rows.filter((row) => row.status === "MISSING_IN_GRAB").length,
    missingInLoyverse: rows.filter((row) => row.status === "MISSING_IN_LOYVERSE").length,
    timeMismatches: rows.filter((row) => row.status === "TIME_MISMATCH").length,
    duplicateConflicts: rows.filter((row) => row.status === "DUPLICATE_CONFLICT").length,
    invalidGrabRowsSkipped,
    invalidLoyverseRowsSkipped,
    matchRatePct: grabOrders.length === 0 ? 0 : Number(((rows.filter((row) => row.status === "MATCHED").length / grabOrders.length) * 100).toFixed(2)),
  };

  return { rows, summary };
}

const ALL_FILTERS = [
  "All",
  "Matched",
  "Missing in Grab",
  "Missing in Loyverse",
  "Time Mismatch",
  "Duplicate Conflict",
] as const;

type FilterOption = (typeof ALL_FILTERS)[number];

const FILTER_TO_STATUS: Record<Exclude<FilterOption, "All">, Status> = {
  Matched: "MATCHED",
  "Missing in Grab": "MISSING_IN_GRAB",
  "Missing in Loyverse": "MISSING_IN_LOYVERSE",
  "Time Mismatch": "TIME_MISMATCH",
  "Duplicate Conflict": "DUPLICATE_CONFLICT",
};

export default function GrabLoyverseMonthlyReconciliation() {
  const [grabFile, setGrabFile] = useState<File | null>(null);
  const [loyverseFile, setLoyverseFile] = useState<File | null>(null);
  const [toleranceMinutes, setToleranceMinutes] = useState<5 | 10 | 15>(10);
  const [rows, setRows] = useState<ReconciliationRow[]>([]);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [filter, setFilter] = useState<FilterOption>("All");
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const filteredRows = useMemo(() => {
    if (filter === "All") return rows;
    return rows.filter((row) => row.status === FILTER_TO_STATUS[filter]);
  }, [rows, filter]);

  const runComparison = async () => {
    setError(null);
    if (!grabFile || !loyverseFile) {
      setError("Upload both Grab and Loyverse files before running comparison.");
      return;
    }

    setRunning(true);
    try {
      const [grabRawRows, loyverseRawRows] = await Promise.all([readSheetRows(grabFile), readSheetRows(loyverseFile)]);

      const grabParsed = parseGrabRows(grabRawRows);
      const loyverseParsed = parseLoyverseRows(loyverseRawRows);
      const result = buildReconciliation(
        grabParsed.orders,
        loyverseParsed.orders,
        toleranceMinutes,
        grabParsed.invalidRowsSkipped,
        loyverseParsed.invalidRowsSkipped,
      );

      setRows(result.rows);
      setSummary(result.summary);
    } catch (runError) {
      setError(runError instanceof Error ? runError.message : "Failed to run strict reconciliation.");
    } finally {
      setRunning(false);
    }
  };

  return (
    <div className="p-6 space-y-6" data-testid="grab-loyverse-monthly-reconciliation">
      <div>
        <h1 className="text-2xl font-semibold">Grab vs Loyverse Monthly Reconciliation</h1>
        <p className="text-sm text-gray-600">
          Strict amount + timestamp reconciliation for 1 March 2026 to 31 March 2026. Multi-ID Grab rows stay as one single order.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Inputs</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="grab-file">Grab file (Created On, Short Order ID, Net Sales)</Label>
              <Input
                id="grab-file"
                type="file"
                accept=".csv,.xlsx,.xls"
                onChange={(event) => setGrabFile(event.target.files?.[0] || null)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="loyverse-file">Loyverse file (Date, Receipt number, Net sales)</Label>
              <Input
                id="loyverse-file"
                type="file"
                accept=".csv,.xlsx,.xls"
                onChange={(event) => setLoyverseFile(event.target.files?.[0] || null)}
              />
            </div>
          </div>

          <div className="flex flex-wrap gap-4 items-end">
            <div className="space-y-2">
              <Label htmlFor="tolerance">Tolerance (minutes)</Label>
              <select
                id="tolerance"
                className="h-9 border rounded-[4px] px-3 text-xs"
                value={toleranceMinutes}
                onChange={(event) => setToleranceMinutes(Number(event.target.value) as 5 | 10 | 15)}
              >
                <option value={5}>5</option>
                <option value={10}>10</option>
                <option value={15}>15</option>
              </select>
            </div>

            <Button onClick={runComparison} disabled={running}>
              {running ? "Running..." : "Run Comparison"}
            </Button>
          </div>

          {error ? <p className="text-sm text-red-600">{error}</p> : null}
        </CardContent>
      </Card>

      {summary ? (
        <Card>
          <CardHeader>
            <CardTitle>Summary</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 text-sm">
              <div>Grab Orders: {summary.grabOrders}</div>
              <div>Loyverse Orders: {summary.loyverseOrders}</div>
              <div>Matched Orders: {summary.matchedOrders}</div>
              <div>Missing in Grab: {summary.missingInGrab}</div>
              <div>Missing in Loyverse: {summary.missingInLoyverse}</div>
              <div>Time Mismatches: {summary.timeMismatches}</div>
              <div>Duplicate Conflicts: {summary.duplicateConflicts}</div>
              <div>Invalid Grab Rows Skipped: {summary.invalidGrabRowsSkipped}</div>
              <div>Invalid Loyverse Rows Skipped: {summary.invalidLoyverseRowsSkipped}</div>
              <div>Match Rate %: {summary.matchRatePct.toFixed(2)}</div>
            </div>
          </CardContent>
        </Card>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle>Results</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="status-filter">Filter</Label>
            <select
              id="status-filter"
              className="h-9 border rounded-[4px] px-3 text-xs"
              value={filter}
              onChange={(event) => setFilter(event.target.value as FilterOption)}
            >
              {ALL_FILTERS.map((entry) => (
                <option key={entry} value={entry}>
                  {entry}
                </option>
              ))}
            </select>
          </div>

          <div className="overflow-auto border rounded">
            <table className="w-full text-sm">
              <thead className="bg-gray-100">
                <tr>
                  <th className="text-left p-2">Status</th>
                  <th className="text-left p-2">Amount</th>
                  <th className="text-left p-2">Grab Time</th>
                  <th className="text-left p-2">Grab Order ID(s)</th>
                  <th className="text-left p-2">Loyverse Time</th>
                  <th className="text-left p-2">Loyverse Receipt #</th>
                  <th className="text-left p-2">Time Difference (mins)</th>
                  <th className="text-left p-2">Notes</th>
                </tr>
              </thead>
              <tbody>
                {filteredRows.length === 0 ? (
                  <tr>
                    <td className="p-2" colSpan={8}>No rows to display.</td>
                  </tr>
                ) : (
                  filteredRows.map((row, idx) => (
                    <tr key={`${row.status}-${idx}`} className="border-t">
                      <td className="p-2">{getStatusLabel(row.status)}</td>
                      <td className="p-2">{centsToMoney(row.amountCents)}</td>
                      <td className="p-2">{formatDateTime(row.grabTime)}</td>
                      <td className="p-2">{row.grabOrderId || "-"}</td>
                      <td className="p-2">{formatDateTime(row.loyverseTime)}</td>
                      <td className="p-2">{row.loyverseReceipt || "-"}</td>
                      <td className="p-2">{row.timeDifferenceMins === null ? "-" : row.timeDifferenceMins.toFixed(2)}</td>
                      <td className="p-2">{row.notes}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
