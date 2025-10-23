import React, { useState, useEffect } from "react";
import axios from "axios";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { ExpenseLodgmentModal } from "@/components/operations/ExpenseLodgmentModal";
import { StockLodgmentModal } from "@/components/operations/StockLodgmentModal";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { TrendingUp, TrendingDown, Minus, Edit, Trash2, CheckCircle, XCircle, AlertTriangle, FileText, Zap, Brain } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

// Client-side supplier detection utility
function detectSupplier(description: string): string | null {
  if (!description) return null;
  
  const desc = description.toLowerCase();
  
  // Common Thai billers and suppliers with multiple name variations
  const supplierPatterns = [
    { patterns: ['makro', 'แม็คโคร', 'macro'], supplier: 'Makro' },
    { patterns: ['big c', 'บิ๊กซี', 'bigc'], supplier: 'Big C' },
    { patterns: ['lotus', 'โลตัส', 'tesco lotus'], supplier: 'Lotus' },
    { patterns: ['7-eleven', 'เซเว่น', '7eleven', 'seven eleven'], supplier: '7-Eleven' },
    { patterns: ['villa market', 'วิลล่า มาร์เก็ต', 'villa'], supplier: 'Villa Market' },
    { patterns: ['central', 'เซ็นทรัล'], supplier: 'Central' },
    { patterns: ['robinson', 'โรบินสัน'], supplier: 'Robinson' },
    { patterns: ['foodland', 'ฟู้ดแลนด์'], supplier: 'Foodland' },
    { patterns: ['tops', 'ท็อปส์'], supplier: 'Tops' },
    { patterns: ['gourmet market', 'กูร์เมต์ มาร์เก็ต'], supplier: 'Gourmet Market' },
    { patterns: ['shell', 'เชลล์'], supplier: 'Shell' },
    { patterns: ['ptt', 'ปตท.'], supplier: 'PTT' },
    { patterns: ['bangchak', 'บางจาก'], supplier: 'Bangchak' },
    { patterns: ['esso', 'เอสโซ่'], supplier: 'Esso' },
    { patterns: ['grab', 'แกร็บ'], supplier: 'Grab Merchant' },
    { patterns: ['lineman', 'ไลน์แมน'], supplier: 'Lineman' },
    { patterns: ['foodpanda', 'ฟู้ดแพนด้า'], supplier: 'FoodPanda' },
    { patterns: ['mr diy', 'มิสเตอร์ดี.ไอ.วาย'], supplier: 'Mr DIY' },
    { patterns: ['homepro', 'โฮมโปร'], supplier: 'HomePro' },
    { patterns: ['lazada', 'ลาซาด้า'], supplier: 'Lazada' },
    { patterns: ['dtac', 'ดีแทค'], supplier: 'DTAC' },
    { patterns: ['ais', 'เอไอเอส'], supplier: 'AIS' },
    { patterns: ['mea', 'การไฟฟ้านคร'], supplier: 'MEA' },
  ];
  
  // Check each supplier pattern
  for (const { patterns, supplier } of supplierPatterns) {
    for (const pattern of patterns) {
      if (desc.includes(pattern)) {
        return supplier;
      }
    }
  }
  
  return null;
}

