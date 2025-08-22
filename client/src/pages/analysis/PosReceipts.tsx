import { useState } from 'react';
import { ReceiptsViewer } from '@/components/pos/ReceiptsViewer';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Receipt, Search } from 'lucide-react';

export default function PosReceipts() {
  const [batchId, setBatchId] = useState('');
  const [activeBatchId, setActiveBatchId] = useState('');

  const handleSearch = () => {
    if (batchId) {
      setActiveBatchId(batchId);
    }
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Receipt className="w-5 h-5" />
            POS Receipts Viewer
          </CardTitle>
          <CardDescription>
            Browse individual receipts from uploaded POS data
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex gap-2">
            <Input 
              value={batchId}
              onChange={(e) => setBatchId(e.target.value)}
              placeholder="Enter batch ID to view receipts"
              className="flex-1"
            />
            <Button onClick={handleSearch} disabled={!batchId}>
              <Search className="w-4 h-4 mr-2" />
              Search
            </Button>
          </div>
        </CardContent>
      </Card>

      {activeBatchId && (
        <ReceiptsViewer batchId={activeBatchId} />
      )}
    </div>
  );
}