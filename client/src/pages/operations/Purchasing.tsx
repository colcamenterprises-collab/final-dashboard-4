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

type PurchasingItem = {
  id: number;
  item: string;
  category: string | null;
  supplierName: string | null;
  brand: string | null;
  supplierSku: string | null;
  orderUnit: string | null;
  unitDescription: string | null;
  unitCost: number | null;
  lastReviewDate: string | null;
  active: boolean;
  isIngredient: boolean;
  portionUnit: string | null;
  portionSize: number | null;
  yield: number | null;
  createdAt: string;
  updatedAt: string;
};

const APPROVED_CATEGORIES = [
  'Meat',
  'Drinks',
  'Fresh Food',
  'Frozen Food',
  'Kitchen Supplies',
  'Packaging',
  'Shelf Items',
  'Uncategorized',
];

const thb = (v: unknown): string => {
  const n = typeof v === "number" && Number.isFinite(v) ? v : Number(v) || 0;
  return "฿" + n.toLocaleString("en-TH", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
};

export default function PurchasingPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'inactive'>('active');
  const [showDialog, setShowDialog] = useState(false);
  const [editingItem, setEditingItem] = useState<PurchasingItem | null>(null);
  const [deleteId, setDeleteId] = useState<number | null>(null);
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
      const res = await fetch('/api/purchasing-items');
      return res.json();
    },
  });

  const createMutation = useMutation({
    mutationFn: async (item: Partial<PurchasingItem>) => {
      const res = await fetch('/api/purchasing-items', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
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
        body: JSON.stringify({ active }),
      });
      if (!res.ok) throw new Error('Failed to toggle item');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['purchasing-items'] });
    },
  });

  const toggleIngredientMutation = useMutation({
    mutationFn: async ({ id, isIngredient }: { id: number; isIngredient: boolean }) => {
      const res = await fetch(`/api/purchasing-items/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isIngredient }),
      });
      if (!res.ok) throw new Error('Failed to toggle ingredient status');
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
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to delete item');
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['purchasing-items'] });
      setDeleteId(null);
    },
    onError: (err: Error) => {
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

  const isValidCategory = (value: string | null) => {
    if (!value) return false;
    return APPROVED_CATEGORIES.includes(value);
  };

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const newCost = formData.get('unitCost') ? parseFloat(formData.get('unitCost') as string) : null;
    const categoryValue = (formData.get('category') as string) || null;
    
    if (!isValidCategory(categoryValue)) {
      setCategoryError('Please select a valid category from the list.');
      return;
    }
    setCategoryError(null);
    
    const data = {
      item: formData.get('item') as string,
      category: categoryValue,
      supplierName: formData.get('supplierName') as string || null,
      brand: formData.get('brand') as string || null,
      supplierSku: formData.get('supplierSku') as string || null,
      orderUnit: formData.get('orderUnit') as string || null,
      unitDescription: formData.get('unitDescription') as string || null,
      unitCost: newCost,
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
        const categoryValue = (formData.get('category') as string) || null;
        if (!isValidCategory(categoryValue)) {
          setCategoryError('Please select a valid category from the list.');
          return;
        }
        setCategoryError(null);
        const data = {
          item: formData.get('item') as string,
          category: categoryValue,
          supplierName: formData.get('supplierName') as string || null,
          brand: formData.get('brand') as string || null,
          supplierSku: formData.get('supplierSku') as string || null,
          orderUnit: formData.get('orderUnit') as string || null,
          unitDescription: formData.get('unitDescription') as string || null,
          unitCost: pendingCostUpdate.newCost,
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
      <div className="mb-4">
        <h1 className="text-3xl font-bold text-slate-900 mb-1">Purchasing List</h1>
        <p className="text-xs text-slate-600">Master control panel for all items. Changes here affect Form 2, Shopping List, and Analytics.</p>
        <p className="text-xs text-slate-400 mt-1">Source: purchasing_items</p>
      </div>

      <div className="flex gap-3 mb-4">
        <Card className="px-4 py-3 rounded-[4px] border-slate-200 flex items-center gap-2">
          <CheckCircle className="h-4 w-4 text-emerald-600" />
          <span className="text-sm font-medium text-slate-900">{activeCount}</span>
          <span className="text-xs text-slate-600">Active</span>
        </Card>
        <Card className="px-4 py-3 rounded-[4px] border-slate-200 flex items-center gap-2">
          <XCircle className="h-4 w-4 text-slate-400" />
          <span className="text-sm font-medium text-slate-900">{inactiveCount}</span>
          <span className="text-xs text-slate-600">Inactive</span>
        </Card>
        <Card className="px-4 py-3 rounded-[4px] border-slate-200 flex items-center gap-2">
          <span className="text-sm font-medium text-slate-900">{items.length}</span>
          <span className="text-xs text-slate-600">Total Items</span>
        </Card>
      </div>

      <Card className="p-4 mb-4 rounded-[4px] border-slate-200">
        <div className="flex gap-3 items-center flex-wrap">
          <div className="flex-1 min-w-[200px] relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <Input
              data-testid="input-search"
              placeholder="Search items, brands, suppliers, category..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-10 text-xs rounded-[4px] border-slate-200"
            />
          </div>
          <select
            data-testid="select-category-filter"
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            className="text-xs px-3 py-2 border border-slate-200 rounded-[4px] bg-white"
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
            className="text-xs px-3 py-2 border border-slate-200 rounded-[4px] bg-white"
          >
            <option value="active">Active Only</option>
            <option value="inactive">Inactive Only</option>
            <option value="all">All Items</option>
          </select>
          <Button
            data-testid="button-add-item"
            onClick={() => {
              setEditingItem(null);
              setShowDialog(true);
            }}
            className="bg-emerald-600 hover:bg-emerald-700 text-xs rounded-[4px]"
          >
            <Plus className="h-4 w-4 mr-1" />
            Add Item
          </Button>
          <Button
            data-testid="button-export-csv"
            variant="outline"
            onClick={() => {
              window.open('/api/purchasing-items/export/csv', '_blank');
            }}
            className="text-xs rounded-[4px] border-slate-200"
          >
            <Download className="h-4 w-4 mr-1" />
            Export CSV
          </Button>
          <label>
            <input
              type="file"
              accept=".csv"
              className="hidden"
              onChange={async (e) => {
                const file = e.target.files?.[0];
                if (!file) return;
                const text = await file.text();
                const lines = text.split('\n');
                const headers = lines[0].split(',').map(h => h.trim().replace(/"/g, ''));
                const csvData = [];
                for (let i = 1; i < lines.length; i++) {
                  if (!lines[i].trim()) continue;
                  const values = lines[i].split(',').map(v => v.trim().replace(/^"|"$/g, ''));
                  const row: any = {};
                  headers.forEach((h, idx) => { row[h] = values[idx] || ''; });
                  csvData.push(row);
                }
                const res = await fetch('/api/purchasing-items/import/csv', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ csvData }),
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
              className="text-xs rounded-[4px] border-slate-200"
              asChild
            >
              <span>
                <Upload className="h-4 w-4 mr-1" />
                Import CSV
              </span>
            </Button>
          </label>
        </div>
      </Card>

      {isLoading ? (
        <div className="text-xs text-slate-600">Loading...</div>
      ) : (
        <Card className="rounded-[4px] border-slate-200 overflow-hidden">
          <div className="overflow-x-auto">
            <Table className="min-w-[1200px]">
              <TableHeader>
                <TableRow className="border-slate-200">
                  <TableHead className="text-xs font-medium text-slate-900 w-16 text-center">Active</TableHead>
                  <TableHead className="text-xs font-medium text-slate-900 w-16 text-center">Ingredient</TableHead>
                  <TableHead className="text-xs font-medium text-slate-900 sticky left-0 bg-slate-50 z-10">Item</TableHead>
                  <TableHead className="text-xs font-medium text-slate-900">Category</TableHead>
                  <TableHead className="text-xs font-medium text-slate-900">Supplier</TableHead>
                  <TableHead className="text-xs font-medium text-slate-900">Brand</TableHead>
                  <TableHead className="text-xs font-medium text-slate-900">SKU</TableHead>
                  <TableHead className="text-xs font-medium text-slate-900">Order Unit</TableHead>
                  <TableHead className="text-xs font-medium text-slate-900">Unit Desc</TableHead>
                  <TableHead className="text-xs font-medium text-slate-900 text-right">Unit Cost</TableHead>
                  <TableHead className="text-xs font-medium text-slate-900">Last Review</TableHead>
                  <TableHead className="text-xs font-medium text-slate-900 text-center sticky right-0 bg-slate-50 z-10 border-l border-slate-200">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredItems.map((item) => (
                  <TableRow 
                    key={item.id} 
                    className={`border-slate-200 ${!item.active ? 'opacity-50 bg-slate-50' : ''}`} 
                    data-testid={`row-item-${item.id}`}
                  >
                    <TableCell className="text-center">
                      <Switch
                        data-testid={`switch-active-${item.id}`}
                        checked={item.active}
                        onCheckedChange={(checked) => {
                          toggleActiveMutation.mutate({ id: item.id, active: checked });
                        }}
                        disabled={toggleActiveMutation.isPending}
                      />
                    </TableCell>
                    <TableCell className="text-center">
                      <Switch
                        data-testid={`switch-ingredient-${item.id}`}
                        checked={item.isIngredient || false}
                        onCheckedChange={(checked) => {
                          toggleIngredientMutation.mutate({ id: item.id, isIngredient: checked });
                        }}
                        disabled={toggleIngredientMutation.isPending}
                      />
                    </TableCell>
                    <TableCell className="text-xs text-slate-900 font-medium sticky left-0 bg-white z-10">
                      {item.item}
                      {!item.active && (
                        <Badge variant="secondary" className="ml-2 text-[10px]">Inactive</Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-xs text-slate-600">{item.category || '-'}</TableCell>
                    <TableCell className="text-xs text-slate-600">{item.supplierName || <span className="text-amber-600">Missing</span>}</TableCell>
                    <TableCell className="text-xs text-slate-600">{item.brand || '-'}</TableCell>
                    <TableCell className="text-xs text-slate-600">{item.supplierSku || '-'}</TableCell>
                    <TableCell className="text-xs text-slate-600">{item.orderUnit || <span className="text-amber-600">Missing</span>}</TableCell>
                    <TableCell className="text-xs text-slate-600">{item.unitDescription || '-'}</TableCell>
                    <TableCell className="text-xs text-slate-900 font-medium text-right">
                      {item.unitCost !== null ? thb(item.unitCost) : <span className="text-amber-600">Missing</span>}
                    </TableCell>
                    <TableCell className="text-xs text-slate-600">{item.lastReviewDate || '-'}</TableCell>
                    <TableCell className="sticky right-0 bg-white z-10 border-l border-slate-200">
                      <div className="flex gap-1 justify-center">
                        <Button
                          data-testid={`button-edit-${item.id}`}
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            setEditingItem(item);
                            setShowDialog(true);
                          }}
                          className="text-xs h-8 px-2 border-emerald-200 text-emerald-600 hover:bg-emerald-50"
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          data-testid={`button-delete-${item.id}`}
                          variant="outline"
                          size="sm"
                          onClick={() => setDeleteId(item.id)}
                          className="text-xs h-8 px-2 border-red-200 text-red-600 hover:bg-red-50"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
                {filteredItems.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={12} className="text-center text-xs text-slate-600 py-8">
                      No items found
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </Card>
      )}

      <div className="mt-4 text-xs text-slate-600">
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
                <select
                  data-testid="input-category"
                  name="category"
                  defaultValue={editingItem?.category && APPROVED_CATEGORIES.includes(editingItem.category) ? editingItem.category : ''}
                  className="w-full text-xs rounded-[4px] border border-slate-200 px-3 py-2"
                  required
                >
                  <option value="">Select category</option>
                  {APPROVED_CATEGORIES.map((category) => (
                    <option key={category} value={category}>{category}</option>
                  ))}
                </select>
                {editingItem?.category && !APPROVED_CATEGORIES.includes(editingItem.category) && (
                  <div className="mt-1 text-xs text-slate-500">
                    Current category: {editingItem.category}
                  </div>
                )}
                {categoryError && (
                  <div className="mt-1 text-xs text-red-600">{categoryError}</div>
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
                <label className="text-xs font-medium text-slate-900 mb-1 block">Order Unit</label>
                <Input
                  data-testid="input-order-unit"
                  name="orderUnit"
                  defaultValue={editingItem?.orderUnit || ''}
                  className="text-xs rounded-[4px] border-slate-200"
                />
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
                <label className="text-xs font-medium text-slate-900 mb-1 block">Unit Cost (฿)</label>
                <Input
                  data-testid="input-unit-cost"
                  name="unitCost"
                  type="number"
                  step="0.01"
                  defaultValue={editingItem?.unitCost || ''}
                  className="text-xs rounded-[4px] border-slate-200"
                />
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
