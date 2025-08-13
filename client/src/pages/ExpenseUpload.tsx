import { useState, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { AlertCircle, Upload, FileText, CheckCircle, XCircle, Info, Brain, Download } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useToast } from '@/hooks/use-toast';
import { apiRequest } from '@/lib/queryClient';

interface ImportBatch {
  id: number;
  type: 'CSV' | 'PDF';
  filename: string;
  status: 'DRAFT' | 'REVIEW' | 'COMMITTED';
  rowCount: number;
  createdAt: string;
}

interface ImportLine {
  id: number;
  rowIndex: number;
  dateRaw: string;
  descriptionRaw: string;
  amountRaw: string;
  currencyRaw: string;
  parsedOk: boolean;
  parseErrors: any;
  vendorGuess?: string;
  categoryGuessId?: number;
  confidence: number;
  duplicateOfExpenseId?: number;
}

interface Vendor {
  id: number;
  displayName: string;
}

interface Category {
  id: number;
  name: string;
  code: string;
}

export default function ExpenseUpload() {
  const [uploadStep, setUploadStep] = useState<'select' | 'mapping' | 'review' | 'complete'>('select');
  const [currentBatchId, setCurrentBatchId] = useState<number | null>(null);
  const [selectedFiles, setSelectedFiles] = useState<FileList | null>(null);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [showUncertainOnly, setShowUncertainOnly] = useState(false);
  const [columnMapping, setColumnMapping] = useState<Record<string, string>>({});
  const [csvHeaders, setCsvHeaders] = useState<string[]>([]);
  const [csvPreview, setCsvPreview] = useState<any[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Fetch import batches
  const { data: batches = [] } = useQuery<ImportBatch[]>({
    queryKey: ['/api/expenses/imports'],
  });

  // Fetch vendors for dropdown
  const { data: vendors = [] } = useQuery<Vendor[]>({
    queryKey: ['/api/expenses/imports/vendors'],
  });

  // Fetch categories for dropdown
  const { data: categories = [] } = useQuery<Category[]>({
    queryKey: ['/api/expenses/imports/categories'],
  });

  // Fetch import lines for review
  const { data: importLines = [] } = useQuery<ImportLine[]>({
    queryKey: ['/api/expenses/imports', currentBatchId, 'lines'],
    enabled: !!currentBatchId && uploadStep === 'review',
  });

  // Create import batch mutation
  const createBatchMutation = useMutation({
    mutationFn: async (data: { type: string; filename: string; mime: string; contentBase64: string }) => {
      return apiRequest('/api/expenses/imports', {
        method: 'POST',
        body: JSON.stringify(data),
        headers: {
          'Content-Type': 'application/json',
        },
      });
    },
    onSuccess: (data) => {
      setCurrentBatchId(data.batchId);
      setUploadStep('mapping');
      queryClient.invalidateQueries({ queryKey: ['/api/expenses/imports'] });
    },
    onError: (error) => {
      toast({
        title: 'Upload Failed',
        description: 'Failed to create import batch',
        variant: 'destructive',
      });
    },
  });

  // Parse content mutation
  const parseContentMutation = useMutation({
    mutationFn: async (data: { batchId: number; mapping: Record<string, string>; contentBase64: string }) => {
      return apiRequest(`/api/expenses/imports/${data.batchId}/parse`, {
        method: 'POST',
        body: JSON.stringify({ mapping: data.mapping, contentBase64: data.contentBase64 }),
        headers: {
          'Content-Type': 'application/json',
        },
      });
    },
    onSuccess: () => {
      setUploadStep('review');
      queryClient.invalidateQueries({ queryKey: ['/api/expenses/imports', currentBatchId, 'lines'] });
    },
    onError: (error) => {
      toast({
        title: 'Parse Failed',
        description: 'Failed to parse uploaded content',
        variant: 'destructive',
      });
    },
  });

  // Update line mutation
  const updateLineMutation = useMutation({
    mutationFn: async (data: { batchId: number; lineId: number; vendorId?: number; categoryId?: number }) => {
      return apiRequest(`/api/expenses/imports/${data.batchId}/lines/${data.lineId}`, {
        method: 'PATCH',
        body: JSON.stringify({ vendorId: data.vendorId, categoryId: data.categoryId }),
        headers: {
          'Content-Type': 'application/json',
        },
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/expenses/imports', currentBatchId, 'lines'] });
    },
  });

  // Commit batch mutation
  const commitBatchMutation = useMutation({
    mutationFn: async (batchId: number) => {
      return apiRequest(`/api/expenses/imports/${batchId}/commit`, {
        method: 'POST',
      });
    },
    onSuccess: (data) => {
      setUploadStep('complete');
      toast({
        title: 'Import Complete',
        description: `${data.committed} expenses imported, ${data.skipped} skipped`,
      });
      queryClient.invalidateQueries({ queryKey: ['/api/expenses/imports'] });
    },
    onError: (error) => {
      toast({
        title: 'Commit Failed',
        description: 'Failed to commit import',
        variant: 'destructive',
      });
    },
  });

  const handleFileSelect = async (files: FileList) => {
    if (!files.length) return;

    const file = files[0];
    setSelectedFiles(files);

    // Read file content
    const reader = new FileReader();
    reader.onload = async (e) => {
      const content = e.target?.result as string;
      const contentBase64 = btoa(content);

      // For CSV files, parse headers for mapping
      if (file.type === 'text/csv' || file.name.endsWith('.csv')) {
        const lines = content.split('\n');
        if (lines.length > 0) {
          const headers = lines[0].split(',').map(h => h.trim().replace(/"/g, ''));
          setCsvHeaders(headers);
          
          // Parse first few rows for preview
          const preview = lines.slice(1, 4).map(line => {
            const values = line.split(',').map(v => v.trim().replace(/"/g, ''));
            const row: any = {};
            headers.forEach((header, index) => {
              row[header] = values[index] || '';
            });
            return row;
          });
          setCsvPreview(preview);
        }
      }

      // Create import batch
      createBatchMutation.mutate({
        type: file.name.endsWith('.pdf') ? 'PDF' : 'CSV',
        filename: file.name,
        mime: file.type,
        contentBase64,
      });
    };

    reader.readAsText(file);
  };

  const handleParseContent = () => {
    if (!currentBatchId || !selectedFiles) return;

    const file = selectedFiles[0];
    const reader = new FileReader();
    reader.onload = (e) => {
      const content = e.target?.result as string;
      const contentBase64 = btoa(content);

      parseContentMutation.mutate({
        batchId: currentBatchId,
        mapping: columnMapping,
        contentBase64,
      });
    };

    reader.readAsText(file);
  };

  const handleCommitBatch = () => {
    if (!currentBatchId) return;
    commitBatchMutation.mutate(currentBatchId);
  };

  const resetUpload = () => {
    setUploadStep('select');
    setCurrentBatchId(null);
    setSelectedFiles(null);
    setColumnMapping({});
    setCsvHeaders([]);
    setCsvPreview([]);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const renderUploadStep = () => {
    switch (uploadStep) {
      case 'select':
        return (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Upload className="h-5 w-5" />
                Upload Bank Statement
              </CardTitle>
              <CardDescription>
                Upload CSV or PDF files from your bank or credit card statements for automatic expense categorization
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-lg p-8 text-center">
                <Input
                  ref={fileInputRef}
                  type="file"
                  accept=".csv,.pdf"
                  onChange={(e) => e.target.files && handleFileSelect(e.target.files)}
                  className="hidden"
                />
                <Button
                  onClick={() => fileInputRef.current?.click()}
                  variant="outline"
                  size="lg"
                  className="mb-4"
                >
                  <Upload className="h-5 w-5 mr-2" />
                  Choose File
                </Button>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  Supports CSV and PDF files up to 10MB
                </p>
                <p className="text-xs text-gray-500 dark:text-gray-500 mt-2">
                  Thai language bank statements are fully supported
                </p>
              </div>

              {createBatchMutation.isPending && (
                <div className="space-y-2">
                  <Progress value={uploadProgress} />
                  <p className="text-sm text-center">Uploading file...</p>
                </div>
              )}
            </CardContent>
          </Card>
        );

      case 'mapping':
        return (
          <Card>
            <CardHeader>
              <CardTitle>Column Mapping</CardTitle>
              <CardDescription>
                Map your CSV columns to expense fields for accurate parsing
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Date Column</Label>
                  <Select onValueChange={(value) => setColumnMapping({ ...columnMapping, date: value })}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select date column" />
                    </SelectTrigger>
                    <SelectContent>
                      {csvHeaders.map((header) => (
                        <SelectItem key={header} value={header}>
                          {header}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label>Description Column</Label>
                  <Select onValueChange={(value) => setColumnMapping({ ...columnMapping, description: value })}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select description column" />
                    </SelectTrigger>
                    <SelectContent>
                      {csvHeaders.map((header) => (
                        <SelectItem key={header} value={header}>
                          {header}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label>Amount Column</Label>
                  <Select onValueChange={(value) => setColumnMapping({ ...columnMapping, amount: value })}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select amount column" />
                    </SelectTrigger>
                    <SelectContent>
                      {csvHeaders.map((header) => (
                        <SelectItem key={header} value={header}>
                          {header}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label>Currency Column (Optional)</Label>
                  <Select onValueChange={(value) => setColumnMapping({ ...columnMapping, currency: value })}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select currency column" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="">None</SelectItem>
                      {csvHeaders.map((header) => (
                        <SelectItem key={header} value={header}>
                          {header}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {csvPreview.length > 0 && (
                <div>
                  <Label>Preview</Label>
                  <Table className="mt-2">
                    <TableHeader>
                      <TableRow>
                        {csvHeaders.slice(0, 5).map((header) => (
                          <TableHead key={header}>{header}</TableHead>
                        ))}
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {csvPreview.map((row, index) => (
                        <TableRow key={index}>
                          {csvHeaders.slice(0, 5).map((header) => (
                            <TableCell key={header}>{row[header]}</TableCell>
                          ))}
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}

              <div className="flex gap-2">
                <Button onClick={resetUpload} variant="outline">
                  Cancel
                </Button>
                <Button
                  onClick={handleParseContent}
                  disabled={parseContentMutation.isPending || !columnMapping.date || !columnMapping.description || !columnMapping.amount}
                >
                  {parseContentMutation.isPending ? 'Parsing...' : 'Parse Content'}
                </Button>
              </div>
            </CardContent>
          </Card>
        );

      case 'review':
        const uncertainLines = importLines.filter(line => line.confidence < 0.8 && line.parsedOk);
        const displayLines = showUncertainOnly ? uncertainLines : importLines.filter(line => line.parsedOk);

        return (
          <div className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center justify-between">
                  <span className="flex items-center gap-2">
                    <Brain className="h-5 w-5" />
                    Review AI Categorization
                  </span>
                  <div className="flex items-center gap-4">
                    <div className="flex items-center gap-2">
                      <Switch
                        checked={showUncertainOnly}
                        onCheckedChange={setShowUncertainOnly}
                      />
                      <Label>Show uncertain only</Label>
                    </div>
                    <Badge variant="outline">
                      {uncertainLines.length} uncertain
                    </Badge>
                  </div>
                </CardTitle>
                <CardDescription>
                  Review and correct the AI-suggested vendor and category assignments
                </CardDescription>
              </CardHeader>
            </Card>

            <div className="space-y-2">
              {displayLines.map((line) => (
                <Card key={line.id} className="p-4">
                  <div className="grid grid-cols-6 gap-4 items-center">
                    <div>
                      <p className="text-sm font-medium">{line.dateRaw}</p>
                      <p className="text-xs text-gray-500">{line.amountRaw}</p>
                    </div>
                    
                    <div className="col-span-2">
                      <p className="text-sm font-medium truncate">{line.descriptionRaw}</p>
                      {line.duplicateOfExpenseId && (
                        <Badge variant="destructive" className="text-xs">
                          Duplicate
                        </Badge>
                      )}
                    </div>

                    <div>
                      <Label className="text-xs">Vendor</Label>
                      <Select
                        value={line.vendorGuess || ''}
                        onValueChange={(value) => 
                          updateLineMutation.mutate({
                            batchId: currentBatchId!,
                            lineId: line.id,
                            vendorId: parseInt(value) || undefined,
                          })
                        }
                      >
                        <SelectTrigger className="h-8">
                          <SelectValue placeholder="Select vendor" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="">None</SelectItem>
                          {vendors.map((vendor) => (
                            <SelectItem key={vendor.id} value={vendor.id.toString()}>
                              {vendor.displayName}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div>
                      <Label className="text-xs">Category</Label>
                      <Select
                        value={line.categoryGuessId?.toString() || ''}
                        onValueChange={(value) =>
                          updateLineMutation.mutate({
                            batchId: currentBatchId!,
                            lineId: line.id,
                            categoryId: parseInt(value) || undefined,
                          })
                        }
                      >
                        <SelectTrigger className="h-8">
                          <SelectValue placeholder="Select category" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="">None</SelectItem>
                          {categories.map((category) => (
                            <SelectItem key={category.id} value={category.id.toString()}>
                              {category.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="flex items-center gap-2">
                      <Badge
                        variant={line.confidence > 0.8 ? 'default' : line.confidence > 0.5 ? 'secondary' : 'destructive'}
                      >
                        {Math.round(line.confidence * 100)}%
                      </Badge>
                      {line.duplicateOfExpenseId && (
                        <XCircle className="h-4 w-4 text-red-500" />
                      )}
                    </div>
                  </div>
                </Card>
              ))}
            </div>

            <div className="flex gap-2">
              <Button onClick={resetUpload} variant="outline">
                Cancel
              </Button>
              <Button
                onClick={handleCommitBatch}
                disabled={commitBatchMutation.isPending}
              >
                {commitBatchMutation.isPending ? 'Importing...' : 'Import Expenses'}
              </Button>
            </div>
          </div>
        );

      case 'complete':
        return (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-green-600">
                <CheckCircle className="h-5 w-5" />
                Import Complete
              </CardTitle>
              <CardDescription>
                Your expenses have been successfully imported and categorized
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button onClick={resetUpload} className="mt-4">
                Import Another File
              </Button>
            </CardContent>
          </Card>
        );

      default:
        return null;
    }
  };

  return (
    <div className="container mx-auto py-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Expense Management</h1>
          <p className="text-gray-600 dark:text-gray-400">
            Direct upload bank statements for AI-powered expense categorization
          </p>
        </div>
      </div>

      <Tabs defaultValue="upload" className="space-y-4">
        <TabsList>
          <TabsTrigger value="upload">Upload Statements</TabsTrigger>
          <TabsTrigger value="history">Import History</TabsTrigger>
        </TabsList>

        <TabsContent value="upload" className="space-y-4">
          {renderUploadStep()}
        </TabsContent>

        <TabsContent value="history" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Import History</CardTitle>
              <CardDescription>
                View and manage your previous expense imports
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>File</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Rows</TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {batches.map((batch) => (
                    <TableRow key={batch.id}>
                      <TableCell className="font-medium">{batch.filename}</TableCell>
                      <TableCell>
                        <Badge variant="outline">{batch.type}</Badge>
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant={
                            batch.status === 'COMMITTED'
                              ? 'default'
                              : batch.status === 'REVIEW'
                              ? 'secondary'
                              : 'destructive'
                          }
                        >
                          {batch.status}
                        </Badge>
                      </TableCell>
                      <TableCell>{batch.rowCount}</TableCell>
                      <TableCell>
                        {new Date(batch.createdAt).toLocaleDateString()}
                      </TableCell>
                      <TableCell>
                        {batch.status === 'REVIEW' && (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => {
                              setCurrentBatchId(batch.id);
                              setUploadStep('review');
                            }}
                          >
                            Review
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}