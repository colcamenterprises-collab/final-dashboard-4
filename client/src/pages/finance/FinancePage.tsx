import React, { useEffect, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";

const thb = (amount: number | undefined) => `฿${(amount || 0).toLocaleString()}`;

interface FinanceSummary {
  sales: number;
  cogs: number;
  grossProfit: number;
  expenses: number;
  netProfit: number;
  primeCostPct: number;
  foodCostPct: number;
  laborPct: number;
  netMarginPct: number;
  breakdown: { direct: number; business: number; stock: number };
}

export default function FinancePage() {
  const [summary, setSummary] = useState<FinanceSummary | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/finance/summary")
      .then((res) => {
        if (!res.ok) {
          throw new Error(`API error: ${res.status}`);
        }
        return res.json();
      })
      .then(setSummary)
      .catch((err) => {
        console.error("Failed to fetch finance summary:", err);
        setError("This feature requires authentication. Please contact support.");
      });
  }, []);

  if (error) return <div className="p-6 text-red-600">{error}</div>;
  if (!summary) return <div className="p-6">Loading finance data…</div>;

  return (
    <div className="p-6 grid grid-cols-1 md:grid-cols-3 gap-6">
      <Card><CardContent><h2>Sales</h2><p>{thb(summary.sales)}</p></CardContent></Card>
      <Card><CardContent><h2>Gross Profit</h2><p>{thb(summary.grossProfit)}</p></CardContent></Card>
      <Card><CardContent><h2>Net Profit</h2><p>{thb(summary.netProfit)}</p></CardContent></Card>

      <Card className="col-span-3">
        <CardContent>
          <h2>Ratios</h2>
          <ul className="grid grid-cols-2 md:grid-cols-5 gap-4">
            <li>Prime Cost: {summary.primeCostPct}%</li>
            <li>Food Cost: {summary.foodCostPct}%</li>
            <li>Labor: {summary.laborPct}%</li>
            <li>Net Margin: {summary.netMarginPct}%</li>
          </ul>
        </CardContent>
      </Card>

      <Card className="col-span-3">
        <CardContent>
          <h2>Expense Breakdown</h2>
          <ul>
            <li>Direct (Shift): {thb(summary.breakdown.direct)}</li>
            <li>Business: {thb(summary.breakdown.business)}</li>
            <li>Rolls Purchases: {thb(summary.breakdown.stock)}</li>
            <li>Total: {thb(summary.expenses)}</li>
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}