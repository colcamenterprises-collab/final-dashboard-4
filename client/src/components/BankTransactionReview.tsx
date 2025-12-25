import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Search, Filter, Check, X, Edit2, Trash2, ChevronLeft } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { formatCurrency, formatDate } from "@/lib/utils";

interface BankTransaction {
  id: string;
  postedAt: string;
  description: string;
  amountTHB: string;
  ref?: string;
  status: 'pending' | 'approved' | 'rejected' | 'deleted';
  category?: string;
  supplier?: string;
  notes?: string;
  expenseId?: string;
}

interface ReviewPanelProps {
  batchId: string;
  onClose: () => void;
}

export function BankTransactionReview({ batchId, onClose }: ReviewPanelProps) {
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [filters, setFilters] = useState({
    status: '',
    search: '',
    min: '',
    max: '',
    month: new Date().toISOString().slice(0, 7), // YYYY-MM
  });
  const [editingTxn, setEditingTxn] = useState<BankTransaction | null>(null);
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
      return apiRequest(`/api/bank-imports/${batchId}/txns?${params}`);
    },
  });

  // Approve transactions mutation
  const approveMutation = useMutation({
    mutationFn: async ({ ids, defaults }: { ids: string[]; defaults?: any }) => {
      return apiRequest(`/api/bank-imports/${batchId}/approve`, {
        method: 'POST',
        body: { ids, defaults },
      });
    },
    onSuccess: (data) => {
      toast({
        title: "Transactions approved",
        description: `${data.approved} transactions approved successfully`,
      });
      queryClient.invalidateQueries({ queryKey: ['/api/bank-imports', batchId, 'txns'] });
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
        body: updates,
      });
    },
    onSuccess: () => {
      toast({
        title: "Transaction updated",
        description: "Transaction details updated successfully",
      });
      queryClient.invalidateQueries({ queryKey: ['/api/bank-imports', batchId, 'txns'] });
      setEditingTxn(null);
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
  const pagination = txnsData?.pagination || {};

  const handleSelectAll = () => {
    if (selectedIds.length === transactions.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(transactions.map((t: BankTransaction) => t.id));
    }
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
      default: return 'bg-yellow-100 text-yellow-800';
    }
  };

  const getAmountColor = (amount: string) => {
    const num = parseFloat(amount);
    return num > 0 ? 'text-red-600' : 'text-green-600'; // Red for expenses, green for income
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
                </SelectContent>
              </Select>
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
                      <SelectItem value="Supplies">Supplies</SelectItem>
                      <SelectItem value="Marketing">Marketing</SelectItem>
                      <SelectItem value="Utilities">Utilities</SelectItem>
                      <SelectItem value="Equipment">Equipment</SelectItem>
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

      {/* Transactions Table */}
      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-8 text-center">Loading transactions...</div>
          ) : transactions.length === 0 ? (
            <div className="p-8 text-center text-gray-500">
              No transactions found. Adjust your filters or upload a CSV file.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-12">
                      <Checkbox
                        checked={selectedIds.length === transactions.length}
                        onCheckedChange={handleSelectAll}
                      />
                    </TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead>Description</TableHead>
                    <TableHead className="text-right">Amount</TableHead>
                    <TableHead>Category</TableHead>
                    <TableHead>Supplier</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {transactions.map((txn: BankTransaction) => (
                    <TableRow key={txn.id}>
                      <TableCell>
                        <Checkbox
                          checked={selectedIds.includes(txn.id)}
                          onCheckedChange={() => handleSelectTransaction(txn.id)}
                        />
                      </TableCell>
                      <TableCell>
                        {formatDate(txn.postedAt)}
                      </TableCell>
                      <TableCell className="max-w-xs">
                        <div className="truncate" title={txn.description}>
                          {txn.description}
                        </div>
                      </TableCell>
                      <TableCell className={`text-right font-medium ${getAmountColor(txn.amountTHB)}`}>
                        {formatCurrency(parseFloat(txn.amountTHB))}
                      </TableCell>
                      <TableCell>
                        {txn.category ? (
                          <Badge variant="outline">{txn.category}</Badge>
                        ) : (
                          <span className="text-gray-400">-</span>
                        )}
                      </TableCell>
                      <TableCell>
                        {txn.supplier || <span className="text-gray-400">-</span>}
                      </TableCell>
                      <TableCell>
                        <Badge className={getStatusColor(txn.status)}>
                          {txn.status}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-1">
                          {txn.status === 'pending' && (
                            <>
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => approveMutation.mutate({ ids: [txn.id] })}
                                disabled={approveMutation.isPending}
                                className="h-7 w-7 p-0"
                              >
                                <Check className="h-3 w-3 text-green-600" />
                              </Button>
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => setEditingTxn(txn)}
                                className="h-7 w-7 p-0"
                              >
                                <Edit2 className="h-3 w-3" />
                              </Button>
                            </>
                          )}
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => deleteMutation.mutate(txn.id)}
                            disabled={deleteMutation.isPending}
                            className="h-7 w-7 p-0"
                          >
                            <X className="h-3 w-3 text-red-600" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Edit Transaction Modal would go here */}
      {/* For now, we'll keep it simple without a modal */}
    </div>
  );
}