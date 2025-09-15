// Golden Patch - Expenses Import & Approval System
import { useState, useRef } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { queryClient, apiRequest } from '@/lib/queryClient';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Upload, CheckCircle, XCircle, DollarSign, TrendingUp, FileText, AlertTriangle } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';

interface PendingExpense {
  id: string;
  description: string;
  amountTHB: number;
  date: string;
  status: string;
  rawData: any;
}

interface PartnerSummary {
  partner: string;
  totalSalesTHB: number;
  totalCommissionTHB: number;
  totalPayoutTHB: number;
  commissionRate: number;
  statementCount: number;
}

export default function ExpensesImport() {
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState('upload');
  const [selectedExpense, setSelectedExpense] = useState<PendingExpense | null>(null);
  const [showApprovalDialog, setShowApprovalDialog] = useState(false);
  const [approvalAction, setApprovalAction] = useState<'approve' | 'reject'>('approve');
  const [approvalCategory, setApprovalCategory] = useState('');
  const [approvalSupplier, setApprovalSupplier] = useState('');
  
  const bankFileRef = useRef<HTMLInputElement>(null);
  const partnerFileRef = useRef<HTMLInputElement>(null);

  // SECURITY: Authentication headers required by backend security fixes
  const getAuthHeaders = () => ({
    'x-restaurant-id': 'smash-brothers-burgers', // Development restaurant ID
    'x-user-id': 'dev-manager', // Development user ID  
    'x-user-role': 'manager', // Required for manager operations
  });

  // SECURITY: Queries with authentication headers
  const pendingQuery = useQuery({
    queryKey: ['/api/expenses/pending'],
    queryFn: async () => {
      return apiRequest('/api/expenses/pending', {
        headers: getAuthHeaders(),
      });
    },
    refetchInterval: 5000, // Refresh every 5 seconds
  });

  const partnersQuery = useQuery({
    queryKey: ['/api/partners/summary'],
    queryFn: async () => {
      return apiRequest('/api/partners/summary', {
        headers: getAuthHeaders(),
      });
    },
  });

  // Mutations
  const uploadBankMutation = useMutation({
    mutationFn: async (file: File) => {
      const formData = new FormData();
      formData.append('file', file);
      
      // Use fetch directly for FormData uploads (apiRequest doesn't handle FormData)
      const res = await fetch('/api/expenses/upload-bank', {
        method: 'POST',
        headers: getAuthHeaders(), // Don't set Content-Type, let browser handle multipart/form-data
        body: formData,
        credentials: 'include',
      });
      
      if (!res.ok) {
        const text = await res.text();
        throw new Error(`${res.status}: ${text}`);
      }
      
      return res.json();
    },
    onSuccess: (data: any) => {
      toast({
        title: '✅ Bank Statement Uploaded',
        description: `Imported ${data.imported} transactions for review`,
      });
      queryClient.invalidateQueries({ queryKey: ['/api/expenses/pending'] });
      if (bankFileRef.current) bankFileRef.current.value = '';
    },
    onError: (error: any) => {
      toast({
        title: '❌ Upload Failed',
        description: error.message || 'Failed to upload bank statement',
        variant: 'destructive',
      });
    },
  });

  const uploadPartnerMutation = useMutation({
    mutationFn: async ({ file, partner }: { file: File; partner: string }) => {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('partner', partner);
      
      // Use fetch directly for FormData uploads (apiRequest doesn't handle FormData)
      const res = await fetch('/api/expenses/upload-partner', {
        method: 'POST',
        headers: getAuthHeaders(), // Don't set Content-Type, let browser handle multipart/form-data
        body: formData,
        credentials: 'include',
      });
      
      if (!res.ok) {
        const text = await res.text();
        throw new Error(`${res.status}: ${text}`);
      }
      
      return res.json();
    },
    onSuccess: (data: any) => {
      toast({
        title: '✅ Partner Statement Uploaded',
        description: `Imported ${data.imported} partner records`,
      });
      queryClient.invalidateQueries({ queryKey: ['/api/partners/summary'] });
      if (partnerFileRef.current) partnerFileRef.current.value = '';
    },
    onError: (error: any) => {
      toast({
        title: '❌ Upload Failed',
        description: error.message || 'Failed to upload partner statement',
        variant: 'destructive',
      });
    },
  });

  const approveExpenseMutation = useMutation({
    mutationFn: async ({ id, category, supplier }: { id: string; category: string; supplier: string }) => {
      return apiRequest(`/api/expenses/${id}/approve`, {
        method: 'PATCH',
        headers: { 
          'Content-Type': 'application/json',
          ...getAuthHeaders(),
        },
        body: JSON.stringify({ category, supplier }),
      });
    },
    onSuccess: () => {
      toast({
        title: '✅ Expense Approved',
        description: 'Expense has been added to the ledger',
      });
      queryClient.invalidateQueries({ queryKey: ['/api/expenses/pending'] });
      setShowApprovalDialog(false);
      setSelectedExpense(null);
    },
  });

  const rejectExpenseMutation = useMutation({
    mutationFn: async (id: string) => {
      return apiRequest(`/api/expenses/${id}/reject`, {
        method: 'PATCH',
        headers: getAuthHeaders(),
      });
    },
    onSuccess: () => {
      toast({
        title: '✅ Expense Rejected',
        description: 'Expense has been marked as rejected',
      });
      queryClient.invalidateQueries({ queryKey: ['/api/expenses/pending'] });
      setShowApprovalDialog(false);
      setSelectedExpense(null);
    },
  });

  const handleBankUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      if (!file.name.endsWith('.csv')) {
        toast({
          title: '❌ Invalid File',
          description: 'Please upload a CSV file',
          variant: 'destructive',
        });
        return;
      }
      uploadBankMutation.mutate(file);
    }
  };

  const handlePartnerUpload = (event: React.ChangeEvent<HTMLInputElement>, partner: string) => {
    const file = event.target.files?.[0];
    if (file && partner) {
      if (!file.name.endsWith('.csv')) {
        toast({
          title: '❌ Invalid File',
          description: 'Please upload a CSV file',
          variant: 'destructive',
        });
        return;
      }
      uploadPartnerMutation.mutate({ file, partner });
    }
  };

  const handleApprovalSubmit = () => {
    if (!selectedExpense) return;
    
    if (approvalAction === 'approve') {
      if (!approvalCategory || !approvalSupplier) {
        toast({
          title: '❌ Missing Information',
          description: 'Please select category and enter supplier',
          variant: 'destructive',
        });
        return;
      }
      approveExpenseMutation.mutate({
        id: selectedExpense.id,
        category: approvalCategory,
        supplier: approvalSupplier,
      });
    } else {
      rejectExpenseMutation.mutate(selectedExpense.id);
    }
  };

  const openApprovalDialog = (expense: PendingExpense, action: 'approve' | 'reject') => {
    setSelectedExpense(expense);
    setApprovalAction(action);
    setApprovalCategory('');
    setApprovalSupplier('');
    setShowApprovalDialog(true);
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('th-TH', {
      style: 'currency',
      currency: 'THB',
    }).format(amount);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('th-TH');
  };

  return (
    <div className="container mx-auto p-6 max-w-7xl space-y-6">
      <div className="flex items-center gap-3">
        <FileText className="h-8 w-8 text-emerald-600" />
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
          Golden Patch - Expenses Import System
        </h1>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="upload" className="flex items-center gap-2">
            <Upload className="h-4 w-4" />
            Upload
          </TabsTrigger>
          <TabsTrigger value="pending" className="flex items-center gap-2">
            <AlertTriangle className="h-4 w-4" />
            Pending ({pendingQuery.data?.length || 0})
          </TabsTrigger>
          <TabsTrigger value="ledger" className="flex items-center gap-2">
            <DollarSign className="h-4 w-4" />
            Ledger
          </TabsTrigger>
          <TabsTrigger value="partners" className="flex items-center gap-2">
            <TrendingUp className="h-4 w-4" />
            Partners
          </TabsTrigger>
        </TabsList>

        {/* Upload Tab */}
        <TabsContent value="upload" className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Bank Statement Upload */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Upload className="h-5 w-5 text-blue-600" />
                  Bank Statement Upload
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div>
                    <Label htmlFor="bankFile">CSV File</Label>
                    <Input
                      ref={bankFileRef}
                      type="file"
                      accept=".csv"
                      onChange={handleBankUpload}
                      disabled={uploadBankMutation.isPending}
                      data-testid="input-bank-csv"
                    />
                  </div>
                  <Button
                    onClick={() => bankFileRef.current?.click()}
                    disabled={uploadBankMutation.isPending}
                    className="w-full"
                    data-testid="button-upload-bank"
                  >
                    {uploadBankMutation.isPending ? 'Uploading...' : 'Upload Bank Statement'}
                  </Button>
                </div>
              </CardContent>
            </Card>

            {/* Partner Statement Upload */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <TrendingUp className="h-5 w-5 text-green-600" />
                  Partner Statement Upload
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div>
                    <Label htmlFor="partnerFile">CSV File</Label>
                    <Input
                      ref={partnerFileRef}
                      type="file"
                      accept=".csv"
                      onChange={(e) => handlePartnerUpload(e, 'FoodPanda')}
                      disabled={uploadPartnerMutation.isPending}
                      data-testid="input-partner-csv"
                    />
                  </div>
                  <Button
                    onClick={() => partnerFileRef.current?.click()}
                    disabled={uploadPartnerMutation.isPending}
                    className="w-full"
                    data-testid="button-upload-partner"
                  >
                    {uploadPartnerMutation.isPending ? 'Uploading...' : 'Upload Partner Statement'}
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Pending Tab */}
        <TabsContent value="pending" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <AlertTriangle className="h-5 w-5 text-amber-600" />
                Pending Expenses ({pendingQuery.data?.length || 0})
              </CardTitle>
            </CardHeader>
            <CardContent>
              {pendingQuery.isLoading ? (
                <div className="text-center py-8">Loading pending expenses...</div>
              ) : pendingQuery.data?.length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  No pending expenses found
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Date</TableHead>
                      <TableHead>Description</TableHead>
                      <TableHead className="text-right">Amount</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {pendingQuery.data?.map((expense: PendingExpense) => (
                      <TableRow key={expense.id} data-testid={`row-expense-${expense.id}`}>
                        <TableCell data-testid={`text-date-${expense.id}`}>
                          {formatDate(expense.date)}
                        </TableCell>
                        <TableCell data-testid={`text-description-${expense.id}`}>
                          {expense.description}
                        </TableCell>
                        <TableCell className="text-right" data-testid={`text-amount-${expense.id}`}>
                          <span className={cn(
                            expense.amountTHB >= 0 ? 'text-green-600' : 'text-red-600'
                          )}>
                            {formatCurrency(expense.amountTHB)}
                          </span>
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className="text-amber-600 border-amber-600">
                            {expense.status}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <div className="flex gap-2">
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => openApprovalDialog(expense, 'approve')}
                              data-testid={`button-approve-${expense.id}`}
                            >
                              <CheckCircle className="h-4 w-4 text-green-600" />
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => openApprovalDialog(expense, 'reject')}
                              data-testid={`button-reject-${expense.id}`}
                            >
                              <XCircle className="h-4 w-4 text-red-600" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Ledger Tab */}
        <TabsContent value="ledger" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <DollarSign className="h-5 w-5 text-green-600" />
                Approved Expenses Ledger
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-center py-8 text-gray-500">
                Approved expenses are automatically added to the main expenses system
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Partners Tab */}
        <TabsContent value="partners" className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {partnersQuery.data?.map((partner: PartnerSummary) => (
              <Card key={partner.partner} data-testid={`card-partner-${partner.partner}`}>
                <CardHeader>
                  <CardTitle className="text-lg" data-testid={`text-partner-name-${partner.partner}`}>
                    {partner.partner}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    <div className="flex justify-between">
                      <span className="text-sm text-gray-600">Total Sales:</span>
                      <span className="font-medium" data-testid={`text-sales-${partner.partner}`}>
                        {formatCurrency(partner.totalSalesTHB)}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-sm text-gray-600">Commission:</span>
                      <span className="font-medium" data-testid={`text-commission-${partner.partner}`}>
                        {formatCurrency(partner.totalCommissionTHB)}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-sm text-gray-600">Net Payout:</span>
                      <span className="font-medium" data-testid={`text-payout-${partner.partner}`}>
                        {formatCurrency(partner.totalPayoutTHB)}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-sm text-gray-600">Commission Rate:</span>
                      <span className="font-medium" data-testid={`text-rate-${partner.partner}`}>
                        {partner.commissionRate.toFixed(1)}%
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-sm text-gray-600">Statements:</span>
                      <span className="font-medium" data-testid={`text-count-${partner.partner}`}>
                        {partner.statementCount}
                      </span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>
      </Tabs>

      {/* Approval Dialog */}
      <AlertDialog open={showApprovalDialog} onOpenChange={setShowApprovalDialog}>
        <AlertDialogContent data-testid="dialog-approval">
          <AlertDialogHeader>
            <AlertDialogTitle>
              {approvalAction === 'approve' ? 'Approve Expense' : 'Reject Expense'}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {selectedExpense && (
                <div className="space-y-2">
                  <div><strong>Description:</strong> {selectedExpense.description}</div>
                  <div><strong>Amount:</strong> {formatCurrency(selectedExpense.amountTHB)}</div>
                  <div><strong>Date:</strong> {formatDate(selectedExpense.date)}</div>
                </div>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          
          {approvalAction === 'approve' && (
            <div className="space-y-4">
              <div>
                <Label htmlFor="category">Expense Category</Label>
                <Select value={approvalCategory} onValueChange={setApprovalCategory}>
                  <SelectTrigger data-testid="select-category">
                    <SelectValue placeholder="Select category" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Food & Ingredients">Food & Ingredients</SelectItem>
                    <SelectItem value="Utilities">Utilities</SelectItem>
                    <SelectItem value="Equipment">Equipment</SelectItem>
                    <SelectItem value="Marketing">Marketing</SelectItem>
                    <SelectItem value="General">General</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="supplier">Supplier</Label>
                <Input
                  value={approvalSupplier}
                  onChange={(e) => setApprovalSupplier(e.target.value)}
                  placeholder="Enter supplier name"
                  data-testid="input-supplier"
                />
              </div>
            </div>
          )}
          
          <AlertDialogFooter>
            <AlertDialogCancel data-testid="button-cancel">Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleApprovalSubmit}
              disabled={approveExpenseMutation.isPending || rejectExpenseMutation.isPending}
              data-testid="button-confirm"
            >
              {approvalAction === 'approve' ? 'Approve' : 'Reject'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}