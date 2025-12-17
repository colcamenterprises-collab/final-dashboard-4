import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Loader2 } from "lucide-react";

interface PurchaseSummary {
  period: string;
  item: string;
  totalCost: number;
  count: number;
}

export default function PurchaseHistory() {
  const [period, setPeriod] = useState<"daily" | "weekly" | "monthly">("daily");

  const { data, isLoading, error } = useQuery<{ ok: boolean; period: string; summary: PurchaseSummary[] }>({
    queryKey: ["/api/purchases/summary", period],
    queryFn: async () => {
      const res = await fetch(`/api/purchases/summary?period=${period}`);
      return res.json();
    },
  });

  const formatPeriod = (dateStr: string) => {
    if (!dateStr) return "-";
    try {
      const d = new Date(dateStr);
      if (period === "monthly") {
        return d.toLocaleDateString("en-GB", { month: "long", year: "numeric" });
      }
      if (period === "weekly") {
        return `Week of ${d.toLocaleDateString("en-GB")}`;
      }
      return d.toLocaleDateString("en-GB");
    } catch {
      return dateStr;
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-slate-400" />
      </div>
    );
  }

  if (error) {
    return (
      <Card className="m-4">
        <CardContent className="p-6">
          <p className="text-red-600">Failed to load purchase history</p>
        </CardContent>
      </Card>
    );
  }

  const summary = data?.summary || [];

  const groupedByPeriod = summary.reduce((acc, item) => {
    const key = formatPeriod(item.period);
    if (!acc[key]) acc[key] = [];
    acc[key].push(item);
    return acc;
  }, {} as Record<string, PurchaseSummary[]>);

  return (
    <div className="p-4 space-y-4">
      <Card>
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-xl">Purchase History</CardTitle>
              <p className="text-xs text-slate-500">Aggregated purchase data (read-only)</p>
            </div>
            <Tabs value={period} onValueChange={(v) => setPeriod(v as typeof period)}>
              <TabsList>
                <TabsTrigger value="daily" className="text-xs" data-testid="tab-daily">Daily</TabsTrigger>
                <TabsTrigger value="weekly" className="text-xs" data-testid="tab-weekly">Weekly</TabsTrigger>
                <TabsTrigger value="monthly" className="text-xs" data-testid="tab-monthly">Monthly</TabsTrigger>
              </TabsList>
            </Tabs>
          </div>
        </CardHeader>
        <CardContent>
          {Object.keys(groupedByPeriod).length === 0 ? (
            <div className="text-center text-xs text-slate-400 py-8">
              No purchase data found
            </div>
          ) : (
            <div className="space-y-4">
              {Object.entries(groupedByPeriod).map(([periodLabel, items]) => (
                <div key={periodLabel} className="rounded border border-slate-200 overflow-hidden">
                  <div className="bg-slate-50 px-3 py-2 border-b border-slate-200">
                    <span className="text-xs font-medium text-slate-700">{periodLabel}</span>
                  </div>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="text-xs font-medium">Item</TableHead>
                        <TableHead className="text-xs font-medium text-right">Count</TableHead>
                        <TableHead className="text-xs font-medium text-right">Total Cost</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {items.map((item, idx) => (
                        <TableRow key={idx} data-testid={`purchase-row-${idx}`}>
                          <TableCell className="text-xs">{item.item}</TableCell>
                          <TableCell className="text-xs text-right">{item.count}</TableCell>
                          <TableCell className="text-xs text-right font-medium">
                            ฿{item.totalCost.toLocaleString()}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
