import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import axios from 'axios';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

export const LoyverseReports = () => {
  const [startDate, setStartDate] = useState(new Date().toISOString().slice(0,10));
  const [endDate, setEndDate] = useState(startDate);

  // Fort Knox pre-sets for quick date selection
  const preSets = [
    { label: 'Today', start: new Date().toISOString().slice(0,10), end: new Date().toISOString().slice(0,10) },
    { label: 'Last 7 Days', start: new Date(new Date().setDate(new Date().getDate() - 7)).toISOString().slice(0,10), end: new Date().toISOString().slice(0,10) },
    { label: 'MTD', start: new Date().toISOString().slice(0,7) + '-01', end: new Date().toISOString().slice(0,10) }
  ];

  const { data: shifts } = useQuery({
    queryKey: ['loyverseShifts', startDate, endDate],
    queryFn: () => axios.get(`/api/loyverse/shifts?startDate=${startDate}&endDate=${endDate}`).then(res => res.data)
  });

  const { data: receipts } = useQuery({
    queryKey: ['loyverseReceipts', startDate, endDate], 
    queryFn: () => axios.get(`/api/loyverse/receipts?startDate=${startDate}&endDate=${endDate}`).then(res => res.data)
  });

  return (
    <div className="space-y-6" data-testid="loyverse-reports-page">
      <Card>
        <CardHeader>
          <CardTitle>Loyverse Analysis</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Date Range Picker */}
          <div className="flex gap-4 items-end">
            <div>
              <Label htmlFor="start-date">From</Label>
              <Input 
                id="start-date"
                type="date" 
                value={startDate} 
                onChange={(e) => setStartDate(e.target.value)}
                data-testid="input-start-date"
              />
            </div>
            <div>
              <Label htmlFor="end-date">To</Label>
              <Input 
                id="end-date"
                type="date" 
                value={endDate} 
                onChange={(e) => setEndDate(e.target.value)}
                data-testid="input-end-date"
              />
            </div>
          </div>

          {/* Fort Knox Pre-sets */}
          <div className="flex space-x-2">
            {preSets.map(p => (
              <Button 
                key={p.label}
                variant="outline"
                onClick={() => { 
                  setStartDate(p.start); 
                  setEndDate(p.end); 
                }}
                data-testid={`button-preset-${p.label.toLowerCase().replace(/\s+/g, '-')}`}
              > 
                {p.label} 
              </Button>
            ))}
          </div>

          {/* Loyverse Shifts Section */}
          <div>
            <h2 className="text-xl font-semibold mb-2">Loyverse Shifts</h2>
            <Table data-testid="table-shifts">
              <TableHeader>
                <TableRow>
                  <TableHead>Gross Sales</TableHead>
                  <TableHead>Net Sales</TableHead>
                  <TableHead>Expenses</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {shifts?.shifts?.map((shift: any, index: number) => (
                  <TableRow key={index}>
                    <TableCell data-testid={`shift-gross-${index}`}>{shift.gross_sales || 'N/A'}</TableCell>
                    <TableCell data-testid={`shift-net-${index}`}>{shift.net_sales || 'N/A'}</TableCell>
                    <TableCell data-testid={`shift-expenses-${index}`}>{shift.expenses || 'N/A'}</TableCell>
                  </TableRow>
                )) || (
                  <TableRow>
                    <TableCell colSpan={3} className="text-center text-muted-foreground">
                      No shifts data available
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
            
            {/* Anomalies Alert */}
            {shifts?.anomalies?.length > 0 && (
              <Alert variant="destructive" className="mt-4" data-testid="alert-anomalies">
                <AlertDescription>
                  {shifts.anomalies.join('\n')}
                </AlertDescription>
              </Alert>
            )}
          </div>

          {/* Items/Modifiers Sold Section */}
          <div>
            <h2 className="text-xl font-semibold mb-2">Items/Modifiers Sold</h2>
            <Table data-testid="table-items-sold">
              <TableHeader>
                <TableRow>
                  <TableHead>Item/Modifier</TableHead>
                  <TableHead>Qty</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {receipts?.itemsSold && Object.entries(receipts.itemsSold).map(([item, qty]) => (
                  <TableRow key={item}>
                    <TableCell data-testid={`item-name-${item.replace(/\s/g, '-')}`}>{item}</TableCell>
                    <TableCell data-testid={`item-qty-${item.replace(/\s/g, '-')}`}>{String(qty)}</TableCell>
                  </TableRow>
                )) || (
                  <TableRow>
                    <TableCell colSpan={2} className="text-center text-muted-foreground">
                      No items sold data available
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>

          {/* Receipts Section */}
          <div>
            <h2 className="text-xl font-semibold mb-2">Live Receipts</h2>
            <Accordion type="single" collapsible data-testid="accordion-receipts">
              {receipts?.receipts?.map((r: any, index: number) => (
                <AccordionItem key={index} value={`receipt-${index}`}>
                  <AccordionTrigger data-testid={`receipt-trigger-${index}`}>
                    {r.created_at || `Receipt ${index + 1}`}
                  </AccordionTrigger>
                  <AccordionContent data-testid={`receipt-content-${index}`}>
                    <pre className="text-sm whitespace-pre-wrap">
                      {JSON.stringify(r, null, 2)}
                    </pre>
                  </AccordionContent>
                </AccordionItem>
              )) || (
                <div className="text-center text-muted-foreground p-4">
                  No receipts data available
                </div>
              )}
            </Accordion>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};