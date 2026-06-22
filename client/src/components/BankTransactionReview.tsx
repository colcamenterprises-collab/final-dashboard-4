import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Filter, Check, X, Trash2, ChevronLeft } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { formatCurrency, formatDate } from "@/lib/utils";

interface BankTransaction {
  id: string;
  postedAt: string;
  description: string;
  amountTHB: string;
  ref?: string;
  status: 'pending' | 'approved' | 'rejected' | 'deleted' | 'hold';
  category?: string;
  supplier?: string;
  transactionType?: 'business_expense' | 'personal' | 'deposit' | 'transfer' | 'ignored_duplicate' | 'needs_review';
  transactionTypeLabel?: string;
  accountingAmountTHB?: number;
  accountingDirection?: 'expense_outflow' | 'income_inflow';
  merchantSuggestion?: string | null;
  readableAction?: string;
  notes?: string;
  expenseId?: string;
}

interface ReviewPanelProps {
  batchId: string;
  onClose: () => void;
  onApproved?: () => void;
}

export function BankTransactionReview({ batchId, onClose, onApproved }: ReviewPanelProps) {
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [filters, setFilters] = useState({
    status: '',
    search: '',
    min: '',
    max: '',
  });
  const [bulkDefaults, setBulkDefaults] = useState({
    category: '',
    supplier: '',
    notes: '',
  });

  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Fetch transactions
  const { data: txnsData, isLoading } = useQuery({
    queryKey: ['/api/bank-imports', batchId, 'txns', filters],
    queryFn: () => {
      const params = new URLSearchParams();
      Object.entries(filters).forEach(([key, value]) => {
        if (value) params.append(key, value);
      });
      params.set('limit', '500');
      return apiRequest(`/api/bank-imports/${batchId}/txns?${params}`);
    },
  });

  // Approve transactions mutation
  const approveMutation = useMutation({
    mutationFn: async ({ ids, defaults }: { ids: string[]; defaults?: any }) => {
      return apiRequest(`/api/bank-imports/${batchId}/approve`, {
        method: 'POST',
        body: JSON.stringify({ ids, defaults }),
      });
    },
    onSuccess: (data) => {
      toast({
        title: data.blockers?.length ? "Approval completed with blockers" : "Transactions approved",
        description: data.blockers?.length
          ? `${data.approved} approved; ${data.blockers.length} blocked. Supplier and category are required.`
          : `${data.approved} transactions approved successfully`,
        variant: data.blockers?.length ? "destructive" : undefined,
      });
      queryClient.invalidateQueries({ queryKey: ['/api/bank-imports', batchId, 'txns'] });
      queryClient.invalidateQueries({ queryKey: ['/api/expensesV2'] });
      onApproved?.();
      setSelectedIds([]);
    },
    onError: (error: any) => {
      toast({
        title: "Approval failed",
        description: error.message || "Failed to approve transactions",
        variant: "destructive",
      });
    },
  });

  // Edit transaction mutation  
  const editMutation = useMutation({
    mutationFn: async ({ id, updates }: { id: string; updates: any }) => {
      return apiRequest(`/api/bank-imports/txns/${id}`, {
        method: 'PATCH',
        body: JSON.stringify(updates),
      });
    },
    onSuccess: () => {
      toast({
        title: "Transaction updated",
        description: "Transaction details updated successfully",
      });
      queryClient.invalidateQueries({ queryKey: ['/api/bank-imports', batchId, 'txns'] });
    },
  });

  // Delete transaction mutation
  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      return apiRequest(`/api/bank-imports/txns/${id}`, { method: 'DELETE' });
    },
    onSuccess: () => {
      toast({
        title: "Transaction deleted",
        description: "Transaction deleted successfully",
      });
      queryClient.invalidateQueries({ queryKey: ['/api/bank-imports', batchId, 'txns'] });
    },
  });

  const transactions = txnsData?.txns || [];
  const businessCategories = txnsData?.allowedBusinessCategories || [
    'Food & Beverage',
    'Kitchen Supplies & Packaging',
    'Utilities',
    'Rent',
    'Staff Expenses',
    'Repairs & Maintenance',
    'Marketing',
    'Administration',
    'Software & Subscriptions',
    'Bank Fees',
    'Equipment',
    'Fuel & Transport',
    'Other Business Expense',
  ];
  const reviewCategories = [...businessCategories, 'Personal / Owner', 'Deposit / Inflow', 'Transfer', 'Ignore / Duplicate'];
  const batchSummary = txnsData?.batch || {
    id: batchId,
    importedCount: txnsData?.pagination?.total ?? transactions.length,
    visibleCount: transactions.length,
  };

  const handleSelectTransaction = (id: string) => {
    setSelectedIds(prev => 
      prev.includes(id) 
        ? prev.filter(i => i !== id)
        : [...prev, id]
    );
  };

  const handleBulkApprove = () => {
    if (selectedIds.length === 0) return;
    
    approveMutation.mutate({
      ids: selectedIds,
      defaults: Object.fromEntries(
        Object.entries(bulkDefaults).filter(([, v]) => v)
      ),
    });
  };

  const handleBulkDelete = () => {
    if (selectedIds.length === 0) return;
    
    Promise.all(
      selectedIds.map(id => deleteMutation.mutateAsync(id))
    ).then(() => {
      setSelectedIds([]);
    });
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'approved': return 'bg-green-100 text-green-800';
      case 'rejected': return 'bg-red-100 text-red-800';
      case 'deleted': return 'bg-gray-100 text-gray-800';
      case 'hold': return 'bg-blue-100 text-blue-800';
      default: return 'bg-yellow-100 text-yellow-800';
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'approved': return 'Approved';
      case 'rejected': return 'Rejected';
      case 'deleted': return 'Deleted';
      case 'hold': return 'Hold';
      default: return 'Pending';
    }
  };

  const handleReject = (id: string) => {
    editMutation.mutate({ id, updates: { status: 'rejected' } });
  };

  const getAmountTone = (txn: BankTransaction) => {
    return txn.accountingDirection === 'income_inflow' || parseFloat(txn.amountTHB) < 0 ? 'text-green-700' : 'text-red-700';
  };

  const getAmountLabel = (txn: BankTransaction) => {
    const raw = parseFloat(txn.amountTHB);
    const amount = txn.accountingAmountTHB ?? Math.abs(raw);
    const label = raw < 0 || txn.accountingDirection === 'income_inflow' ? 'Deposit / Inflow' : 'Expense / Outflow';
    return `${label}: ${formatCurrency(amount)}`;
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" onClick={onClose}>
            <ChevronLeft className="h-4 w-4" />
            Back
          </Button>
          <div>
            <h2 className="text-xl font-semibold">Review Bank Transactions</h2>
            <p className="text-sm text-muted-foreground">
              Review and approve imported transactions
            </p>
            <p className="text-xs text-muted-foreground">
              Batch {batchSummary.id} · Imported {batchSummary.importedCount} · Visible {batchSummary.visibleCount}
            </p>
          </div>
        </div>
      </div>

      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Filter className="h-4 w-4" />
            Filters & Search
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <div>
              <Label htmlFor="search">Search Description</Label>
              <Input
                id="search"
                placeholder="Search transactions..."
                value={filters.search}
                onChange={(e) => setFilters(prev => ({ ...prev, search: e.target.value }))}
              />
            </div>
            
            <div>
              <Label htmlFor="status">Status</Label>
              <Select value={filters.status || "__all__"} onValueChange={(value) => setFilters(prev => ({ ...prev, status: value === "__all__" ? "" : value }))}>
                <SelectTrigger>
                  <SelectValue placeholder="All statuses" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__all__">All statuses</SelectItem>
                  <SelectItem value="pending">Pending</SelectItem>
                  <SelectItem value="approved">Approved</SelectItem>
                  <SelectItem value="rejected">Rejected</SelectItem>
                  <SelectItem value="deleted">Deleted</SelectItem>
                  <SelectItem value="hold_unavailable" disabled>Hold — unavailable</SelectItem>
                </SelectContent>
              </Select>
              <p className="mt-1 text-[10px] text-slate-500">Hold unavailable: bank_txn_status schema does not support hold.</p>
            </div>

            <div>
              <Label htmlFor="min">Min Amount</Label>
              <Input
                id="min"
                type="number"
                placeholder="฿0.00"
                value={filters.min}
                onChange={(e) => setFilters(prev => ({ ...prev, min: e.target.value }))}
              />
            </div>

            <div>
              <Label htmlFor="max">Max Amount</Label>
              <Input
                id="max"
                type="number"
                placeholder="฿999,999"
                value={filters.max}
                onChange={(e) => setFilters(prev => ({ ...prev, max: e.target.value }))}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Bulk Actions */}
      {selectedIds.length > 0 && (
        <Card className="border-blue-200 bg-blue-50">
          <CardContent className="pt-4">
            <div className="flex flex-col lg:flex-row gap-4 items-start lg:items-center justify-between">
              <div className="text-sm">
                <span className="font-medium">{selectedIds.length}</span> transactions selected
              </div>
              
              <div className="flex flex-col sm:flex-row gap-4">
                {/* Bulk Defaults */}
                <div className="flex flex-col sm:flex-row gap-2">
                  <Select value={bulkDefaults.category} onValueChange={(value) => setBulkDefaults(prev => ({ ...prev, category: value }))}>
                    <SelectTrigger className="w-40">
                      <SelectValue placeholder="Set category" />
                    </SelectTrigger>
                    <SelectContent>
                      {reviewCategories.map((category) => (
                        <SelectItem key={category} value={category}>{category}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  
                  <Input
                    placeholder="Set supplier"
                    className="w-32"
                    value={bulkDefaults.supplier}
                    onChange={(e) => setBulkDefaults(prev => ({ ...prev, supplier: e.target.value }))}
                  />
                </div>

                {/* Bulk Actions */}
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    onClick={handleBulkApprove}
                    disabled={approveMutation.isPending}
                    className="bg-green-600 hover:bg-green-700"
                  >
                    <Check className="h-3 w-3 mr-1" />
                    Approve All
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={handleBulkDelete}
                    disabled={deleteMutation.isPending}
                  >
                    <Trash2 className="h-3 w-3 mr-1" />
                    Delete All
                  </Button>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Transactions Review */}
      <Card>
        <CardContent className="p-3 sm:p-4">
          {isLoading ? (
            <div className="p-8 text-center">Loading transactions...</div>
          ) : transactions.length === 0 ? (
            <div className="p-8 text-center text-gray-500">
              No transactions found. Adjust your filters or upload a CSV file.
            </div>
          ) : (
            <div className="space-y-3">
              {transactions.map((txn: BankTransaction) => (
                <div key={txn.id} className="rounded-lg border border-slate-200 bg-white p-3 shadow-sm dark:border-slate-700 dark:bg-slate-900">
                  <div className="flex items-start gap-3">
                    <Checkbox
                      checked={selectedIds.includes(txn.id)}
                      onCheckedChange={() => handleSelectTransaction(txn.id)}
                      className="mt-1"
                    />
                    <div className="min-w-0 flex-1 space-y-3">
                      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                        <div className="min-w-0">
                          <div className="text-xs font-mono text-slate-500">{formatDate(txn.postedAt)}</div>
                          <div className="break-words text-sm font-semibold text-slate-900 dark:text-slate-100">{txn.description}</div>
                          {txn.ref && <div className="break-words text-[11px] text-slate-400">Ref: {txn.ref}</div>}
                        </div>
                        <div className={`text-sm font-semibold sm:text-right ${getAmountTone(txn)}`}>
                          {getAmountLabel(txn)}
                        </div>
                      </div>

                      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                        <div className="space-y-1">
                          <Label className="text-[11px]">Classification</Label>
                          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                            <Badge variant="outline" className="w-fit">{txn.transactionTypeLabel || 'Needs review'}</Badge>
                            <Select
                              value={txn.category || ''}
                              onValueChange={(category) => editMutation.mutate({ id: txn.id, updates: { category } })}
                              disabled={txn.status !== 'pending' || editMutation.isPending}
                            >
                              <SelectTrigger className="w-full sm:w-64">
                                <SelectValue placeholder="Classify transaction" />
                              </SelectTrigger>
                              <SelectContent>
                                {reviewCategories.map((category) => (
                                  <SelectItem key={category} value={category}>{category}</SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                        </div>

                        <div className="space-y-1">
                          <Label className="text-[11px]">Supplier</Label>
                          <Input
                            key={`${txn.id}:${txn.supplier || ''}`}
                            defaultValue={txn.supplier || ''}
                            placeholder={txn.merchantSuggestion || 'Required for business expenses'}
                            onBlur={(e) => editMutation.mutate({ id: txn.id, updates: { supplier: e.target.value } })}
                            disabled={txn.status !== 'pending' || editMutation.isPending}
                            className="h-9 w-full"
                          />
                          {txn.merchantSuggestion && !txn.supplier && (
                            <Button
                              type="button"
                              size="sm"
                              variant="ghost"
                              className="h-auto px-0 py-1 text-left text-xs"
                              onClick={() => editMutation.mutate({ id: txn.id, updates: { supplier: txn.merchantSuggestion } })}
                            >
                              Use suggestion: {txn.merchantSuggestion}
                            </Button>
                          )}
                        </div>
                      </div>

                      <div className="flex flex-col gap-2 border-t border-slate-100 pt-3 dark:border-slate-800 sm:flex-row sm:items-center sm:justify-between">
                        <div className="space-y-1">
                          <Badge className={getStatusColor(txn.status)}>{getStatusLabel(txn.status)}</Badge>
                          <div className="text-xs text-muted-foreground">{txn.readableAction || 'Needs review before approval.'}</div>
                        </div>

                        <div className="flex flex-wrap gap-2">
                          {txn.status === 'pending' && (
                            <>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => approveMutation.mutate({ ids: [txn.id] })}
                                disabled={approveMutation.isPending}
                                title="Approve business expense"
                              >
                                <Check className="h-3 w-3 text-green-600 mr-1" />Approve
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => handleReject(txn.id)}
                                disabled={editMutation.isPending}
                                title="Reject"
                              >
                                <X className="h-3 w-3 text-red-600 mr-1" />Reject
                              </Button>
                            </>
                          )}
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => deleteMutation.mutate(txn.id)}
                            disabled={deleteMutation.isPending}
                          >
                            <Trash2 className="h-3 w-3 text-red-600 mr-1" />Delete
                          </Button>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

    </div>
  );
}