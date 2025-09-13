import React, { useEffect, useState } from "react";
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
  const [data, setData] = useState<Snapshot | null>(null);

  useEffect(() => {
    fetch("/api/finance/summary/today").then((res) => res.json()).then(setData);
  }, []);

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