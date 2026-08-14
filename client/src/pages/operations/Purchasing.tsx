/**
 * 🔒 CANONICAL PURCHASING FLOW (CONTROL PANEL)
 * purchasing_items → Form 2 → purchasing_shift_items → Shopping List
 *
 * RULES:
 * - This is the MASTER control panel for all purchasing items
 * - Deactivating an item removes it from Form 2 but keeps historical data
 * - Editing unit cost updates Shopping List estimates and analytics
 * - NO duplicates, NO missing fields
 */
import { useState, useEffect } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { useSearchParams } from 'react-router-dom';
import { queryClient } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from '@/components/ui/table';
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogFooter 
} from '@/components/ui/dialog';
import { Plus, Pencil, Trash2, Search, Download, Upload, CheckCircle, XCircle, AlertTriangle } from 'lucide-react';
import {
  CANONICAL_PURCHASING_CATEGORIES,
  isCanonicalPurchasingCategory,
} from '../../../../shared/purchasingCategories';

type PurchasingItem = {
  id: number;
  item: string;
  category: string | null;
  supplierName: string | null;
  brand: string | null;
  supplierSku: string | null;
  orderUnit: string | null;
  unitDescription: string | null;
  purchaseUnitLabel: string | null;
  unitCost: number | null;
  catalogueCode: string | null;
  purchaseQuantity: number | null;
  baseUnit: string | null;
  purchaseCostThb: number | null;
  reviewNotes: string | null;
  lastReviewDate: string | null;
  active: boolean;
  portionUnit: string | null;
  portionSize: number | null;
  yield: number | null;
  createdAt: string;
  updatedAt: string;
};



const isLegacyCategory = (category: string | null | undefined): boolean => {
  if (!category) return false;
  return !isCanonicalPurchasingCategory(category);
};

