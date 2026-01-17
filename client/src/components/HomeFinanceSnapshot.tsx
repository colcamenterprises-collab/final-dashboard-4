import React from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";

const thb = (amount: number) => `฿${amount.toLocaleString()}`;

interface Snapshot {
  sales: number;
  netProfit: number;
  primeCostPct: number;
  directExpenses: number;
  businessExpenses: number;
  stockExpenses: number;
}

export default function HomeFinanceSnapshot() {
  const { data, isLoading, isError, error } = useQuery<Snapshot>({
    queryKey: ['/api/finance/summary/today'],
  });

  if (isLoading) return null;

  if (isError) {
    return (
      <Card>
        <CardContent>
          <h2>Finance Snapshot</h2>
          <div className="text-xs text-orange-600">
            Finance snapshot unavailable: {(error as Error)?.message}
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!data) return null;

  return (
    <Card>
      <CardContent>
        <h2>Finance Snapshot</h2>
        <ul>
          <li>Sales Today: {thb(data.sales)}</li>
          <li>Net Profit: {thb(data.netProfit)}</li>
          <li>Prime Cost: {data.primeCostPct}%</li>
          <li>Direct Expenses: {thb(data.directExpenses)}</li>
          <li>Business Expenses: {thb(data.businessExpenses)}</li>
          <li>Rolls Purchases: {thb(data.stockExpenses)}</li>
        </ul>
      </CardContent>
    </Card>
  );
}
