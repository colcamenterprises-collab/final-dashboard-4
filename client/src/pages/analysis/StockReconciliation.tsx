import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Package, Beef, GlassWater, ClipboardList } from "lucide-react";

type CategoryFilter = "all" | "buns" | "meat" | "drinks" | "other";

interface ReconciliationRow {
  shift_date: string;
  item_type: string;
  item_name: string;
  start_qty: number;
  purchased_qty: number;
  number_sold_qty: number;
  expected_end_qty: number;
  actual_end_qty: number;
  variance: number;
}

interface PurchaseLogRow {
  id: number;
  shift_date: string;
  item_type: string;
  item_name: string;
  qty: number;
  weight_g: number | null;
  source: string;
  paid: boolean;
  logged_at: string;
}

function normalizeItemType(itemType: string): CategoryFilter {
  if (itemType === "buns" || itemType === "meat" || itemType === "drinks") return itemType as CategoryFilter;
  return "other";
}

function getStatus(row: ReconciliationRow): "OK" | "Warning" | "Critical" {
  const absVariance = Math.abs(row.variance);
  if (row.variance === 0) return "OK";
  if (normalizeItemType(row.item_type) === "meat") {
    return absVariance >= 500 ? "Critical" : "Warning";
  }
  return absVariance >= 3 ? "Critical" : "Warning";
}

function formatQty(row: ReconciliationRow, value: number): string {
  if (normalizeItemType(row.item_type) === "meat") return `${Math.round(value)} g`;
  return `${Math.round(value)}`;
}

function formatPurchaseQty(row: PurchaseLogRow): string {
  if (row.item_type === "meat" && row.weight_g) {
    const kg = (row.weight_g / 1000).toFixed(2);
    return `${kg} kg`;
  }
  return `${row.qty}`;
}

function formatLoggedAt(ts: string): string {
  try {
    const d = new Date(ts);
    return d.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
  } catch {
    return ts;
  }
}

const TYPE_CONFIG: Record<string, { label: string; icon: React.ReactNode; color: string }> = {
  rolls:  { label: "Rolls",  icon: <Package className="h-3 w-3" />,    color: "bg-amber-100/60 text-amber-800" },
  meat:   { label: "Meat",   icon: <Beef className="h-3 w-3" />,       color: "bg-red-100/60 text-red-800" },
  drinks: { label: "Drinks", icon: <GlassWater className="h-3 w-3" />, color: "bg-blue-100/60 text-blue-800" },
};