// Golden Patch - Pending Transactions Review Component  
function GoldenPatchReviewSection({ onExpenseApproved }: { onExpenseApproved?: () => void }) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [selectedExpense, setSelectedExpense] = useState<any>(null);
  const [showApprovalDialog, setShowApprovalDialog] = useState(false);
  const [approvalAction, setApprovalAction] = useState<'approve' | 'reject'>('approve');
  const [approvalCategory, setApprovalCategory] = useState('');
  const [approvalSupplier, setApprovalSupplier] = useState('');
  const [approvalNotes, setApprovalNotes] = useState('');
  const [rememberDefault, setRememberDefault] = useState(false);
  const [detectedSupplier, setDetectedSupplier] = useState<string | null>(null);
  const [hasDefaults, setHasDefaults] = useState(false);
  
  // Batch rejection state
  const [selectedExpenses, setSelectedExpenses] = useState<string[]>([]);
  
  // Batch approval state for same supplier
  const [batchSupplierDetection, setBatchSupplierDetection] = useState<{
    supplier: string;
    count: number;
    category?: string;
  } | null>(null);

  // Authentication headers for Golden Patch
  const getAuthHeaders = () => ({
    'x-restaurant-id': 'smash-brothers-burgers',
    'x-user-id': 'dev-manager',
    'x-user-role': 'manager',
  });

  // Query supplier defaults
  const { data: supplierDefaults = [] } = useQuery({
    queryKey: ['/api/expenses/defaults'],
    queryFn: async () => {
      return apiRequest('/api/expenses/defaults', {
        headers: getAuthHeaders(),
      });
    },
    staleTime: 5 * 60 * 1000, // Cache for 5 minutes
  });

  // Mutation for saving supplier defaults
  const saveDefaultMutation = useMutation({
    mutationFn: async ({ supplier, defaultCategory, notesTemplate }: { supplier: string; defaultCategory: string; notesTemplate?: string }) => {
      return apiRequest('/api/expenses/defaults', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          ...getAuthHeaders(),
        },
        body: JSON.stringify({ supplier, defaultCategory, notesTemplate }),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/expenses/defaults'] });
    },
  });

  // Query pending Golden Patch expenses
  const { data: pendingExpenses = [], isLoading } = useQuery({
    queryKey: ['/api/expenses/pending'],
    queryFn: async () => {
      return apiRequest('/api/expenses/pending', {
        headers: getAuthHeaders(),
      });
    },
    refetchInterval: 10000, // Refresh every 10 seconds
  });

  // Approve expense mutation
  const approveExpenseMutation = useMutation({
    mutationFn: async ({ id, category, supplier, notes, rememberDefault }: { id: string; category: string; supplier: string; notes?: string; rememberDefault?: boolean }) => {
      return apiRequest(`/api/expenses/${id}/approve`, {
        method: 'PATCH',
        headers: { 
          'Content-Type': 'application/json',
          ...getAuthHeaders(),
        },
        body: JSON.stringify({ category, supplier, notes, rememberDefault }),
      });
    },
    onSuccess: () => {
      toast({
        title: '✅ Expense Approved',
        description: 'Expense has been added to the ledger',
      });
      queryClient.invalidateQueries({ queryKey: ['/api/expenses/pending'] });
      queryClient.invalidateQueries({ queryKey: ['/api/expensesV2'] });
      queryClient.invalidateQueries({ queryKey: ['expenseTotals'] });
      // Call the callback to refresh main expenses list
      if (onExpenseApproved) onExpenseApproved();
      setShowApprovalDialog(false);
      setSelectedExpense(null);
    },
    onError: () => {
      toast({
        title: '❌ Approval Failed',
        description: 'Failed to approve expense',
        variant: 'destructive',
      });
    },
  });

  // Reject expense mutation
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
    onError: () => {
      toast({
        title: '❌ Rejection Failed',
        description: 'Failed to reject expense',
        variant: 'destructive',
      });
    },
  });

  // Batch reject mutation
  const batchRejectMutation = useMutation({
    mutationFn: async (ids: string[]) => {
      return apiRequest('/api/expenses/batch-reject', {
        method: 'PATCH',
        headers: { 
          'Content-Type': 'application/json',
          ...getAuthHeaders(),
        },
        body: JSON.stringify({ ids }),
      });
    },
    onSuccess: (data) => {
      toast({
        title: '✅ Batch Rejection Complete',
        description: `${data.rejectedCount} expense(s) rejected successfully`,
      });
      queryClient.invalidateQueries({ queryKey: ['/api/expenses/pending'] });
      queryClient.invalidateQueries({ queryKey: ['/api/expensesV2'] });
      if (onExpenseApproved) onExpenseApproved();
      setSelectedExpenses([]);
    },
    onError: () => {
      toast({
        title: '❌ Batch Rejection Failed',
        description: 'Failed to reject selected expenses',
        variant: 'destructive',
      });
    },
  });

  // Batch selection handlers
  const toggleExpenseSelection = (expenseId: string) => {
    const newSelection = selectedExpenses.includes(expenseId) 
      ? selectedExpenses.filter(id => id !== expenseId)
      : [...selectedExpenses, expenseId];
    
    setSelectedExpenses(newSelection);
    // Detect batch supplier when selection changes
    detectBatchSupplier(newSelection);
  };

  const selectAllExpenses = () => {
    setSelectedExpenses(pendingExpenses.map((exp: any) => exp.id));
    // Detect batch supplier for bulk operations
    detectBatchSupplier(pendingExpenses.map((exp: any) => exp.id));
  };

  const clearSelection = () => {
    setSelectedExpenses([]);
    setBatchSupplierDetection(null);
  };

  // Detect if selected expenses are from same supplier
  const detectBatchSupplier = (expenseIds: string[]) => {
    const selectedExpenseData = pendingExpenses.filter((exp: any) => expenseIds.includes(exp.id));
    
    if (selectedExpenseData.length <= 1) {
      setBatchSupplierDetection(null);
      return;
    }
    
    // Check if all selected expenses have the same detected supplier
    const detectedSuppliers = selectedExpenseData.map((exp: any) => detectSupplier(exp.description)).filter(Boolean);
    const uniqueSuppliers = Array.from(new Set(detectedSuppliers));
    
    if (uniqueSuppliers.length === 1 && uniqueSuppliers[0]) {
      const supplier = uniqueSuppliers[0] as string;
      const supplierDefault = supplierDefaults.find((d: any) => d.supplier === supplier);
      
      setBatchSupplierDetection({
        supplier,
        count: detectedSuppliers.length,
        category: supplierDefault?.defaultCategory,
      });
    } else {
      setBatchSupplierDetection(null);
    }
  };

  const handleBatchReject = () => {
    if (selectedExpenses.length === 0) {
      toast({
        title: '⚠️ No Selection',
        description: 'Please select expenses to reject',
        variant: 'destructive',
      });
      return;
    }
    batchRejectMutation.mutate(selectedExpenses);
  };

  const openApprovalDialog = (expense: any, action: 'approve' | 'reject') => {
    setSelectedExpense(expense);
    setApprovalAction(action);
    
    // Smart supplier detection and auto-populate
    const detected = detectSupplier(expense.description);
    setDetectedSupplier(detected);
    
    // Find supplier defaults
    const supplierDefault = detected ? supplierDefaults.find((d: any) => d.supplier === detected) : null;
    setHasDefaults(!!supplierDefault);
    
    // Auto-populate fields
    setApprovalSupplier(detected || '');
    setApprovalCategory(supplierDefault?.defaultCategory || '');
    setApprovalNotes(supplierDefault?.notesTemplate || '');
    setRememberDefault(false);
    
    setShowApprovalDialog(true);
  };

  const handleApprovalSubmit = () => {
    if (!selectedExpense) return;
    
    if (approvalAction === 'approve') {
      if (!approvalCategory || !approvalSupplier) {
        toast({
          title: '❌ Missing Information',
          description: 'Please select category and supplier',
          variant: 'destructive',
        });
        return;
      }
      approveExpenseMutation.mutate({
        id: selectedExpense.id,
        category: approvalCategory,
        supplier: approvalSupplier,
        notes: approvalNotes,
        rememberDefault: rememberDefault,
      });
    } else {
      rejectExpenseMutation.mutate(selectedExpense.id);
    }
  };

  // Quick approve with defaults
  const handleQuickApprove = () => {
    if (!selectedExpense || !detectedSupplier) return;
    
    const supplierDefault = supplierDefaults.find((d: any) => d.supplier === detectedSupplier);
    if (!supplierDefault) return;
    
    approveExpenseMutation.mutate({
      id: selectedExpense.id,
      category: supplierDefault.defaultCategory,
      supplier: detectedSupplier,
      notes: supplierDefault.notesTemplate || '',
      rememberDefault: false, // Already has defaults
    });
  };

  // Batch approve with same supplier detection
  const handleBatchApproveWithDefaults = () => {
    if (!batchSupplierDetection || selectedExpenses.length === 0) return;
    
    const supplierDefault = supplierDefaults.find((d: any) => d.supplier === batchSupplierDetection.supplier);
    if (!supplierDefault) return;
    
    // Use existing batch approve endpoint
    batchApproveMutation.mutate({
      expenses: selectedExpenses.map(id => {
        const expense = pendingExpenses.find((e: any) => e.id === id);
        return {
          id,
          category: supplierDefault.defaultCategory,
          supplier: batchSupplierDetection.supplier,
          notes: supplierDefault.notesTemplate || '',
        };
      })
    });
  };

  // Batch approve mutation
  const batchApproveMutation = useMutation({
    mutationFn: async ({ expenses }: { expenses: any[] }) => {
      return apiRequest('/api/expenses/batch-approve', {
        method: 'PATCH',
        headers: { 
          'Content-Type': 'application/json',
          ...getAuthHeaders(),
        },
        body: JSON.stringify({ expenses }),
      });
    },
    onSuccess: (data) => {
      toast({
        title: '✅ Batch Approval Complete',
        description: `${data.approvedCount} expense(s) approved successfully`,
      });
      queryClient.invalidateQueries({ queryKey: ['/api/expenses/pending'] });
      queryClient.invalidateQueries({ queryKey: ['/api/expensesV2'] });
      if (onExpenseApproved) onExpenseApproved();
      setSelectedExpenses([]);
      setBatchSupplierDetection(null);
    },
    onError: () => {
      toast({
        title: '❌ Batch Approval Failed',
        description: 'Failed to approve selected expenses',
        variant: 'destructive',
      });
    },
  });

  const formatCurrency = (amountCents: number) => {
    return new Intl.NumberFormat('th-TH', {
      style: 'currency',
      currency: 'THB',
    }).format(amountCents / 100);
  };

  if (pendingExpenses.length === 0) {
    return null; // Don't show section if no pending expenses
  }

  return (
    <>
      {/* Golden Patch - Review Uploaded Transactions */}
      <div className="bg-white rounded-lg shadow p-4 mb-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-4">
          <div className="flex items-center gap-2">
            <FileText className="h-5 w-5 text-emerald-600" />
            <h3 className="font-semibold text-lg">Review Uploaded Transactions ({pendingExpenses.length})</h3>
            <Badge variant="outline" className="text-amber-600 border-amber-600">
              Golden Patch
            </Badge>
          </div>
          
          {pendingExpenses.length > 0 && (
            <div className="flex flex-wrap items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={selectAllExpenses}
                disabled={selectedExpenses.length === pendingExpenses.length}
                data-testid="button-select-all"
              >
                Select All ({pendingExpenses.length})
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={clearSelection}
                disabled={selectedExpenses.length === 0}
                data-testid="button-clear-selection"
              >
                Clear Selection
              </Button>
              {batchSupplierDetection && batchSupplierDetection.category && (
                <Button
                  variant="default"
                  size="sm"
                  onClick={handleBatchApproveWithDefaults}
                  disabled={batchApproveMutation.isPending}
                  className="bg-emerald-600 hover:bg-emerald-700 text-white"
                  data-testid="button-batch-approve-defaults"
                >
                  <Zap className="h-4 w-4 mr-1" />
                  {batchApproveMutation.isPending ? 'Approving...' : `Approve ${batchSupplierDetection.count} ${batchSupplierDetection.supplier} expenses`}
                </Button>
              )}
              <Button
                variant="destructive"
                size="sm"
                onClick={handleBatchReject}
                disabled={selectedExpenses.length === 0 || batchRejectMutation.isPending}
                data-testid="button-batch-reject"
              >
                {batchRejectMutation.isPending ? 'Rejecting...' : `Reject Selected (${selectedExpenses.length})`}
              </Button>
            </div>
          )}
        </div>
        
        {isLoading ? (
          <div className="text-center py-4">Loading pending transactions...</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full border text-sm">
              <thead>
                <tr className="bg-gray-100">
                  <th className="p-2 border text-center w-12">
                    <Checkbox
                      checked={selectedExpenses.length === pendingExpenses.length && pendingExpenses.length > 0}
                      onCheckedChange={(checked) => {
                        if (checked) {
                          selectAllExpenses();
                        } else {
                          clearSelection();
                        }
                      }}
                      data-testid="checkbox-select-all-header"
                    />
                  </th>
                  <th className="p-2 border text-left">Date</th>
                  <th className="p-2 border text-left">Description</th>
                  <th className="p-2 border text-right">Amount</th>
                  <th className="p-2 border text-center">Status</th>
                  <th className="p-2 border text-center">Actions</th>
                </tr>
              </thead>
              <tbody>
                {pendingExpenses.map((expense: any) => (
                  <tr key={expense.id} className="hover:bg-gray-50">
                    <td className="border p-2 text-center">
                      <Checkbox
                        checked={selectedExpenses.includes(expense.id)}
                        onCheckedChange={() => toggleExpenseSelection(expense.id)}
                        data-testid={`checkbox-expense-${expense.id}`}
                      />
                    </td>
                    <td className="border p-2">
                      {new Date(expense.date).toLocaleDateString('th-TH')}
                    </td>
                    <td className="border p-2">{expense.description}</td>
                    <td className="border p-2 text-right">
                      <span className="text-red-600">
                        {formatCurrency(expense.amountCents)}
                      </span>
                    </td>
                    <td className="border p-2 text-center">
                      <Badge variant="outline" className="text-amber-600 border-amber-600">
                        {expense.status}
                      </Badge>
                    </td>
                    <td className="border p-2 text-center">
                      <div className="flex justify-center gap-1">
                        {(() => {
                          const detected = detectSupplier(expense.description);
                          const hasDefault = detected && supplierDefaults.find((d: any) => d.supplier === detected);
                          
                          return hasDefault ? (
                            <Button
                              size="sm"
                              variant="default"
                              onClick={() => {
                                const supplierDefault = supplierDefaults.find((d: any) => d.supplier === detected);
                                if (supplierDefault) {
                                  approveExpenseMutation.mutate({
                                    id: expense.id,
                                    category: supplierDefault.defaultCategory,
                                    supplier: detected,
                                    notes: supplierDefault.notesTemplate || '',
                                  });
                                }
                              }}
                              className="h-8 px-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs"
                              data-testid={`button-quick-approve-${expense.id}`}
                            >
                              <Zap className="h-3 w-3 mr-1" />
                              Quick
                            </Button>
                          ) : (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => openApprovalDialog(expense, 'approve')}
                              className="h-8 w-8 p-0"
                              data-testid={`button-approve-${expense.id}`}
                            >
                              <CheckCircle className="h-4 w-4 text-green-600" />
                            </Button>
                          );
                        })()}
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => openApprovalDialog(expense, 'reject')}
                          className="h-8 w-8 p-0"
                          data-testid={`button-reject-${expense.id}`}
                        >
                          <XCircle className="h-4 w-4 text-red-600" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Approval Dialog */}
      <AlertDialog open={showApprovalDialog} onOpenChange={setShowApprovalDialog}>
        <AlertDialogContent data-testid="dialog-approval">
          <AlertDialogHeader>
            <AlertDialogTitle>
              {approvalAction === 'approve' ? 'Approve Uploaded Transaction' : 'Reject Uploaded Transaction'}
            </AlertDialogTitle>
            <AlertDialogDescription>
              Please review the transaction details and confirm your action.
            </AlertDialogDescription>
          </AlertDialogHeader>
          
          {selectedExpense && (
            <div className="space-y-2 p-4 bg-gray-50 rounded-md">
              <div><strong>Description:</strong> {selectedExpense.description}</div>
              <div><strong>Amount:</strong> {formatCurrency(selectedExpense.amountCents)}</div>
              <div><strong>Date:</strong> {new Date(selectedExpense.date).toLocaleDateString('th-TH')}</div>
              {detectedSupplier && (
                <div className="flex items-center gap-2 mt-2 p-2 bg-blue-50 rounded">
                  <Brain className="h-4 w-4 text-blue-600" />
                  <span className="text-sm text-blue-800">
                    <strong>Smart Detection:</strong> Detected supplier "{detectedSupplier}"
                    {hasDefaults && <span className="text-green-600 ml-2">✓ Has saved defaults</span>}
                  </span>
                </div>
              )}
            </div>
          )}
          
          {approvalAction === 'approve' && (
            <div className="space-y-4">
              <div>
                <Label htmlFor="category">Expense Category</Label>
                <Select value={approvalCategory} onValueChange={setApprovalCategory}>
                  <SelectTrigger data-testid="select-category">
                    <SelectValue placeholder="Select category" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Food & Beverage">Food & Beverage</SelectItem>
                    <SelectItem value="Staff Expenses (from Account)">Staff Expenses (from Account)</SelectItem>
                    <SelectItem value="Rent">Rent</SelectItem>
                    <SelectItem value="Administration">Administration</SelectItem>
                    <SelectItem value="Advertising - Grab">Advertising - Grab</SelectItem>
                    <SelectItem value="Advertising - Other">Advertising - Other</SelectItem>
                    <SelectItem value="Director Payment">Director Payment</SelectItem>
                    <SelectItem value="Fixtures & Fittings">Fixtures & Fittings</SelectItem>
                    <SelectItem value="Kitchen Supplies or Packaging">Kitchen Supplies or Packaging</SelectItem>
                    <SelectItem value="Marketing">Marketing</SelectItem>
                    <SelectItem value="Other">Other</SelectItem>
                    <SelectItem value="Printers">Printers</SelectItem>
                    <SelectItem value="Subscriptions">Subscriptions</SelectItem>
                    <SelectItem value="Stationary">Stationary</SelectItem>
                    <SelectItem value="Travel">Travel</SelectItem>
                    <SelectItem value="Utilities">Utilities</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="supplier">Supplier</Label>
                <Select value={approvalSupplier} onValueChange={setApprovalSupplier}>
                  <SelectTrigger data-testid="select-supplier">
                    <SelectValue placeholder="Select supplier" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Makro">Makro</SelectItem>
                    <SelectItem value="Mr DIY">Mr DIY</SelectItem>
                    <SelectItem value="Bakery">Bakery</SelectItem>
                    <SelectItem value="Big C">Big C</SelectItem>
                    <SelectItem value="Printers">Printers</SelectItem>
                    <SelectItem value="Supercheap">Supercheap</SelectItem>
                    <SelectItem value="Burger Boxes">Burger Boxes</SelectItem>
                    <SelectItem value="Cameron">Cameron</SelectItem>
                    <SelectItem value="Colin">Colin</SelectItem>
                    <SelectItem value="DTAC">DTAC</SelectItem>
                    <SelectItem value="Company Expense">Company Expense</SelectItem>
                    <SelectItem value="Gas">Gas</SelectItem>
                    <SelectItem value="GO Wholesale">GO Wholesale</SelectItem>
                    <SelectItem value="Grab Merchant">Grab Merchant</SelectItem>
                    <SelectItem value="HomePro">HomePro</SelectItem>
                    <SelectItem value="Landlord">Landlord</SelectItem>
                    <SelectItem value="Lawyer">Lawyer</SelectItem>
                    <SelectItem value="Lazada">Lazada</SelectItem>
                    <SelectItem value="Lotus">Lotus</SelectItem>
                    <SelectItem value="Loyverse">Loyverse</SelectItem>
                    <SelectItem value="MEA">MEA</SelectItem>
                    <SelectItem value="AIS">AIS</SelectItem>
                    <SelectItem value="Other">Other</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="notes">Notes (Optional)</Label>
                <Input
                  value={approvalNotes}
                  onChange={(e) => setApprovalNotes(e.target.value)}
                  placeholder="Add a note about this expense..."
                  data-testid="input-notes"
                />
              </div>
              {approvalSupplier && approvalCategory && !hasDefaults && (
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="remember-default"
                    checked={rememberDefault}
                    onCheckedChange={(checked) => setRememberDefault(checked as boolean)}
                    data-testid="checkbox-remember-default"
                  />
                  <Label htmlFor="remember-default" className="text-sm">
                    Remember as default for <strong>{approvalSupplier}</strong>
                  </Label>
                </div>
              )}
            </div>
          )}
          
          <AlertDialogFooter>
            <AlertDialogCancel data-testid="button-cancel">Cancel</AlertDialogCancel>
            {approvalAction === 'approve' && hasDefaults && detectedSupplier && (
              <Button
                onClick={handleQuickApprove}
                disabled={approveExpenseMutation.isPending}
                className="bg-emerald-600 hover:bg-emerald-700 text-white"
                data-testid="button-quick-approve-defaults"
              >
                <Zap className="h-4 w-4 mr-2" />
                Quick Approve with Defaults
              </Button>
            )}
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
    </>
  );
}

// Shift Expenses Component - Shows individual line items from Daily Sales & Stock forms
function ShiftExpensesTable({ month, year }: { month: number; year: number }) {
  const { data: shiftExpenses = [], isLoading } = useQuery({
    queryKey: ['/api/shift-expenses', month, year],
    queryFn: () => axios.get(`/api/shift-expenses?month=${month}&year=${year}`).then(res => res.data),
    staleTime: 5 * 60 * 1000, // Cache for 5 minutes
  });

  // Format currency helper
  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('th-TH', {
      style: 'currency',
      currency: 'THB',
      minimumFractionDigits: 0,
      maximumFractionDigits: 2
    }).format(amount);
  };

  if (isLoading) {
    return (
      <div className="bg-white rounded-lg shadow p-4 mb-6">
        <h2 className="text-lg font-semibold mb-4">Shift Expenses (From Daily Sales & Stock)</h2>
        <div className="text-center py-8 text-gray-500">Loading shift expenses...</div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow p-4 mb-6">
      <h2 className="text-lg font-semibold mb-4">Shift Expenses (From Daily Sales & Stock)</h2>
      
      {/* Desktop Table View */}
      <div className="hidden lg:block overflow-x-auto">
        <table className="w-full border text-sm">
          <thead>
            <tr className="bg-gray-100">
              <th className="p-3 border text-left">Date</th>
              <th className="p-3 border text-left">Supplier</th>
              <th className="p-3 border text-left">Category</th>
              <th className="p-3 border text-left">Description</th>
              <th className="p-3 border text-right">Amount</th>
            </tr>
          </thead>
          <tbody>
            {shiftExpenses.map((exp: any, i: number) => (
              <tr key={i} className="hover:bg-gray-50">
                <td className="border p-3">{new Date(exp.date).toLocaleDateString()}</td>
                <td className="border p-3">{exp.supplier}</td>
                <td className="border p-3">{exp.category}</td>
                <td className="border p-3">{exp.description}</td>
                <td className="border p-3 text-right">{formatCurrency(exp.amount || 0)}</td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="bg-gray-100 font-bold">
              <td colSpan={4} className="border p-3 text-right">Total:</td>
              <td className="border p-3 text-right">{formatCurrency(shiftExpenses.reduce((sum: number, exp: any) => sum + (exp.amount || 0), 0))}</td>
            </tr>
          </tfoot>
        </table>
      </div>

      {/* Mobile Compact Table View */}
      <div className="lg:hidden">
        <table className="w-full border text-sm">
          <thead>
            <tr className="bg-gray-100">
              <th className="p-2 border text-left">Date</th>
              <th className="p-2 border text-left">Details</th>
              <th className="p-2 border text-right">Amount</th>
            </tr>
          </thead>
          <tbody>
            {shiftExpenses.map((exp: any, i: number) => (
              <tr key={i} className="hover:bg-gray-50">
                <td className="border p-2 text-xs whitespace-nowrap">{new Date(exp.date).toLocaleDateString('en-GB', {day:'2-digit',month:'short'})}</td>
                <td className="border p-2">
                  <div className="text-sm font-medium">{exp.description}</div>
                  <div className="text-xs text-gray-600">{exp.supplier} • {exp.category}</div>
                </td>
                <td className="border p-2 text-right font-medium text-sm whitespace-nowrap">{formatCurrency(exp.amount || 0)}</td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="bg-gray-100 font-bold">
              <td colSpan={2} className="border p-2 text-right text-sm">Total:</td>
              <td className="border p-2 text-right text-sm">{formatCurrency(shiftExpenses.reduce((sum: number, exp: any) => sum + (exp.amount || 0), 0))}</td>
            </tr>
          </tfoot>
        </table>
        {shiftExpenses.length === 0 && (
          <div className="text-center py-8 text-gray-500">
            No shift expenses recorded this month
          </div>
        )}
      </div>
    </div>
  );
}

export default function Expenses() {
  const [expenses, setExpenses] = useState<any[]>([]);
  const [parsed, setParsed] = useState<any[]>([]);
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [editingExpense, setEditingExpense] = useState<any | null>(null);
  const [deleteExpenseId, setDeleteExpenseId] = useState<string | null>(null);
  
  // Month/Year selection state - default to current month
  const now = new Date();
  const [selectedMonth, setSelectedMonth] = useState(now.getMonth() + 1);
  const [selectedYear, setSelectedYear] = useState(now.getFullYear());

  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Fetch expense totals for top displays
  const { data: totals } = useQuery({
    queryKey: ['expenseTotals'],
    queryFn: () => axios.get('/api/expensesV2/totals').then(res => res.data),
    staleTime: 5 * 60 * 1000, // Cache for 5 minutes
  });

  // Delete expense mutation
  const deleteMutation = useMutation({
    mutationFn: (id: string) => {
      console.log("Deleting expense with ID:", id);
      return axios.delete(`/api/expensesV2/${id}`);
    },
    onSuccess: () => {
      toast({
        title: "Success",
        description: "Expense deleted successfully",
      });
      fetchExpenses();
      queryClient.invalidateQueries({ queryKey: ['expenseTotals'] });
    },
    onError: (error: any) => {
      console.error("Delete mutation error:", error);
      toast({
        title: "Error",
        description: error?.response?.data?.error || "Failed to delete expense",
        variant: "destructive",
      });
    },
  });

  // Delete stock item mutation
  const deleteStockMutation = useMutation({
    mutationFn: (id: string) => {
      console.log("Deleting stock item with ID:", id);
      return axios.delete(`/api/purchase-tally/${id}`);
    },
    onSuccess: () => {
      toast({
        title: "Success",
        description: "Stock item deleted successfully",
      });
      queryClient.invalidateQueries({ queryKey: ['purchase-tally'] });
    },
    onError: (error: any) => {
      console.error("Delete stock mutation error:", error);
      toast({
        title: "Error",
        description: error?.response?.data?.error || "Failed to delete stock item",
        variant: "destructive",
      });
    },
  });

  useEffect(() => { fetchExpenses(); }, [selectedMonth, selectedYear]);

  async function fetchExpenses() {
    try {
      // Fetch ONLY DIRECT expenses for monthly expenses table (excludes stock tracking and shift form entries)
      const { data } = await axios.get(`/api/expensesV2?source=DIRECT&month=${selectedMonth}&year=${selectedYear}`);
      setExpenses(data || []);
    } catch (error) {
      console.error("Failed to fetch expenses:", error);
    }
  }

  async function handleUpload(e: React.FormEvent) {
    e.preventDefault();
    if (!file) return alert("Select a file first");
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      const { data } = await axios.post("/api/expensesV2/upload", formData, { headers: { "Content-Type": "multipart/form-data" }});
      setParsed(data.parsed || []);
      setFile(null); // Clear file selection after successful upload
    } catch (error) {
      console.error("Upload failed:", error);
      alert("Upload failed. Check console for details.");
    } finally {
      setUploading(false);
    }
  }

  async function approveLine(line: any) {
    try {
      await axios.post("/api/expensesV2/approve", line);
      setParsed(parsed.filter(l => l.id !== line.id));
      fetchExpenses();
    } catch (error) {
      console.error("Approve failed:", error);
    }
  }

  function deleteLine(id: number) { 
    setParsed(parsed.filter(l => l.id !== id)); 
  }

  // Get purchase tally entries directly
  const { data: purchaseTallyData } = useQuery({
    queryKey: ["/api/purchase-tally"],
    queryFn: () => axios.get("/api/purchase-tally").then(res => res.data),
    staleTime: 5 * 60 * 1000,
  });

  // Filter helpers - ensure arrays are always defined
  const rolls = expenses ? expenses.filter((e: any) => e.description?.includes("Rolls") || (e.source === 'STOCK_LODGMENT' && e.item?.includes("Rolls"))) : [];
  const meat = (purchaseTallyData?.entries && Array.isArray(purchaseTallyData.entries)) 
    ? purchaseTallyData.entries.filter((item: any) => item.meatGrams != null && item.meatGrams > 0) : [];
  const drinks = (purchaseTallyData?.entries && Array.isArray(purchaseTallyData.entries)) 
    ? purchaseTallyData.entries.filter((item: any) => {
        try {
          const notes = typeof item.notes === 'string' ? JSON.parse(item.notes) : item.notes;
          return notes?.type === 'drinks';
        } catch (e) {
          return false;
        }
      }) : [];

  // Format currency helper
  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('th-TH', {
      style: 'currency',
      currency: 'THB',
      minimumFractionDigits: 0,
      maximumFractionDigits: 2
    }).format(amount);
  };

  // Get trend icon based on MoM percentage
  const getTrendIcon = (mom: number) => {
    if (mom > 0) return <TrendingUp className="h-4 w-4 text-red-500" />;
    if (mom < 0) return <TrendingDown className="h-4 w-4 text-green-500" />;
    return <Minus className="h-4 w-4 text-gray-500" />;
  };

  return (
    <div className="space-y-6 font-['Poppins'] text-gray-800">
      <h1 className="text-xl font-bold mb-4">Expenses</h1>

      {/* Buttons - Mobile Optimized */}
      <div className="flex flex-col sm:flex-row gap-3 sm:gap-4 mb-6">
        <ExpenseLodgmentModal 
          onSuccess={() => {
            fetchExpenses();
            queryClient.invalidateQueries({ queryKey: ['expenseTotals'] });
          }} 
          triggerClassName="px-6 py-3 rounded-lg text-sm font-medium min-h-[44px] flex items-center justify-center w-full sm:w-auto" 
        />
        <StockLodgmentModal 
          onSuccess={() => {
            queryClient.invalidateQueries({ queryKey: ["/api/expensesV2"] });
            queryClient.invalidateQueries({ queryKey: ['expenseTotals'] });
            queryClient.invalidateQueries({ queryKey: ["/api/purchase-tally"] });
            fetchExpenses();
          }} 
          triggerClassName="bg-black text-white px-6 py-3 rounded-lg text-sm font-medium hover:bg-gray-800 min-h-[44px] flex items-center justify-center w-full sm:w-auto" 
        />
      </div>

      {/* Edit Modal */}
      {editingExpense && (
        <ExpenseLodgmentModal 
          isOpen={true}
          onOpenChange={(open) => !open && setEditingExpense(null)}
          initialData={{
            date: editingExpense.date?.split('T')[0] || new Date().toISOString().split('T')[0],
            category: editingExpense.category || '',
            supplier: editingExpense.supplier || '',
            description: editingExpense.description || '',
            amount: (editingExpense.amount || 0).toString() // Already in THB from backend
          }}
          expenseId={editingExpense.id}
          onSuccess={() => {
            fetchExpenses();
            queryClient.invalidateQueries({ queryKey: ['expenseTotals'] });
            setEditingExpense(null);
          }}
        />
      )}

      {/* Month Selector */}
      <div className="bg-white rounded-lg shadow p-4 mb-6">
        <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center">
          <h2 className="text-lg font-semibold">Select Month:</h2>
          <div className="flex gap-3 flex-1">
            <Select value={selectedMonth.toString()} onValueChange={(val) => setSelectedMonth(parseInt(val))}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Month" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="1">January</SelectItem>
                <SelectItem value="2">February</SelectItem>
                <SelectItem value="3">March</SelectItem>
                <SelectItem value="4">April</SelectItem>
                <SelectItem value="5">May</SelectItem>
                <SelectItem value="6">June</SelectItem>
                <SelectItem value="7">July</SelectItem>
                <SelectItem value="8">August</SelectItem>
                <SelectItem value="9">September</SelectItem>
                <SelectItem value="10">October</SelectItem>
                <SelectItem value="11">November</SelectItem>
                <SelectItem value="12">December</SelectItem>
              </SelectContent>
            </Select>
            <Select value={selectedYear.toString()} onValueChange={(val) => setSelectedYear(parseInt(val))}>
              <SelectTrigger className="w-[120px]">
                <SelectValue placeholder="Year" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="2023">2023</SelectItem>
                <SelectItem value="2024">2024</SelectItem>
                <SelectItem value="2025">2025</SelectItem>
                <SelectItem value="2026">2026</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>

      {/* Statistics Cards - Mobile Optimized */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 mb-6">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">Month to Date</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {totals?.mtd ? formatCurrency(totals.mtd) : '฿0'}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">Year to Date</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {totals?.ytd ? formatCurrency(totals.ytd) : '฿0'}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-600 flex items-center gap-2">
              MoM Trend
              {totals?.mom && getTrendIcon(totals.mom)}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className={`text-2xl font-bold ${
              totals?.mom > 0 ? 'text-red-600' : 
              totals?.mom < 0 ? 'text-green-600' : 
              'text-gray-600'
            }`}>
              {totals?.mom ? `${totals.mom > 0 ? '+' : ''}${totals.mom}%` : '0%'}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">Top Expense Types</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-1">
              {totals?.top5?.slice(0, 3).map((item: any, idx: number) => (
                <div key={idx} className="text-xs flex justify-between">
                  <span className="truncate">{item.type}</span>
                  <span className="font-medium">{formatCurrency(item.total)}</span>
                </div>
              )) || <div className="text-xs text-gray-500">No data</div>}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Upload - Mobile Optimized */}
      <form onSubmit={handleUpload} className="mb-6">
        <div className="flex flex-col sm:flex-row gap-3">
          <input 
            type="file" 
            accept=".pdf,.csv,.png,.jpg" 
            onChange={e => setFile(e.target.files?.[0] || null)} 
            className="flex-1 p-3 border border-gray-300 rounded-lg text-sm" 
          />
          <button 
            type="submit" 
            className="bg-blue-600 text-white px-6 py-3 rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50 min-h-[44px] flex items-center justify-center whitespace-nowrap" 
            disabled={!file || uploading}
          >
            {uploading ? (
              <span className="flex items-center gap-2">
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                Processing...
              </span>
            ) : 'Upload Document'}
          </button>
        </div>
      </form>

      {/* Review Parsed */}
      {parsed.length > 0 && (
        <div className="bg-white rounded-lg shadow p-4 mb-6">
          <h3 className="font-semibold text-sm mb-2">Review Uploaded Transactions ({parsed.length})</h3>
          <div className="overflow-x-auto">
            <table className="w-full border text-sm">
              <thead>
                <tr className="bg-gray-100">
                  <th className="p-1 border text-left">Date</th>
                  <th className="p-1 border text-left">Supplier</th>
                  <th className="p-1 border text-left">Category</th>
                  <th className="p-1 border text-left">Description</th>
                  <th className="p-1 border text-right">Amount</th>
                  <th className="p-1 border text-center">Action</th>
                </tr>
              </thead>
              <tbody>
                {parsed.map((line,i)=>(
                  <tr key={i} className="hover:bg-gray-50">
                    <td className="border p-1">
                      <input defaultValue={line.date} className="border p-1 text-sm w-full" onChange={e => line.date = e.target.value} />
                    </td>
                    <td className="border p-1">
                      <input defaultValue={line.supplier} className="border p-1 text-sm w-full" onChange={e => line.supplier = e.target.value} />
                    </td>
                    <td className="border p-1">
                      <input defaultValue={line.category} className="border p-1 text-sm w-full" onChange={e => line.category = e.target.value} />
                    </td>
                    <td className="border p-1">
                      <input defaultValue={line.description} className="border p-1 text-sm w-full" onChange={e => line.description = e.target.value} />
                    </td>
                    <td className="border p-1">
                      <input defaultValue={line.amount} className="border p-1 text-sm w-full text-right" type="number" step="0.01" onChange={e => line.amount = e.target.value} />
                    </td>
                    <td className="border p-1 text-center">
                      <button onClick={()=>approveLine(line)} className="bg-green-600 text-white px-2 py-1 rounded text-xs hover:bg-green-700 mr-1">Approve</button>
                      <button onClick={()=>deleteLine(line.id)} className="bg-red-600 text-white px-2 py-1 rounded text-xs hover:bg-red-700">Delete</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Golden Patch - Review Uploaded Transactions */}
      <GoldenPatchReviewSection onExpenseApproved={fetchExpenses} />

      {/* Main Expense Table/Cards - Mobile Responsive */}
      <div className="bg-white rounded-lg shadow p-4 mb-6">
        <h2 className="text-lg font-semibold mb-4">This Month's Expenses</h2>
        
        {/* Desktop Table View */}
        <div className="hidden lg:block overflow-x-auto">
          <table className="w-full border text-sm">
            <thead>
              <tr className="bg-gray-100">
                <th className="p-3 border text-left">Date</th>
                <th className="p-3 border text-left">Supplier</th>
                <th className="p-3 border text-left">Category</th>
                <th className="p-3 border text-left">Description</th>
                <th className="p-3 border text-right">Amount</th>
                <th className="p-3 border text-center">Actions</th>
              </tr>
            </thead>
            <tbody>
              {expenses.map((exp,i)=>(
                <tr key={i} className="hover:bg-gray-50">
                  <td className="border p-3">{new Date(exp.date).toLocaleDateString()}</td>
                  <td className="border p-3">{exp.supplier}</td>
                  <td className="border p-3">{exp.category}</td>
                  <td className="border p-3">{exp.description}</td>
                  <td className="border p-3 text-right">{formatCurrency(exp.amount || 0)}</td>
                  <td className="border p-3 text-center">
                    <div className="flex justify-center gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => setEditingExpense(exp)}
                        className="h-8 w-8 p-0"
                      >
                        <Edit className="h-4 w-4" />
                      </Button>
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-8 w-8 p-0 text-red-600 hover:text-red-700"
                            disabled={deleteMutation.isPending}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Delete Expense</AlertDialogTitle>
                            <AlertDialogDescription>
                              Are you sure you want to delete "{exp.description}"? This action cannot be undone.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Cancel</AlertDialogCancel>
                            <AlertDialogAction
                              onClick={() => deleteMutation.mutate(exp.id)}
                              className="bg-red-600 hover:bg-red-700"
                            >
                              Delete
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="bg-gray-100 font-bold">
                <td colSpan={4} className="border p-3 text-right">Total:</td>
                <td className="border p-3 text-right">{formatCurrency(expenses.reduce((sum, exp) => sum + (exp.amount || 0), 0))}</td>
                <td className="border p-3"></td>
              </tr>
            </tfoot>
          </table>
        </div>

        {/* Mobile Compact Table View */}
        <div className="lg:hidden">
          <table className="w-full border text-sm">
            <thead>
              <tr className="bg-gray-100">
                <th className="p-2 border text-left">Date</th>
                <th className="p-2 border text-left">Details</th>
                <th className="p-2 border text-right">Amount</th>
                <th className="p-2 border text-center w-20">Action</th>
              </tr>
            </thead>
            <tbody>
              {expenses.map((exp,i)=>(
                <tr key={i} className="hover:bg-gray-50">
                  <td className="border p-2 text-xs whitespace-nowrap">{new Date(exp.date).toLocaleDateString('en-GB', {day:'2-digit',month:'short'})}</td>
                  <td className="border p-2">
                    <div className="text-sm font-medium">{exp.description}</div>
                    <div className="text-xs text-gray-600">{exp.supplier} • {exp.category}</div>
                  </td>
                  <td className="border p-2 text-right font-medium text-sm whitespace-nowrap">{formatCurrency(exp.amount || 0)}</td>
                  <td className="border p-2 text-center">
                    <div className="flex gap-1 justify-center">
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => setEditingExpense(exp)}
                        className="h-8 w-8 p-0"
                      >
                        <Edit className="h-3.5 w-3.5" />
                      </Button>
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-8 w-8 p-0 text-red-600"
                            disabled={deleteMutation.isPending}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent className="mx-4 max-w-sm">
                          <AlertDialogHeader>
                            <AlertDialogTitle className="text-base">Delete Expense</AlertDialogTitle>
                            <AlertDialogDescription className="text-sm">
                              Delete "{exp.description}"?
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter className="flex-row gap-2">
                            <AlertDialogCancel className="flex-1 m-0">Cancel</AlertDialogCancel>
                            <AlertDialogAction
                              onClick={() => deleteMutation.mutate(exp.id)}
                              className="bg-red-600 hover:bg-red-700 flex-1"
                            >
                              Delete
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="bg-gray-100 font-bold">
                <td colSpan={2} className="border p-2 text-right text-sm">Total:</td>
                <td className="border p-2 text-right text-sm">{formatCurrency(expenses.reduce((sum, exp) => sum + (exp.amount || 0), 0))}</td>
                <td className="border p-2"></td>
              </tr>
            </tfoot>
          </table>
          {expenses.length === 0 && (
            <div className="text-center py-8 text-gray-500">
              No expenses recorded this month
            </div>
          )}
        </div>
      </div>

      {/* Shift Expenses Table - From Daily Sales & Stock Forms */}
      <ShiftExpensesTable month={selectedMonth} year={selectedYear} />

      {/* Rolls Table */}
      <div className="bg-white rounded-lg shadow p-4 mb-6">
        <h2 className="text-lg font-semibold mb-2">Rolls Purchases</h2>
        <table className="w-full border text-sm">
          <thead>
            <tr className="bg-gray-100">
              <th className="p-1 border text-left">Date</th>
              <th className="p-1 border text-left">Quantity</th>
              <th className="p-1 border text-left">Paid</th>
              <th className="p-1 border text-right">Amount</th>
              <th className="p-1 border text-center">Actions</th>
            </tr>
          </thead>
          <tbody>
            {rolls.map((r,i)=>{
              // Parse the meta JSON to get quantity and paid status
              let quantity = "N/A";
              let paid = "N/A";
              try {
                const meta = typeof r.notes === 'string' ? JSON.parse(r.notes) : r.notes;
                quantity = meta.quantity || meta.qty || "N/A";
                paid = meta.paid ? "Yes" : "No";
              } catch (e) {
                // If parsing fails, try to extract from the raw string
                if (typeof r.notes === 'string' && r.notes.includes('qty')) {
                  const qtyMatch = r.notes.match(/"qty":\s*(\d+)/);
                  if (qtyMatch) quantity = qtyMatch[1];
                }
              }
              
              return (
                <tr key={i} className="hover:bg-gray-50">
                  <td className="border p-1">{new Date(r.date).toLocaleDateString()}</td>
                  <td className="border p-1">{quantity}</td>
                  <td className="border p-1">{paid}</td>
                  <td className="border p-1 text-right">฿{(r.amount || 0).toLocaleString()}</td>
                  <td className="border p-1 text-center">
                    <div className="flex justify-center gap-1">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => console.log('Edit roll:', r)}
                        className="h-7 w-7 p-0"
                      >
                        <Edit className="h-3 w-3" />
                      </Button>
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-7 w-7 p-0 text-red-600 hover:text-red-700"
                            disabled={deleteStockMutation.isPending}
                          >
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Delete Roll Purchase</AlertDialogTitle>
                            <AlertDialogDescription>
                              Are you sure you want to delete this roll purchase? This action cannot be undone.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Cancel</AlertDialogCancel>
                            <AlertDialogAction
                              onClick={() => deleteStockMutation.mutate(r.id)}
                              className="bg-red-600 hover:bg-red-700"
                            >
                              Delete
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </div>
                  </td>
                </tr>
              );
            })}
            {rolls.length === 0 && (
              <tr>
                <td colSpan={5} className="border p-4 text-center text-gray-500">No rolls purchases this month</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Meat Table */}
      <div className="bg-white rounded-lg shadow p-4 mb-6">
        <h2 className="text-lg font-semibold mb-2">Meat Purchases</h2>
        <table className="w-full border text-sm">
          <thead>
            <tr className="bg-gray-100">
              <th className="p-1 border text-left">Date</th>
              <th className="p-1 border text-left">Type</th>
              <th className="p-1 border text-left">Weight</th>
              <th className="p-1 border text-left">Supplier</th>
              <th className="p-1 border text-center">Actions</th>
            </tr>
          </thead>
          <tbody>
            {meat.map((m: any, i: number) => (
              <tr key={i} className="hover:bg-gray-50">
                <td className="border p-1">{new Date(m.date).toLocaleDateString()}</td>
                <td className="border p-1">{m.notes || m.meatType}</td>
                <td className="border p-1">{m.meatGrams ? (m.meatGrams / 1000).toFixed(2) + ' kg' : 'N/A'}</td>
                <td className="border p-1">{m.supplier || 'Meat Supplier'}</td>
                <td className="border p-1 text-center">
                  <div className="flex justify-center gap-1">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => console.log('Edit meat:', m)}
                      className="h-7 w-7 p-0"
                    >
                      <Edit className="h-3 w-3" />
                    </Button>
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-7 w-7 p-0 text-red-600 hover:text-red-700"
                          disabled={deleteStockMutation.isPending}
                        >
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Delete Meat Purchase</AlertDialogTitle>
                          <AlertDialogDescription>
                            Are you sure you want to delete this meat purchase ({m.notes || m.meatType})? This action cannot be undone.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancel</AlertDialogCancel>
                          <AlertDialogAction
                            onClick={() => deleteStockMutation.mutate(m.id)}
                            className="bg-red-600 hover:bg-red-700"
                          >
                            Delete
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </div>
                </td>
              </tr>
            ))}
            {meat.length === 0 && (
              <tr>
                <td colSpan={5} className="border p-4 text-center text-gray-500">No meat purchases this month</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Drinks Table */}
      <div className="bg-white rounded-lg shadow p-4 mb-6">
        <h2 className="text-lg font-semibold mb-2">Drinks Purchases</h2>
        <table className="w-full border text-sm">
          <thead>
            <tr className="bg-gray-100">
              <th className="p-1 border text-left">Date</th>
              <th className="p-1 border text-left">Type</th>
              <th className="p-1 border text-left">Quantity</th>
              <th className="p-1 border text-center">Actions</th>
            </tr>
          </thead>
          <tbody>
            {drinks.map((d: any, i: number) => {
              // Parse the meta JSON to get drink type and quantity
              let drinkType = "N/A";
              let quantity = "N/A";
              try {
                const meta = typeof d.notes === 'string' ? JSON.parse(d.notes) : d.notes;
                drinkType = meta.drinkType || "N/A";
                quantity = meta.qty || meta.quantity || "N/A";
              } catch (e) {
                // If parsing fails, use raw notes as fallback
                drinkType = d.notes || "N/A";
              }
              
              return (
                <tr key={i} className="hover:bg-gray-50">
                  <td className="border p-1">{new Date(d.date || d.created_at).toLocaleDateString()}</td>
                  <td className="border p-1">{drinkType}</td>
                  <td className="border p-1">{quantity}</td>
                  <td className="border p-1 text-center">
                    <div className="flex justify-center gap-1">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => console.log('Edit drink:', d)}
                        className="h-7 w-7 p-0"
                      >
                        <Edit className="h-3 w-3" />
                      </Button>
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-7 w-7 p-0 text-red-600 hover:text-red-700"
                            disabled={deleteStockMutation.isPending}
                          >
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Delete Drink Purchase</AlertDialogTitle>
                            <AlertDialogDescription>
                              Are you sure you want to delete this drink purchase ({drinkType})? This action cannot be undone.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Cancel</AlertDialogCancel>
                            <AlertDialogAction
                              onClick={() => deleteStockMutation.mutate(d.id)}
                              className="bg-red-600 hover:bg-red-700"
                            >
                              Delete
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </div>
                  </td>
                </tr>
              );
            })}
            {drinks.length === 0 && (
              <tr>
                <td colSpan={4} className="border p-4 text-center text-gray-500">No drinks purchases this month</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>


    </div>
  );
}