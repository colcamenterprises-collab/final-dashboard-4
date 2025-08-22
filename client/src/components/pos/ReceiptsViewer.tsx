import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Receipt, Calendar } from 'lucide-react';

type PosReceipt = {
  id: string;
  receiptId: string;
  datetime: string;
  total: string;
  payment: string;
  itemsJson: any[];
};

type ReceiptsViewerProps = {
  batchId: string;
};

const formatTHB = (amount: string | number) => 
  new Intl.NumberFormat('th-TH', { 
    style: 'currency', 
    currency: 'THB', 
    maximumFractionDigits: 0 
  }).format(Number(amount) || 0);

export function ReceiptsViewer({ batchId }: ReceiptsViewerProps) {
  const { data, isLoading, error } = useQuery({
    queryKey: ['/api/pos/receipts', batchId],
    queryFn: () => fetch(`/api/pos/receipts?batchId=${batchId}`).then(res => res.json()),
    enabled: !!batchId,
  });

  const receipts: PosReceipt[] = data?.data || [];
  const totalAmount = receipts.reduce((sum, receipt) => sum + Number(receipt.total), 0);

  if (isLoading) {
    return (
      <Card>
        <CardContent className="py-8 text-center">
          <p>Loading receipts...</p>
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card>
        <CardContent className="py-8 text-center text-red-600">
          <p>Error loading receipts: {error.message}</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Receipt className="w-5 h-5" />
              <CardTitle>Receipts Viewer</CardTitle>
            </div>
            <div className="text-right">
              <p className="text-sm text-muted-foreground">Total: {receipts.length} receipts</p>
              <p className="font-mono text-lg">{formatTHB(totalAmount)}</p>
            </div>
          </div>
          <CardDescription>
            Batch: {batchId}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {receipts.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Receipt className="w-12 h-12 mx-auto mb-4 opacity-50" />
              <p>No receipts found for this batch</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Receipt ID</TableHead>
                  <TableHead>Date/Time</TableHead>
                  <TableHead className="text-right">Total</TableHead>
                  <TableHead>Payment</TableHead>
                  <TableHead>Items</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {receipts.map((receipt) => (
                  <TableRow key={receipt.id}>
                    <TableCell className="font-mono text-sm">
                      {receipt.receiptId}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Calendar className="w-4 h-4 text-muted-foreground" />
                        <span className="text-sm">
                          {new Date(receipt.datetime).toLocaleString('th-TH')}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell className="text-right font-mono">
                      {formatTHB(receipt.total)}
                    </TableCell>
                    <TableCell>
                      <Badge variant={receipt.payment === 'Cash' ? 'default' : 'secondary'}>
                        {receipt.payment || 'Unknown'}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="text-sm text-muted-foreground">
                        {Array.isArray(receipt.itemsJson) && receipt.itemsJson.length > 0 ? (
                          <span>{receipt.itemsJson.length} items</span>
                        ) : (
                          <span>No items data</span>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}