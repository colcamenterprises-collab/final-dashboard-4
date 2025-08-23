import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Upload } from 'lucide-react';

export default function PosUpload() {
  const [batchId, setBatchId] = useState('');
  const [uploading, setUploading] = useState(false);

  const handleUpload = async (formData: FormData) => {
    try {
      setUploading(true);
      const response = await fetch('/api/pos/upload', {
        method: 'POST',
        body: formData,
      });
      
      const result = await response.json();
      if (result.ok) {
        setBatchId(result.batchId);
      }
    } catch (error) {
      console.error('Upload failed:', error);
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Upload className="w-5 h-5" />
            Upload POS Data Bundle
          </CardTitle>
          <CardDescription>
            Upload CSV exports from your POS system for analysis
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="text-sm font-medium">Batch Title</label>
              <Input placeholder="e.g., Evening Shift - Nov 20" />
            </div>
            <div>
              <label className="text-sm font-medium">Result Batch ID</label>
              <Input 
                value={batchId}
                readOnly
                placeholder="Upload files to get batch ID"
              />
            </div>
          </div>
          
          <div className="text-sm text-muted-foreground">
            Upload your POS CSV files (receipts, shift report, sales by item/modifier/payment)
            and they will be parsed into the database for reconciliation analysis.
          </div>

          {batchId && (
            <div className="bg-green-50 border border-green-200 rounded-lg p-4">
              <p className="text-green-800 font-medium">✓ Upload successful!</p>
              <p className="text-green-700 text-sm">Batch ID: {batchId}</p>
              <p className="text-green-700 text-sm">You can now view receipts or run shift analysis using this batch ID.</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}