const thb = (v: unknown): string => {
  const n = typeof v === "number" && Number.isFinite(v) ? v : Number(v) || 0;
  return "฿" + n.toLocaleString("en-TH", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
};

const displayText = (value: string | null | undefined): string => {
  const normalized = value?.trim();
  return normalized ? normalized : "—";
};

const getSizePack = (item: PurchasingItem): string => {
  return item.purchaseQuantity ? `${item.purchaseQuantity} ${item.baseUnit || item.orderUnit || ''}`.trim() : displayText(item.purchaseUnitLabel || item.unitDescription || item.orderUnit);
};

export default function PurchasingPage() {
  const { toast } = useToast();
  const [searchParams, setSearchParams] = useSearchParams();
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'inactive'>('active');
  const [showDialog, setShowDialog] = useState(false);
  const [editingItem, setEditingItem] = useState<PurchasingItem | null>(null);
  const [deleteId, setDeleteId] = useState<number | null>(null);
  const [recipeReference, setRecipeReference] = useState<{ id: number; item: string; recipes: Array<{ id: number; name: string }> } | null>(null);
  const [showCostWarning, setShowCostWarning] = useState(false);
  const [pendingCostUpdate, setPendingCostUpdate] = useState<{ id: number; oldCost: number | null; newCost: number } | null>(null);
  const [apiWarning, setApiWarning] = useState<string | null>(null);
  const [categoryError, setCategoryError] = useState<string | null>(null);

  // Handle warning from recipe-management redirect
  useEffect(() => {
    const warning = searchParams.get('warning');
    if (warning === 'recipe-api-failed') {
      setApiWarning('Recipe Management API unavailable. Please check server logs or try again later.');
      setSearchParams({}, { replace: true });
    }
  }, [searchParams, setSearchParams]);

  const { data, isLoading } = useQuery({
    queryKey: ['purchasing-items'],
    queryFn: async () => {
      const res = await fetch('/api/purchasing-items', { credentials: 'include' });
      return res.json();
    },
  });

  const createMutation = useMutation({
    mutationFn: async (item: Partial<PurchasingItem>) => {
      const res = await fetch('/api/purchasing-items', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(item),
      });
      if (!res.ok) throw new Error('Failed to create item');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['purchasing-items'] });
      setShowDialog(false);
      setEditingItem(null);
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: number; data: Partial<PurchasingItem> }) => {
      const res = await fetch(`/api/purchasing-items/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error('Failed to update item');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['purchasing-items'] });
      setShowDialog(false);
      setEditingItem(null);
    },
  });

  const toggleActiveMutation = useMutation({
    mutationFn: async ({ id, active }: { id: number; active: boolean }) => {
      const res = await fetch(`/api/purchasing-items/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ active }),
      });
      if (!res.ok) throw new Error('Failed to toggle item');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['purchasing-items'] });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      const res = await fetch(`/api/purchasing-items/${id}`, {
        method: 'DELETE',
        credentials: 'include',
      });
      const body = await res.json();
      if (!res.ok) {
        const error = new Error(body.error || 'Failed to delete item') as Error & {
          code?: string;
          linkedRecipes?: Array<{ id: number; name: string }>;
          item?: string;
        };
        error.code = body.code;
        error.linkedRecipes = body.linkedRecipes;
        error.item = body.item;
        throw error;
      }
      return body;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['purchasing-items'] });
      setDeleteId(null);
    },
    onError: (err: Error & { code?: string; linkedRecipes?: Array<{ id: number; name: string }>; item?: string }) => {
      if (err.code === 'RECIPE_REFERENCE_EXISTS') {
        setRecipeReference({ id: deleteId!, item: err.item || 'This item', recipes: err.linkedRecipes || [] });
        setDeleteId(null);
        return;
      }
      alert(err.message);
      setDeleteId(null);
    },
  });

  const items: PurchasingItem[] = data?.items || [];

  const activeCount = items.filter(i => i.active).length;
  const inactiveCount = items.filter(i => !i.active).length;
  const categories = Array.from(new Set(items.map(i => i.category).filter(Boolean)));

  const filteredItems = items.filter(item => {
    const matchesSearch = !search || 
      item.item?.toLowerCase().includes(search.toLowerCase()) ||
      item.brand?.toLowerCase().includes(search.toLowerCase()) ||
      item.supplierName?.toLowerCase().includes(search.toLowerCase()) ||
      item.category?.toLowerCase().includes(search.toLowerCase());
    
    const matchesCategory = !categoryFilter || item.category === categoryFilter;
    
    const matchesStatus = 
      statusFilter === 'all' ? true :
      statusFilter === 'active' ? item.active :
      !item.active;
    
    return matchesSearch && matchesCategory && matchesStatus;
  });

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const newCost = formData.get('purchaseCostThb') ? parseFloat(formData.get('purchaseCostThb') as string) : null;
    const selectedCategory = (formData.get('category') as string) || '';

    if (!isCanonicalPurchasingCategory(selectedCategory)) {
      setCategoryError('Please choose a canonical category before saving.');
      return;
    }
    setCategoryError(null);

    const data = {
      item: formData.get('item') as string,
      category: selectedCategory,
      supplierName: formData.get('supplierName') as string || null,
      brand: formData.get('brand') as string || null,
      supplierSku: formData.get('supplierSku') as string || null,
      purchaseUnitLabel: formData.get('purchaseUnitLabel') as string || null,
      orderUnit: formData.get('orderUnit') as string || null,
      unitDescription: formData.get('unitDescription') as string || null,
      purchaseCostThb: newCost,
      unitCost: newCost,
      purchaseQuantity: formData.get('purchaseQuantity') ? parseFloat(formData.get('purchaseQuantity') as string) : null,
      baseUnit: formData.get('baseUnit') as string || null,
      reviewNotes: formData.get('reviewNotes') as string || null,
      lastReviewDate: formData.get('lastReviewDate') as string || null,
      active: (formData.get('active') as string) === 'true',
    };

    if (editingItem && editingItem.unitCost !== newCost && newCost !== null && editingItem.unitCost !== null) {
      const costChange = newCost - editingItem.unitCost;
      if (Math.abs(costChange) > 10) {
        setPendingCostUpdate({ id: editingItem.id, oldCost: editingItem.unitCost, newCost });
        setShowCostWarning(true);
        return;
      }
    }

    if (editingItem) {
      updateMutation.mutate({ id: editingItem.id, data });
    } else {
      createMutation.mutate({ ...data, active: true });
    }
  };

  const confirmCostUpdate = () => {
    if (pendingCostUpdate && editingItem) {
      const formEl = document.querySelector('form');
      if (formEl) {
        const formData = new FormData(formEl);
        const selectedCategory = (formData.get('category') as string) || '';
        if (!isCanonicalPurchasingCategory(selectedCategory)) {
          setCategoryError('Please choose a canonical category before saving.');
          return;
        }
        setCategoryError(null);

        const data = {
          item: formData.get('item') as string,
          category: selectedCategory,
          supplierName: formData.get('supplierName') as string || null,
          brand: formData.get('brand') as string || null,
          supplierSku: formData.get('supplierSku') as string || null,
          purchaseUnitLabel: formData.get('purchaseUnitLabel') as string || null,
          orderUnit: formData.get('orderUnit') as string || null,
          unitDescription: formData.get('unitDescription') as string || null,
          catalogueCode: formData.get('catalogueCode') as string || null,
          purchaseCostThb: pendingCostUpdate.newCost,
          unitCost: pendingCostUpdate.newCost,
          purchaseQuantity: formData.get('purchaseQuantity') ? parseFloat(formData.get('purchaseQuantity') as string) : null,
          baseUnit: formData.get('baseUnit') as string || null,
          reviewNotes: formData.get('reviewNotes') as string || null,
          lastReviewDate: formData.get('lastReviewDate') as string || null,
          active: (formData.get('active') as string) === 'true',
        };
        updateMutation.mutate({ id: editingItem.id, data });
      }
    }
    setShowCostWarning(false);
    setPendingCostUpdate(null);
  };

  return (
    <div className="p-4">
      {apiWarning && (
        <Alert variant="destructive" className="mb-4 rounded-[4px]" data-testid="alert-api-warning">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>Recipe Management Unavailable</AlertTitle>
          <AlertDescription className="flex justify-between items-center">
            <span>{apiWarning}</span>
            <Button 
              variant="ghost" 
              size="sm" 
              onClick={() => setApiWarning(null)}
              className="text-xs"
            >
              Dismiss
            </Button>
          </AlertDescription>
        </Alert>
      )}
      <div className="mb-3">
        <h1 className="text-lg font-bold text-slate-900 mb-0.5">Purchasing Items</h1>
        <p className="text-[11px] text-slate-600">Master item database. Changes here affect Form 2, Daily Shopping List, and Analytics.</p>
        <p className="text-[11px] text-slate-400 mt-0.5">Source: purchasing_items</p>
      </div>

      <div className="flex gap-2 mb-3">
        <Card className="px-3 py-2 rounded-[4px] border-slate-200 flex items-center gap-1.5">
          <CheckCircle className="h-3.5 w-3.5 text-emerald-600" />
          <span className="text-xs font-medium text-slate-900">{activeCount}</span>
          <span className="text-[11px] text-slate-600">Active</span>
        </Card>
        <Card className="px-3 py-2 rounded-[4px] border-slate-200 flex items-center gap-1.5">
          <XCircle className="h-3.5 w-3.5 text-slate-400" />
          <span className="text-xs font-medium text-slate-900">{inactiveCount}</span>
          <span className="text-[11px] text-slate-600">Inactive</span>
        </Card>
        <Card className="px-3 py-2 rounded-[4px] border-slate-200 flex items-center gap-1.5">
          <span className="text-xs font-medium text-slate-900">{items.length}</span>
          <span className="text-[11px] text-slate-600">Total Items</span>
        </Card>
      </div>

      <Card className="p-3 mb-3 rounded-[4px] border-slate-200">
        <div className="space-y-2">
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
            <Input
              data-testid="input-search"
              placeholder="Search items, brands, suppliers..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-8 text-xs h-8 rounded-[4px] border-slate-200"
            />
          </div>
          <div className="flex gap-2">
            <select
              data-testid="select-category-filter"
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              className="text-xs h-8 px-2 py-0 border border-slate-200 rounded-[4px] bg-white flex-1 min-w-0"
            >
              <option value="">All Categories</option>
              {categories.map(cat => (
                <option key={cat} value={cat || ''}>{cat}</option>
              ))}
            </select>
            <select
              data-testid="select-status-filter"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as 'all' | 'active' | 'inactive')}
              className="text-xs h-8 px-2 py-0 border border-slate-200 rounded-[4px] bg-white flex-1 min-w-0"
            >
              <option value="active">Active Only</option>
              <option value="inactive">Inactive Only</option>
              <option value="all">All Items</option>
            </select>
          </div>
          <div className="flex gap-2 flex-wrap">
            <Button
              data-testid="button-add-item"
              onClick={() => {
                setEditingItem(null);
                setCategoryError(null);
                setShowDialog(true);
              }}
              className="bg-emerald-600 hover:bg-emerald-700 text-xs h-8 px-3 rounded-[4px]"
            >
              <Plus className="h-3.5 w-3.5 mr-1" />
              Add Item
            </Button>
            <a
              href="/api/purchasing-items/export/csv"
              download="purchasing-items-export.csv"
              data-testid="button-export-csv"
              className="inline-flex items-center justify-center whitespace-nowrap font-medium transition-colors border border-slate-200 bg-transparent shadow-sm hover:bg-accent hover:text-accent-foreground h-8 px-3 text-xs rounded-[4px]"
              onClick={() => {
                toast({
                  title: "Export Started",
                  description: "Your CSV file is downloading.",
                });
              }}
            >
              <Download className="h-3.5 w-3.5 mr-1" />
              Export CSV
            </a>
            <label>
              <input
                type="file"
                accept=".csv"
                className="hidden"
                onChange={async (e) => {
                  const file = e.target.files?.[0];
                  if (!file) return;
                  const text = await file.text();
                  const parseCsvLine = (line: string) => {
                    const values: string[] = []; let value = ''; let quoted = false;
                    for (let i = 0; i < line.length; i++) {
                      const char = line[i];
                      if (char === '"' && line[i + 1] === '"') { value += '"'; i++; }
                      else if (char === '"') quoted = !quoted;
                      else if (char === ',' && !quoted) { values.push(value.trim()); value = ''; }
                      else value += char;
                    }
                    values.push(value.trim()); return values;
                  };
                  const lines = text.replace(/^\uFEFF/, '').split(/\r?\n/);
                  const headers = parseCsvLine(lines[0] || '');
                  const csvData: Record<string, string>[] = [];
                  for (let i = 1; i < lines.length; i++) {
                    if (!lines[i].trim()) continue;
                    const values = parseCsvLine(lines[i]);
                    const row: Record<string, string> = {};
                    headers.forEach((h, idx) => { row[h] = values[idx] || ''; });
                    csvData.push(row);
                  }
                  const res = await fetch('/api/purchasing-items/import/csv', {
                    method: 'POST',
                    credentials: 'include',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ csvData, archiveMissing: window.confirm('Make this uploaded catalogue the active list? Items no longer in it will be archived, not deleted.') }),
                  });
                  const result = await res.json();
                  if (result.ok) {
                    queryClient.invalidateQueries({ queryKey: ['purchasing-items'] });
                    alert(`Imported: ${result.inserted} new, ${result.updated} updated`);
                  } else {
                    alert('Import failed: ' + (result.error || 'Unknown error'));
                  }
                  e.target.value = '';
                }}
              />
              <Button
                data-testid="button-import-csv"
                variant="outline"
                className="text-xs h-8 px-3 rounded-[4px] border-slate-200"
                asChild
              >
                <span>
                  <Upload className="h-3.5 w-3.5 mr-1" />
                  Import CSV
                </span>
              </Button>
            </label>
          </div>
        </div>
      </Card>

      {isLoading ? (
        <div className="text-xs text-slate-600">Loading...</div>
      ) : (
        <Card className="rounded-[4px] border-slate-200 overflow-hidden">
          <div className="overflow-x-auto">
            <Table className="w-full min-w-[760px] table-fixed text-[10px]">
              <TableHeader>
                <TableRow className="border-slate-200">
                  <TableHead className="w-[24%] px-2 py-1.5 text-[10px] font-medium text-slate-900">Item / brand</TableHead>
                  <TableHead className="w-[17%] px-2 py-1.5 text-[10px] font-medium text-slate-900">Supplier / SKU</TableHead>
                  <TableHead className="w-[12%] px-2 py-1.5 text-[10px] font-medium text-slate-900">Pack</TableHead>
                  <TableHead className="w-[12%] px-1 py-1.5 text-right text-[10px] font-medium text-slate-900">Cost</TableHead>
                  <TableHead className="w-[12%] px-1 py-1.5 text-right text-[10px] font-medium text-slate-900">Cost/unit</TableHead>
                  <TableHead className="w-[11%] px-1 py-1.5 text-[10px] font-medium text-slate-900">Category</TableHead>
                  <TableHead className="w-[6%] px-1 py-1.5 text-center text-[10px] font-medium text-slate-900">On</TableHead>
                  <TableHead className="w-[6%] px-1 py-1.5 text-center text-[10px] font-medium text-slate-900">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredItems.map((item) => {
                  const purchaseCost = item.purchaseCostThb ?? item.unitCost;
                  const quantity = Number(item.purchaseQuantity);
                  const costPerUnit = purchaseCost !== null && Number.isFinite(quantity) && quantity > 0
                    ? Number(purchaseCost) / quantity : null;
                  return (
                    <TableRow key={item.id} className={`border-slate-200 ${!item.active ? 'bg-slate-50 opacity-50' : ''}`} data-testid={`row-item-${item.id}`}>
                      <TableCell className="truncate px-2 py-1.5 text-[10px] text-slate-900" title={item.item}>
                        <div className="truncate font-medium">{item.item}</div>
                        <div className="truncate text-[9px] text-slate-500">{displayText(item.brand)}</div>
                      </TableCell>
                      <TableCell className="truncate px-2 py-1.5 text-[10px] text-slate-600">
                        <div className="truncate" title={item.supplierName || ''}>{displayText(item.supplierName)}</div>
                        <div className="truncate text-[9px] text-slate-400" title={item.supplierSku || ''}>{displayText(item.supplierSku)}</div>
                      </TableCell>
                      <TableCell className="truncate px-2 py-1.5 text-[10px] text-slate-600">{item.purchaseQuantity ?? '—'} {item.baseUnit || item.orderUnit || ''}</TableCell>
                      <TableCell className="px-1 py-1.5 text-right text-[10px] font-medium text-slate-900">{purchaseCost !== null ? thb(purchaseCost) : <span className="text-amber-600">Missing</span>}</TableCell>
                      <TableCell className="px-1 py-1.5 text-right text-[10px] text-slate-600">{costPerUnit === null ? '—' : thb(costPerUnit)}</TableCell>
                      <TableCell className="truncate px-1 py-1.5 text-[10px] text-slate-600" title={item.category || ''}>{item.category || '—'}</TableCell>
                      <TableCell className="px-1 py-1.5 text-center"><Switch data-testid={`switch-active-${item.id}`} checked={item.active} onCheckedChange={(active) => toggleActiveMutation.mutate({ id: item.id, active })} disabled={toggleActiveMutation.isPending} className="scale-[0.62]" /></TableCell>
                      <TableCell className="px-1 py-1.5"><div className="flex justify-center gap-0.5">
                        <Button data-testid={`button-edit-${item.id}`} variant="outline" size="sm" onClick={() => { setEditingItem(item); setCategoryError(null); setShowDialog(true); }} className="h-6 w-6 border-emerald-200 p-0 text-emerald-600 hover:bg-emerald-50"><Pencil className="h-3 w-3" /></Button>
                        <Button data-testid={`button-delete-${item.id}`} variant="outline" size="sm" onClick={() => setDeleteId(item.id)} className="h-6 w-6 border-red-200 p-0 text-red-600 hover:bg-red-50"><Trash2 className="h-3 w-3" /></Button>
                      </div></TableCell>
                    </TableRow>
                  );
                })}
                {filteredItems.length === 0 && <TableRow><TableCell colSpan={8} className="py-6 text-center text-[11px] text-slate-600">No items found</TableCell></TableRow>}
              </TableBody>
            </Table>
          </div>
        </Card>
      )}

      <div className="mt-2 text-[11px] text-slate-500">
        Showing {filteredItems.length} of {items.length} items
      </div>

      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="text-xl">
              {editingItem ? 'Edit Item' : 'Add New Item'}
            </DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit}>
            <div className="grid grid-cols-2 gap-4 py-4">
              <div className="col-span-2">
                <label className="text-xs font-medium text-slate-900 mb-1 block">
                  Item Name <span className="text-red-600">*</span>
                </label>
                <Input
                  data-testid="input-item-name"
                  name="item"
                  defaultValue={editingItem?.item || ''}
                  required
                  className="text-xs rounded-[4px] border-slate-200"
                />
              </div>
              <div>
                <label className="text-xs font-medium text-slate-900 mb-1 block">Category</label>
                {editingItem && isLegacyCategory(editingItem.category) && (
                  <p className="text-[11px] text-amber-700 mb-1">
                    Legacy: {editingItem.category}
                  </p>
                )}
                <select
                  data-testid="select-category"
                  name="category"
                  defaultValue={editingItem && isCanonicalPurchasingCategory(editingItem.category) ? editingItem.category : ''}
                  required
                  className="text-xs h-9 px-2 py-0 border border-slate-200 rounded-[4px] bg-white w-full"
                >
                  <option value="" disabled>Select category</option>
                  {CANONICAL_PURCHASING_CATEGORIES.map((category) => (
                    <option key={category} value={category}>{category}</option>
                  ))}
                </select>
                {categoryError && (
                  <p className="text-[11px] text-red-600 mt-1">{categoryError}</p>
                )}
              </div>
              <div>
                <label className="text-xs font-medium text-slate-900 mb-1 block">Supplier</label>
                <Input
                  data-testid="input-supplier"
                  name="supplierName"
                  defaultValue={editingItem?.supplierName || ''}
                  className="text-xs rounded-[4px] border-slate-200"
                />
              </div>
              <div>
                <label className="text-xs font-medium text-slate-900 mb-1 block">Brand</label>
                <Input
                  data-testid="input-brand"
                  name="brand"
                  defaultValue={editingItem?.brand || ''}
                  className="text-xs rounded-[4px] border-slate-200"
                />
              </div>
              <div>
                <label className="text-xs font-medium text-slate-900 mb-1 block">Supplier SKU</label>
                <Input
                  data-testid="input-sku"
                  name="supplierSku"
                  defaultValue={editingItem?.supplierSku || ''}
                  className="text-xs rounded-[4px] border-slate-200"
                />
              </div>
              <div>
                <label className="text-xs font-medium text-slate-900 mb-1 block">Package quantity</label>
                <Input data-testid="input-package-quantity" name="purchaseQuantity" type="number" step="0.001" defaultValue={editingItem?.purchaseQuantity || ''} className="text-xs rounded-[4px] border-slate-200" />
              </div>
              <div>
                <label className="text-xs font-medium text-slate-900 mb-1 block">Base unit</label>
                <Input data-testid="input-base-unit" name="baseUnit" placeholder="g, kg, ml, each" defaultValue={editingItem?.baseUnit || editingItem?.orderUnit || ''} className="text-xs rounded-[4px] border-slate-200" />
              </div>
              <div>
                <label className="text-xs font-medium text-slate-900 mb-1 block">Unit Description</label>
                <Input
                  data-testid="input-unit-description"
                  name="unitDescription"
                  defaultValue={editingItem?.unitDescription || ''}
                  className="text-xs rounded-[4px] border-slate-200"
                />
              </div>
              <div>
                <label className="text-xs font-medium text-slate-900 mb-1 block">Purchase cost (฿)</label>
                <Input data-testid="input-purchase-cost" name="purchaseCostThb" type="number" step="0.01" defaultValue={editingItem?.purchaseCostThb ?? editingItem?.unitCost ?? ''} className="text-xs rounded-[4px] border-slate-200" />
              </div>
              <div>
                <label className="text-xs font-medium text-slate-900 mb-1 block">Last Review Date</label>
                <Input
                  data-testid="input-last-review"
                  name="lastReviewDate"
                  placeholder="DD/MM/YYYY"
                  defaultValue={editingItem?.lastReviewDate || ''}
                  className="text-xs rounded-[4px] border-slate-200"
                />
              </div>
              <div>
                <label className="text-xs font-medium text-slate-900 mb-1 block">Catalogue ID</label>
                <Input data-testid="input-catalogue-code" name="catalogueCode" defaultValue={editingItem?.catalogueCode || ''} className="text-xs rounded-[4px] border-slate-200" />
              </div>
              <div className="col-span-2">
                <label className="text-xs font-medium text-slate-900 mb-1 block">Review notes</label>
                <textarea data-testid="input-review-notes" name="reviewNotes" defaultValue={editingItem?.reviewNotes || ''} className="min-h-20 w-full rounded-[4px] border border-slate-200 px-3 py-2 text-xs" />
              </div>
              {editingItem && (
                <div className="flex items-center gap-2">
                  <input
                    type="hidden"
                    name="active"
                    value={editingItem.active ? 'true' : 'false'}
                  />
                  <label className="text-xs font-medium text-slate-900">Active Status:</label>
                  <Badge variant={editingItem.active ? 'default' : 'secondary'}>
                    {editingItem.active ? 'Active' : 'Inactive'}
                  </Badge>
                  <span className="text-xs text-slate-500">(Use toggle in table to change)</span>
                </div>
              )}
            </div>
            <DialogFooter>
              <Button
                data-testid="button-cancel"
                type="button"
                variant="outline"
                onClick={() => {
                  setShowDialog(false);
                  setEditingItem(null);
                  setCategoryError(null);
                }}
                className="text-xs rounded-[4px] border-slate-200"
              >
                Cancel
              </Button>
              <Button
                data-testid="button-save"
                type="submit"
                className="bg-emerald-600 hover:bg-emerald-700 text-xs rounded-[4px]"
                disabled={createMutation.isPending || updateMutation.isPending}
              >
                {createMutation.isPending || updateMutation.isPending ? 'Saving...' : 'Save'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={deleteId !== null} onOpenChange={() => setDeleteId(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirm Delete</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-slate-600 py-4">
            Are you sure you want to delete this item? Consider deactivating it instead to preserve historical data.
          </p>
          <DialogFooter>
            <Button
              data-testid="button-cancel-delete"
              variant="outline"
              onClick={() => setDeleteId(null)}
              className="text-xs rounded-[4px] border-slate-200"
            >
              Cancel
            </Button>
            <Button
              data-testid="button-confirm-delete"
              variant="destructive"
              onClick={() => deleteId && deleteMutation.mutate(deleteId)}
              disabled={deleteMutation.isPending}
              className="text-xs rounded-[4px]"
            >
              {deleteMutation.isPending ? 'Deleting...' : 'Delete'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={recipeReference !== null} onOpenChange={(open) => !open && setRecipeReference(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Item used in recipe</DialogTitle></DialogHeader>
          <p className="py-2 text-sm text-slate-600"><strong>{recipeReference?.item}</strong> cannot be deleted while it is used in a recipe.</p>
          <div className="rounded-[4px] border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900">
            {recipeReference?.recipes.map((recipe) => <div key={recipe.id}>{recipe.name}</div>)}
          </div>
          <p className="text-xs text-slate-600">Archive removes it from active purchasing, stock and shopping lists while retaining this recipe's saved costing data.</p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRecipeReference(null)} className="text-xs">Cancel</Button>
            <Button onClick={() => { if (recipeReference) toggleActiveMutation.mutate({ id: recipeReference.id, active: false }); setRecipeReference(null); }} className="bg-amber-600 text-xs hover:bg-amber-700">Archive item</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={showCostWarning} onOpenChange={setShowCostWarning}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-amber-600" />
              High-Impact Cost Change
            </DialogTitle>
          </DialogHeader>
          <div className="py-4">
            <p className="text-sm text-slate-600 mb-4">
              You are about to change the unit cost by more than ฿10. This will affect:
            </p>
            <ul className="text-sm text-slate-600 list-disc pl-6 space-y-1 mb-4">
              <li>Shopping List estimates (future shifts)</li>
              <li>Purchasing analytics</li>
              <li>Cost projections</li>
            </ul>
            {pendingCostUpdate && (
              <div className="bg-amber-50 border border-amber-200 rounded-[4px] p-3">
                <p className="text-xs text-amber-800">
                  Cost change: {thb(pendingCostUpdate.oldCost || 0)} → {thb(pendingCostUpdate.newCost)}
                  <span className="font-medium ml-2">
                    ({pendingCostUpdate.newCost - (pendingCostUpdate.oldCost || 0) > 0 ? '+' : ''}
                    {thb(pendingCostUpdate.newCost - (pendingCostUpdate.oldCost || 0))})
                  </span>
                </p>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setShowCostWarning(false);
                setPendingCostUpdate(null);
              }}
              className="text-xs rounded-[4px] border-slate-200"
            >
              Cancel
            </Button>
            <Button
              onClick={confirmCostUpdate}
              className="bg-amber-600 hover:bg-amber-700 text-xs rounded-[4px]"
            >
              Confirm Cost Change
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
