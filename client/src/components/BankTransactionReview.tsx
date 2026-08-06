import { useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ChevronLeft, Search, Trash2 } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { formatCurrency, formatDate } from "@/lib/utils";

interface BankTransaction {
  id: string;
  batchId?: string;
  postedAt: string;
  description: string;
  amountTHB: string;
  ref?: string;
  status: 'pending' | 'approved' | 'rejected' | 'deleted' | 'hold';
  category?: string;
  supplier?: string;
  notes?: string;
  expenseId?: string;
  accountingAmountTHB?: number;
  accountingDirection?: 'expense_outflow' | 'income_inflow';
}

interface ReviewPanelProps {
  batchId?: string;
  onClose?: () => void;
  aggregateQueue?: boolean;
  onApproved?: () => void;
  compact?: boolean;
}

type ReviewView = 'review' | 'business' | 'personal' | 'all';

const BUSINESS_CATEGORIES = [
  'Review',
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

const REVIEW_CATEGORIES = [
  ...BUSINESS_CATEGORIES,
  'Personal / Owner',
  'Deposit / Inflow',
  'Transfer',
  'Ignore / Duplicate',
];

function isBusiness(category?: string) {
  return !!category && BUSINESS_CATEGORIES.includes(category);
}

export function BankTransactionReview({ batchId, onClose, aggregateQueue = false, compact = false }: ReviewPanelProps) {
  const [view, setView] = useState<ReviewView>('review');
  const [search, setSearch] = useState('');
  const [transactions, setTransactions] = useState<BankTransaction[]>([]);
  const [savingIds, setSavingIds] = useState<Set<string>>(new Set());
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const queryKey = aggregateQueue
    ? ['/api/bank-imports', 'review-queue', 'fast-exception-review']
    : ['/api/bank-imports', batchId, 'txns', 'fast-exception-review'];

  const { data, isLoading, refetch } = useQuery<any>({
    queryKey,
    queryFn: () => apiRequest(
      aggregateQueue
        ? '/api/bank-imports/review-queue?tab=all_imported&limit=1000'
        : `/api/bank-imports/${batchId}/txns?limit=1000`,
    ),
  });

  useEffect(() => {
    setTransactions(data?.txns || []);
  }, [data]);

  const counts = useMemo(() => ({
    review: transactions.filter((txn) => txn.category === 'Review' && Number(txn.amountTHB) > 0 && txn.status !== 'deleted').length,
    business: transactions.filter((txn) => isBusiness(txn.category) && txn.category !== 'Review' && txn.status !== 'deleted').length,
    personal: transactions.filter((txn) => txn.category === 'Personal / Owner' && txn.status !== 'deleted').length,
    all: transactions.filter((txn) => txn.status !== 'deleted').length,
  }), [transactions]);

  const visibleTransactions = useMemo(() => {
    const needle = search.trim().toLowerCase();
    return transactions.filter((txn) => {
      if (txn.status === 'deleted') return false;
      if (view === 'review' && txn.category !== 'Review') return false;
      if (view === 'business' && (!isBusiness(txn.category) || txn.category === 'Review')) return false;
      if (view === 'personal' && txn.category !== 'Personal / Owner') return false;
      if (needle && !`${txn.description} ${txn.supplier || ''} ${txn.ref || ''}`.toLowerCase().includes(needle)) return false;
      return true;
    });
  }, [transactions, view, search]);

  const updateLocal = (id: string, updates: Partial<BankTransaction>) => {
    setTransactions((current) => current.map((txn) => txn.id === id ? { ...txn, ...updates } : txn));
  };

  const saveTransaction = async (txn: BankTransaction, updates: Record<string, unknown>) => {
    if (savingIds.has(txn.id)) return;
    const previous = { ...txn };
    updateLocal(txn.id, updates as Partial<BankTransaction>);
    setSavingIds((current) => new Set(current).add(txn.id));

    try {
      const result = await apiRequest(`/api/finance/bank-imports/txns/${encodeURIComponent(txn.id)}`, {
        method: 'PATCH',
        body: JSON.stringify(updates),
      });
      if (result?.txn) updateLocal(txn.id, result.txn);

      if ('category' in updates) {
        // Refresh reporting in the background; the row remains instantly usable.
        queryClient.invalidateQueries({ queryKey: ['/api/finance/expenses-dashboard'] });
        queryClient.invalidateQueries({ queryKey: ['/api/bank-imports/review-queue', 'personal_owner'] });
      }
    } catch (error: any) {
      updateLocal(txn.id, previous);
      toast({
        title: 'Could not save transaction',
        description: error?.message || 'The change was reverted.',
        variant: 'destructive',
      });
    } finally {
      setSavingIds((current) => {
        const next = new Set(current);
        next.delete(txn.id);
        return next;
      });
    }
  };

  const deleteTransaction = async (txn: BankTransaction) => {
    if (savingIds.has(txn.id)) return;
    setSavingIds((current) => new Set(current).add(txn.id));
    try {
      await apiRequest(`/api/finance/bank-imports/txns/${encodeURIComponent(txn.id)}`, { method: 'DELETE' });
      setTransactions((current) => current.filter((row) => row.id !== txn.id));
      queryClient.invalidateQueries({ queryKey: ['/api/finance/expenses-dashboard'] });
    } catch (error: any) {
      toast({
        title: 'Delete failed',
        description: error?.message || 'Failed to delete transaction',
        variant: 'destructive',
      });
    } finally {
      setSavingIds((current) => {
        const next = new Set(current);
        next.delete(txn.id);
        return next;
      });
    }
  };

  const amountLabel = (txn: BankTransaction) => {
    const raw = Number(txn.amountTHB);
    const amount = txn.accountingAmountTHB ?? Math.abs(raw);
    return `${raw < 0 ? 'Deposit' : 'Expense'}: ${formatCurrency(amount)}`;
  };

  return (
    <div className={compact ? 'space-y-3' : 'space-y-5'}>
      {!compact && (
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            {onClose && (
              <Button variant="ghost" size="sm" onClick={onClose}>
                <ChevronLeft className="mr-1 h-4 w-4" /> Back
              </Button>
            )}
            <div>
              <h2 className="text-xl font-semibold">Expense Review</h2>
              <p className="text-sm text-muted-foreground">
                Statement withdrawals are already Business Expenses. Categorise them or mark the exceptions Personal.
              </p>
            </div>
          </div>
          <Button variant="outline" size="sm" onClick={() => refetch()}>Refresh</Button>
        </div>
      )}

      <Card className="border-slate-200">
        <CardContent className="p-3 sm:p-4">
          <div className="flex flex-wrap items-center gap-2">
            <Button size="sm" variant={view === 'review' ? 'default' : 'outline'} onClick={() => setView('review')}>
              Review ({counts.review})
            </Button>
            <Button size="sm" variant={view === 'business' ? 'default' : 'outline'} onClick={() => setView('business')}>
              Categorised ({counts.business})
            </Button>
            <Button size="sm" variant={view === 'personal' ? 'default' : 'outline'} onClick={() => setView('personal')}>
              Personal ({counts.personal})
            </Button>
            <Button size="sm" variant={view === 'all' ? 'default' : 'outline'} onClick={() => setView('all')}>
              All ({counts.all})
            </Button>
            <div className="relative ml-auto min-w-[220px] flex-1 sm:max-w-xs">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-slate-400" />
              <Input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search statement..." className="pl-8" />
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="rounded-md border border-green-200 bg-green-50 px-3 py-2 text-xs text-green-900">
        Reporting is not waiting for this review. Items in <strong>Review</strong> are already included as Business Expenses; marking an item <strong>Personal</strong> removes it from business reporting.
      </div>

      {isLoading ? (
        <Card><CardContent className="p-8 text-center text-sm text-muted-foreground">Loading transactions...</CardContent></Card>
      ) : visibleTransactions.length === 0 ? (
        <Card><CardContent className="p-8 text-center text-sm text-muted-foreground">No transactions in this view.</CardContent></Card>
      ) : (
        <div className="space-y-2">
          {visibleTransactions.map((txn) => {
            const isSaving = savingIds.has(txn.id);
            const isPersonal = txn.category === 'Personal / Owner';
            const isDeposit = Number(txn.amountTHB) < 0;
            return (
              <Card key={txn.id} className={isPersonal ? 'border-orange-200' : 'border-slate-200'}>
                <CardContent className="p-3 sm:p-4">
                  <div className="grid gap-3 xl:grid-cols-[140px_minmax(220px,1fr)_240px_180px_auto] xl:items-center">
                    <div>
                      <div className="text-xs text-slate-500">{formatDate(txn.postedAt)}</div>
                      <div className={`text-sm font-semibold ${isDeposit ? 'text-green-700' : 'text-red-700'}`}>{amountLabel(txn)}</div>
                      {isSaving && <div className="text-[10px] text-slate-400">Saving...</div>}
                    </div>

                    <div className="min-w-0">
                      <Label className="text-[10px] text-slate-500">Statement Payee / Description</Label>
                      <Input
                        key={`${txn.id}:${txn.description}`}
                        defaultValue={txn.description}
                        className="h-8"
                        onBlur={(event) => {
                          const description = event.target.value.trim();
                          if (description && description !== txn.description) saveTransaction(txn, { description });
                        }}
                      />
                      {txn.ref && <div className="mt-1 truncate text-[10px] text-slate-400">Ref: {txn.ref}</div>}
                    </div>

                    <div>
                      <Label className="text-[10px] text-slate-500">Purpose / Supplier</Label>
                      <Input
                        key={`${txn.id}:${txn.supplier || ''}`}
                        defaultValue={txn.supplier || txn.description}
                        className="h-8"
                        onBlur={(event) => {
                          const supplier = event.target.value.trim();
                          if (supplier !== (txn.supplier || txn.description)) saveTransaction(txn, { supplier });
                        }}
                      />
                    </div>

                    <div>
                      <Label className="text-[10px] text-slate-500">Category</Label>
                      <Select
                        value={txn.category || (isDeposit ? 'Deposit / Inflow' : 'Review')}
                        onValueChange={(category) => saveTransaction(txn, { category })}
                        disabled={isSaving}
                      >
                        <SelectTrigger className="h-8">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {REVIEW_CATEGORIES.map((category) => (
                            <SelectItem key={category} value={category}>{category}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="flex flex-wrap items-center justify-end gap-2">
                      <Badge variant={isPersonal ? 'destructive' : txn.category === 'Review' ? 'secondary' : 'outline'}>
                        {isPersonal ? 'Personal' : txn.category || 'Review'}
                      </Badge>
                      {!isDeposit && !isPersonal && (
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={isSaving}
                          onClick={() => saveTransaction(txn, { category: 'Personal / Owner' })}
                        >
                          Personal
                        </Button>
                      )}
                      {isPersonal && (
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={isSaving}
                          onClick={() => saveTransaction(txn, { category: 'Review' })}
                        >
                          Business
                        </Button>
                      )}
                      <Button size="icon" variant="ghost" disabled={isSaving} onClick={() => deleteTransaction(txn)} title="Delete transaction">
                        <Trash2 className="h-4 w-4 text-red-600" />
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
