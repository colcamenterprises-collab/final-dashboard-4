import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
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

function normalizeItemType(itemType: string): CategoryFilter {
  if (itemType === "buns" || itemType === "meat" || itemType === "drinks") {
    return itemType;
  }
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
  if (normalizeItemType(row.item_type) === "meat") {
    return `${Math.round(value)} g`;
  }
  return `${Math.round(value)}`;
}

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

    if (effectiveShift) {
      rows = rows.filter((row) => row.shift_date === effectiveShift);
    }

    if (categoryFilter !== "all") {
      rows = rows.filter((row) => normalizeItemType(row.item_type) === categoryFilter);
    }

    if (showIssuesOnly) {
      rows = rows.filter((row) => row.variance !== 0);
    }

    return rows;
  }, [allRows, effectiveShift, categoryFilter, showIssuesOnly]);

  const shiftRows = useMemo(() => {
    if (!effectiveShift) return [];
    return allRows.filter((row) => row.shift_date === effectiveShift);
  }, [allRows, effectiveShift]);

  const varianceItems = shiftRows.filter((row) => row.variance !== 0).length;
  const criticalItems = shiftRows.filter((row) => getStatus(row) === "Critical").length;
  const overallStatus = criticalItems > 0 ? "Critical" : varianceItems > 0 ? "Warning" : "OK";

  if (error) {
    return (
      <div className="p-4">
        <Card>
          <CardContent className="p-4 text-red-600">Failed to load stock reconciliation data.</CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="admin-page p-4 space-y-4" data-testid="page-stock-reconciliation">
      <h1 className="text-2xl md:text-3xl font-bold text-slate-900" data-testid="heading-stock-reconciliation">
        Stock Reconciliation
      </h1>

      <Card>
        <CardContent className="p-3 md:p-4">
          <div className="grid grid-cols-3 gap-3">
            <div>
              <p className="text-xs text-slate-500 mb-1">Shift</p>
              {isLoading ? (
                <Skeleton className="h-10 w-full" />
              ) : (
                <Select value={effectiveShift} onValueChange={setSelectedShift}>
                  <SelectTrigger data-testid="select-shift-reconciliation">
                    <SelectValue placeholder="Select shift" />
                  </SelectTrigger>
                  <SelectContent>
                    {shiftDates.map((shiftDate) => (
                      <SelectItem key={shiftDate} value={shiftDate}>
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
                <SelectTrigger data-testid="select-category-reconciliation">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All</SelectItem>
                  <SelectItem value="buns">Buns</SelectItem>
                  <SelectItem value="meat">Meat</SelectItem>
                  <SelectItem value="drinks">Drinks</SelectItem>
                  <SelectItem value="other">Other</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <p className="text-xs text-slate-500 mb-1">Rows</p>
              <div className="flex gap-2">
                <Button
                  size="sm"
                  variant={showIssuesOnly ? "default" : "outline"}
                  onClick={() => setShowIssuesOnly(true)}
                  data-testid="toggle-issues-only"
                >
                  Issues Only
                </Button>
                <Button
                  size="sm"
                  variant={!showIssuesOnly ? "default" : "outline"}
                  onClick={() => setShowIssuesOnly(false)}
                  data-testid="toggle-show-all"
                >
                  Show All
                </Button>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-3 gap-3">
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-slate-500">Items with Variance</p>
            <p className="text-2xl font-semibold text-slate-900" data-testid="metric-variance-items">
              {isLoading ? <Skeleton className="h-8 w-12" /> : varianceItems}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-slate-500">Critical Issues</p>
            <p className="text-2xl font-semibold text-slate-900" data-testid="metric-critical-items">
              {isLoading ? <Skeleton className="h-8 w-12" /> : criticalItems}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-slate-500">Overall Status</p>
            <p className="text-2xl font-semibold text-slate-900" data-testid="metric-overall-status">
              {isLoading ? <Skeleton className="h-8 w-12" /> : overallStatus}
            </p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-4 space-y-2">
              {[1, 2, 3, 4].map((i) => (
                <Skeleton key={i} className="h-10 w-full" />
              ))}
            </div>
          ) : filteredRows.length === 0 ? (
            <div className="p-6 text-center text-slate-500">No rows for current filters.</div>
          ) : (
            <div className="overflow-x-auto" style={{ WebkitOverflowScrolling: "touch" }}>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="text-xs">Item</TableHead>
                    <TableHead className="text-xs text-right">Opening</TableHead>
                    <TableHead className="text-xs text-right">Received</TableHead>
                    <TableHead className="text-xs text-right">Number Sold</TableHead>
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
    </div>
  );
}
