import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { formatDateDDMMYYYY } from "@/lib/format";

type LedgerRow = {
  shift_date: string;
  start: number;
  purchased: number;
  sold: number;
  estimated_end: number;
  actual_end: number | null;
  variance: number;
  status: string;
};

function StatusBadge({ status }: { status: string }) {
  const variant = status === 'OK' ? 'default' : status === 'ALERT' ? 'destructive' : 'secondary';
  return <Badge variant={variant}>{status}</Badge>;
}

function LedgerTable({ data, unit }: { data: LedgerRow[]; unit: string }) {
  if (!data || data.length === 0) {
    return <p className="text-sm text-slate-500 p-4">No ledger data available</p>;
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Date</TableHead>
          <TableHead className="text-right">Start</TableHead>
          <TableHead className="text-right">Purchased</TableHead>
          <TableHead className="text-right">Sold</TableHead>
          <TableHead className="text-right">Est. End</TableHead>
          <TableHead className="text-right">Actual</TableHead>
          <TableHead className="text-right">Variance</TableHead>
          <TableHead>Status</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {data.map((row) => (
          <TableRow key={row.shift_date}>
            <TableCell>{formatDateDDMMYYYY(row.shift_date)}</TableCell>
            <TableCell className="text-right">{row.start}{unit}</TableCell>
            <TableCell className="text-right">{row.purchased}{unit}</TableCell>
            <TableCell className="text-right">{row.sold}{unit}</TableCell>
            <TableCell className="text-right">{row.estimated_end}{unit}</TableCell>
            <TableCell className="text-right">{row.actual_end ?? '-'}{row.actual_end ? unit : ''}</TableCell>
            <TableCell className="text-right">{row.variance}{unit}</TableCell>
            <TableCell><StatusBadge status={row.status} /></TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}

export default function StockLedgers() {
  const [activeTab, setActiveTab] = useState("rolls");

  const { data: rollsData, isLoading: rollsLoading } = useQuery<LedgerRow[]>({
    queryKey: ["/api/analysis/rolls-ledger/history"],
    select: (data: any[]) => data?.map(r => ({
      shift_date: r.shift_date,
      start: r.rolls_start,
      purchased: r.rolls_purchased,
      sold: r.burgers_sold || 0,
      estimated_end: r.estimated_rolls_end,
      actual_end: r.actual_rolls_end,
      variance: r.variance,
      status: r.status
    })) || []
  });

  const { data: meatData, isLoading: meatLoading } = useQuery<LedgerRow[]>({
    queryKey: ["/api/analysis/meat-ledger/history"],
    select: (data: any[]) => data?.map(r => ({
      shift_date: r.shift_date,
      start: r.meat_start_g,
      purchased: r.meat_purchased_g,
      sold: r.patties_sold || 0,
      estimated_end: r.estimated_meat_end_g,
      actual_end: r.actual_meat_end_g,
      variance: r.variance_g,
      status: r.status
    })) || []
  });

  const { data: drinksData, isLoading: drinksLoading } = useQuery<LedgerRow[]>({
    queryKey: ["/api/analysis/drinks-ledger/history"],
    select: (data: any[]) => data?.map(r => ({
      shift_date: r.shift_date,
      start: r.drinks_start,
      purchased: r.drinks_purchased,
      sold: r.drinks_sold || 0,
      estimated_end: r.estimated_drinks_end,
      actual_end: r.actual_drinks_end,
      variance: r.variance,
      status: r.status
    })) || []
  });

  return (
    <div className="p-4 space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="text-xl">Stock Ledgers</CardTitle>
        </CardHeader>
        <CardContent>
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList className="mb-4">
              <TabsTrigger value="rolls">Rolls</TabsTrigger>
              <TabsTrigger value="meat">Meat</TabsTrigger>
              <TabsTrigger value="drinks">Drinks</TabsTrigger>
            </TabsList>
            
            <TabsContent value="rolls">
              {rollsLoading ? (
                <p className="text-sm text-slate-500">Loading...</p>
              ) : (
                <LedgerTable data={rollsData || []} unit="" />
              )}
            </TabsContent>
            
            <TabsContent value="meat">
              {meatLoading ? (
                <p className="text-sm text-slate-500">Loading...</p>
              ) : (
                <LedgerTable data={meatData || []} unit="g" />
              )}
            </TabsContent>
            
            <TabsContent value="drinks">
              {drinksLoading ? (
                <p className="text-sm text-slate-500">Loading...</p>
              ) : (
                <LedgerTable data={drinksData || []} unit="" />
              )}
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
}