export default function StockReconciliation() {
  const { data, isLoading, error } = useQuery<{ ok: boolean; data: ReconciliationRow[] }>({
    queryKey: ["/api/analysis/stock-reconciliation"],
  });

  const allRows = data?.data || [];

  const shiftDates = useMemo(
    () =>
      Array.from(new Set(allRows.map((row) => row.shift_date)))
        .filter((d): d is string => !!d)
        .sort((a, b) => b.localeCompare(a)),
    [allRows],
  );

  const [selectedShift, setSelectedShift] = useState<string>("");
  const [categoryFilter, setCategoryFilter] = useState<CategoryFilter>("all");
  const [showIssuesOnly, setShowIssuesOnly] = useState(true);

  const effectiveShift = selectedShift || shiftDates[0] || "";

  const filteredRows = useMemo(() => {
    let rows = allRows;
    if (effectiveShift) rows = rows.filter((row) => row.shift_date === effectiveShift);
    if (categoryFilter !== "all") rows = rows.filter((row) => normalizeItemType(row.item_type) === categoryFilter);
    if (showIssuesOnly) rows = rows.filter((row) => row.variance !== 0);
    return rows;
  }, [allRows, effectiveShift, categoryFilter, showIssuesOnly]);

  const shiftRows = useMemo(() => {
    if (!effectiveShift) return [];
    return allRows.filter((row) => row.shift_date === effectiveShift);
  }, [allRows, effectiveShift]);

  const varianceItems = shiftRows.filter((row) => row.variance !== 0).length;
  const criticalItems = shiftRows.filter((row) => getStatus(row) === "Critical").length;
  const overallStatus = criticalItems > 0 ? "Critical" : varianceItems > 0 ? "Warning" : "OK";

  // Purchase log from stock_received_log (what the modal writes)
  const purchaseLogParams = effectiveShift
    ? `date=${effectiveShift}`
    : "days=7";

  const { data: purchaseLogData, isLoading: purchaseLogLoading } = useQuery<{ ok: boolean; rows: PurchaseLogRow[] }>({
    queryKey: [`/api/stock/purchases-log`, effectiveShift],
    queryFn: () => fetch(`/api/stock/purchases-log?${purchaseLogParams}`).then((r) => r.json()),
  });

  const purchaseRows = purchaseLogData?.rows || [];

  // Group purchase rows by type for subtotals
  const purchaseTotals = useMemo(() => {
    const totals: Record<string, { qty: number; weightG: number }> = {};
    for (const row of purchaseRows) {
      if (!totals[row.item_type]) totals[row.item_type] = { qty: 0, weightG: 0 };
      totals[row.item_type].qty += row.qty;
      totals[row.item_type].weightG += row.weight_g ?? 0;
    }
    return totals;
  }, [purchaseRows]);

  if (error) {
    return (
      <div className="p-4">
        <Card>
          <CardContent className="p-4 text-red-600 text-xs">Failed to load stock reconciliation data.</CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="admin-page p-4 space-y-4" data-testid="page-stock-reconciliation">
      <h1 className="text-xl font-bold text-slate-900" data-testid="heading-stock-reconciliation">
        Stock Reconciliation
      </h1>

      {/* Filters */}
      <Card>
        <CardContent className="p-3">
          <div className="grid grid-cols-3 gap-3">
            <div>
              <p className="text-xs text-slate-500 mb-1">Shift</p>
              {isLoading ? (
                <Skeleton className="h-8 w-full" />
              ) : (
                <Select value={effectiveShift} onValueChange={setSelectedShift}>
                  <SelectTrigger className="h-8 text-xs rounded" data-testid="select-shift-reconciliation">
                    <SelectValue placeholder="Select shift" />
                  </SelectTrigger>
                  <SelectContent>
                    {shiftDates.map((shiftDate) => (
                      <SelectItem key={shiftDate} value={shiftDate} className="text-xs">
                        {shiftDate}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>

            <div>
              <p className="text-xs text-slate-500 mb-1">Category</p>
              <Select value={categoryFilter} onValueChange={(value) => setCategoryFilter(value as CategoryFilter)}>
                <SelectTrigger className="h-8 text-xs rounded" data-testid="select-category-reconciliation">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all" className="text-xs">All</SelectItem>
                  <SelectItem value="buns" className="text-xs">Buns</SelectItem>
                  <SelectItem value="meat" className="text-xs">Meat</SelectItem>
                  <SelectItem value="drinks" className="text-xs">Drinks</SelectItem>
                  <SelectItem value="other" className="text-xs">Other</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <p className="text-xs text-slate-500 mb-1">Rows</p>
              <div className="flex gap-1">
                <Button
                  size="sm"
                  variant={showIssuesOnly ? "default" : "outline"}
                  onClick={() => setShowIssuesOnly(true)}
                  className="text-xs h-8 rounded px-2"
                  data-testid="toggle-issues-only"
                >
                  Issues
                </Button>
                <Button
                  size="sm"
                  variant={!showIssuesOnly ? "default" : "outline"}
                  onClick={() => setShowIssuesOnly(false)}
                  className="text-xs h-8 rounded px-2"
                  data-testid="toggle-show-all"
                >
                  All
                </Button>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Summary metrics */}
      <div className="grid grid-cols-3 gap-3">
        <Card>
          <CardContent className="p-3">
            <p className="text-xs text-slate-500">Items with Variance</p>
            <p className="text-sm font-bold text-slate-900" data-testid="metric-variance-items">
              {isLoading ? <Skeleton className="h-5 w-8" /> : varianceItems}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-3">
            <p className="text-xs text-slate-500">Critical Issues</p>
            <p className="text-sm font-bold text-slate-900" data-testid="metric-critical-items">
              {isLoading ? <Skeleton className="h-5 w-8" /> : criticalItems}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-3">
            <p className="text-xs text-slate-500">Overall Status</p>
            <p className={`text-sm font-bold ${overallStatus === "Critical" ? "text-red-600" : overallStatus === "Warning" ? "text-amber-600" : "text-emerald-600"}`} data-testid="metric-overall-status">
              {isLoading ? <Skeleton className="h-5 w-12" /> : overallStatus}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Reconciliation table */}
      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-4 space-y-2">
              {[1, 2, 3, 4].map((i) => (
                <Skeleton key={i} className="h-8 w-full" />
              ))}
            </div>
          ) : filteredRows.length === 0 ? (
            <div className="p-6 text-center text-slate-500 text-xs">No rows for current filters.</div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="text-xs">Item</TableHead>
                    <TableHead className="text-xs text-right">Start</TableHead>
                    <TableHead className="text-xs text-right">Purchased</TableHead>
                    <TableHead className="text-xs text-right">Sold</TableHead>
                    <TableHead className="text-xs text-right">Expected End</TableHead>
                    <TableHead className="text-xs text-right">Actual End</TableHead>
                    <TableHead className="text-xs text-right">Variance</TableHead>
                    <TableHead className="text-xs">Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredRows.map((row, index) => {
                    const status = getStatus(row);
                    return (
                      <TableRow
                        key={`${row.shift_date}-${row.item_name}-${index}`}
                        data-testid={`row-reconciliation-${index}`}
                        className={
                          status === "Critical"
                            ? "bg-red-100/40"
                            : status === "Warning"
                            ? "bg-amber-100/40"
                            : ""
                        }
                      >
                        <TableCell className="text-xs font-medium whitespace-nowrap">{row.item_name}</TableCell>
                        <TableCell className="text-xs text-right whitespace-nowrap">{formatQty(row, row.start_qty)}</TableCell>
                        <TableCell className="text-xs text-right whitespace-nowrap">{formatQty(row, row.purchased_qty)}</TableCell>
                        <TableCell className="text-xs text-right whitespace-nowrap">{formatQty(row, row.number_sold_qty)}</TableCell>
                        <TableCell className="text-xs text-right whitespace-nowrap">{formatQty(row, row.expected_end_qty)}</TableCell>
                        <TableCell className="text-xs text-right whitespace-nowrap">{formatQty(row, row.actual_end_qty)}</TableCell>
                        <TableCell className="text-xs text-right whitespace-nowrap font-bold">
                          <span
                            className={
                              status === "Critical"
                                ? "text-red-600"
                                : status === "Warning"
                                ? "text-amber-600"
                                : "text-emerald-600"
                            }
                          >
                            {formatQty(row, row.variance)}
                          </span>
                        </TableCell>
                        <TableCell>
                          <Badge
                            variant={
                              status === "Critical"
                                ? "destructive"
                                : status === "Warning"
                                ? "secondary"
                                : "outline"
                            }
                            className="text-xs"
                          >
                            {status}
                          </Badge>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* ── PURCHASE LOG (from stock_received_log / modal entries) ── */}
      <Card>
        <CardHeader className="p-3 pb-0">
          <div className="flex items-center gap-2">
            <ClipboardList className="h-4 w-4 text-slate-500" />
            <span className="text-xs font-semibold text-slate-700">
              Purchase Log — Modal Entries
              {effectiveShift && (
                <span className="ml-1 text-slate-400 font-normal">({effectiveShift})</span>
              )}
            </span>
            {purchaseRows.length > 0 && (
              <span className="ml-auto text-xs text-slate-400">{purchaseRows.length} entries</span>
            )}
          </div>

          {/* Subtotals row */}
          {purchaseRows.length > 0 && (
            <div className="flex flex-wrap gap-2 mt-2 pb-2">
              {Object.entries(purchaseTotals).map(([type, totals]) => {
                const cfg = TYPE_CONFIG[type];
                const display =
                  type === "meat"
                    ? `${(totals.weightG / 1000).toFixed(2)} kg`
                    : `${totals.qty} units`;
                return (
                  <span
                    key={type}
                    className={`inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded ${cfg?.color ?? "bg-slate-100 text-slate-700"}`}
                  >
                    {cfg?.icon}
                    {cfg?.label ?? type}: {display}
                  </span>
                );
              })}
            </div>
          )}
        </CardHeader>

        <CardContent className="p-0">
          {purchaseLogLoading ? (
            <div className="p-4 space-y-2">
              {[1, 2, 3].map((i) => <Skeleton key={i} className="h-8 w-full" />)}
            </div>
          ) : purchaseRows.length === 0 ? (
            <div className="p-5 text-center text-xs text-slate-400">
              No purchases logged via modal
              {effectiveShift ? ` for ${effectiveShift}` : " in the last 7 days"}.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="text-xs">Date</TableHead>
                    <TableHead className="text-xs">Type</TableHead>
                    <TableHead className="text-xs">Item</TableHead>
                    <TableHead className="text-xs text-right">Qty / Weight</TableHead>
                    <TableHead className="text-xs">Source</TableHead>
                    <TableHead className="text-xs">Time</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {purchaseRows.map((row) => {
                    const cfg = TYPE_CONFIG[row.item_type];
                    return (
                      <TableRow key={row.id}>
                        <TableCell className="text-xs whitespace-nowrap">{row.shift_date}</TableCell>
                        <TableCell className="text-xs whitespace-nowrap">
                          <span
                            className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-xs font-medium ${cfg?.color ?? "bg-slate-100 text-slate-600"}`}
                          >
                            {cfg?.icon}
                            {cfg?.label ?? row.item_type}
                          </span>
                        </TableCell>
                        <TableCell className="text-xs font-medium whitespace-nowrap">{row.item_name}</TableCell>
                        <TableCell className="text-xs text-right whitespace-nowrap font-bold">
                          {formatPurchaseQty(row)}
                        </TableCell>
                        <TableCell className="text-xs text-slate-500 whitespace-nowrap">
                          {row.source === "stock_modal" ? "Stock Modal" : row.source}
                        </TableCell>
                        <TableCell className="text-xs text-slate-500 whitespace-nowrap">
                          {formatLoggedAt(row.logged_at)}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
