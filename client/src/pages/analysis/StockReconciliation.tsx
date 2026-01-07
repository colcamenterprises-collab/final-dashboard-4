import { useQuery } from "@tanstack/react-query";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { AlertTriangle, CheckCircle2, Shield, TrendingDown } from "lucide-react";

interface ReconciliationRow {
  shift_date: string;
  item_type: string;
  item_name: string;
  start_qty: number;
  purchased_qty: number;
  used_qty: number;
  expected_end_qty: number;
  actual_end_qty: number;
  variance: number;
}

export default function StockReconciliation() {
  const { data, isLoading, error } = useQuery<{ ok: boolean; data: ReconciliationRow[] }>({
    queryKey: ["/api/analysis/stock-reconciliation"],
  });

  const rows = data?.data || [];

  const groupedByDate = rows.reduce((acc, row) => {
    if (!acc[row.shift_date]) {
      acc[row.shift_date] = [];
    }
    acc[row.shift_date].push(row);
    return acc;
  }, {} as Record<string, ReconciliationRow[]>);

  const getVarianceStatus = (row: ReconciliationRow) => {
    const variance = row.variance;
    if (row.item_type === "meat") {
      if (Math.abs(variance) > 500) return "critical";
      if (Math.abs(variance) > 200) return "warning";
    } else {
      if (variance !== 0) return variance < -2 ? "critical" : "warning";
    }
    return "ok";
  };

  const formatVariance = (row: ReconciliationRow) => {
    const variance = row.variance;
    if (row.item_type === "meat") {
      return `${variance >= 0 ? "+" : ""}${(variance / 1000).toFixed(2)} kg`;
    }
    return `${variance >= 0 ? "+" : ""}${variance}`;
  };

  const totalIssues = rows.filter((r) => getVarianceStatus(r) !== "ok").length;

  if (error) {
    return (
      <div className="p-6">
        <Card className="border-red-200 bg-white">
          <CardContent className="p-6">
            <p className="text-red-600">Failed to load reconciliation data</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900" data-testid="heading-stock-reconciliation">
            Stock Reconciliation & Security
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Shift balancing, theft visibility, deterministic reconciliation
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Shield className="h-5 w-5 text-emerald-600" />
          <span className="text-sm font-medium text-slate-600">Security Analysis</span>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="bg-white border-slate-200">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-slate-500">Total Shifts Analyzed</p>
                <p className="text-2xl font-bold text-slate-900">
                  {isLoading ? <Skeleton className="h-8 w-12" /> : Object.keys(groupedByDate).length}
                </p>
              </div>
              <CheckCircle2 className="h-8 w-8 text-emerald-500" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-white border-slate-200">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-slate-500">Variance Issues</p>
                <p className="text-2xl font-bold text-slate-900">
                  {isLoading ? <Skeleton className="h-8 w-12" /> : totalIssues}
                </p>
              </div>
              {totalIssues > 0 ? (
                <AlertTriangle className="h-8 w-8 text-amber-500" />
              ) : (
                <CheckCircle2 className="h-8 w-8 text-emerald-500" />
              )}
            </div>
          </CardContent>
        </Card>

        <Card className="bg-white border-slate-200">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-slate-500">Items Tracked</p>
                <p className="text-2xl font-bold text-slate-900">
                  {isLoading ? <Skeleton className="h-8 w-12" /> : rows.length}
                </p>
              </div>
              <TrendingDown className="h-8 w-8 text-slate-400" />
            </div>
          </CardContent>
        </Card>
      </div>

      <Card className="bg-white border-slate-200">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium text-slate-700">Reconciliation Detail</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-2">
              {[1, 2, 3, 4, 5].map((i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          ) : rows.length === 0 ? (
            <div className="text-center py-8 text-slate-500">
              <p>No reconciliation data available</p>
              <p className="text-xs mt-1">Submit daily stock forms to see data here</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-xs">Date</TableHead>
                  <TableHead className="text-xs">Item</TableHead>
                  <TableHead className="text-xs text-right">Start</TableHead>
                  <TableHead className="text-xs text-right">Purchased</TableHead>
                  <TableHead className="text-xs text-right">Used</TableHead>
                  <TableHead className="text-xs text-right">Expected</TableHead>
                  <TableHead className="text-xs text-right">Actual</TableHead>
                  <TableHead className="text-xs text-right">Variance</TableHead>
                  <TableHead className="text-xs">Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((row, i) => {
                  const status = getVarianceStatus(row);
                  const isMeat = row.item_type === "meat";
                  return (
                    <TableRow
                      key={i}
                      className={
                        status === "critical"
                          ? "bg-red-50"
                          : status === "warning"
                          ? "bg-amber-50"
                          : ""
                      }
                      data-testid={`row-reconciliation-${i}`}
                    >
                      <TableCell className="text-xs font-medium">{row.shift_date}</TableCell>
                      <TableCell className="text-xs">{row.item_name}</TableCell>
                      <TableCell className="text-xs text-right">
                        {isMeat ? `${(row.start_qty / 1000).toFixed(1)}kg` : row.start_qty}
                      </TableCell>
                      <TableCell className="text-xs text-right">
                        {isMeat ? `${(row.purchased_qty / 1000).toFixed(1)}kg` : row.purchased_qty}
                      </TableCell>
                      <TableCell className="text-xs text-right">
                        {isMeat ? `${(row.used_qty / 1000).toFixed(1)}kg` : row.used_qty}
                      </TableCell>
                      <TableCell className="text-xs text-right">
                        {isMeat ? `${(row.expected_end_qty / 1000).toFixed(1)}kg` : row.expected_end_qty}
                      </TableCell>
                      <TableCell className="text-xs text-right">
                        {isMeat ? `${(row.actual_end_qty / 1000).toFixed(1)}kg` : row.actual_end_qty}
                      </TableCell>
                      <TableCell className="text-xs text-right font-bold">
                        <span
                          className={
                            status === "critical"
                              ? "text-red-600"
                              : status === "warning"
                              ? "text-amber-600"
                              : "text-emerald-600"
                          }
                        >
                          {formatVariance(row)}
                        </span>
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant={
                            status === "critical"
                              ? "destructive"
                              : status === "warning"
                              ? "secondary"
                              : "outline"
                          }
                          className="text-xs"
                        >
                          {status === "ok" ? "OK" : status === "warning" ? "Check" : "Alert"}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Card className="bg-white border-slate-200">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium text-slate-700">Security Rules</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
            <div className="p-3 rounded-[4px] border border-slate-200">
              <p className="font-medium text-slate-700">Rolls</p>
              <p className="text-slate-500 mt-1">Variance ≠ 0 → Flag for review</p>
            </div>
            <div className="p-3 rounded-[4px] border border-slate-200">
              <p className="font-medium text-slate-700">Meat</p>
              <p className="text-slate-500 mt-1">Variance &gt; ±0.5 kg → Flag for review</p>
            </div>
            <div className="p-3 rounded-[4px] border border-slate-200">
              <p className="font-medium text-slate-700">Drinks</p>
              <p className="text-slate-500 mt-1">Variance ≠ 0 → Flag for review</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
