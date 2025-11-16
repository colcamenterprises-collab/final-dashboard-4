import { useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { queryClient } from '@/lib/queryClient';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';
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
import { Plus, Pencil, Trash2, Search } from 'lucide-react';

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
  createdAt: string;
  updatedAt: string;
};

const thb = (v: unknown): string => {
  const n = typeof v === "number" && Number.isFinite(v) ? v : Number(v) || 0;
  return "฿" + n.toLocaleString("en-TH", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
};

export default function PurchasingPage() {
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [showDialog, setShowDialog] = useState(false);
  const [editingItem, setEditingItem] = useState<PurchasingItem | null>(null);
  const [deleteId, setDeleteId] = useState<number | null>(null);

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

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      const res = await fetch(`/api/purchasing-items/${id}`, {
        method: 'DELETE',
      });
      if (!res.ok) throw new Error('Failed to delete item');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['purchasing-items'] });
      setDeleteId(null);
    },
  });

  const items: PurchasingItem[] = data?.items || [];

  const categories = Array.from(new Set(items.map(i => i.category).filter(Boolean)));

  const filteredItems = items.filter(item => {
    const matchesSearch = !search || 
      item.item?.toLowerCase().includes(search.toLowerCase()) ||
      item.brand?.toLowerCase().includes(search.toLowerCase()) ||
      item.supplierName?.toLowerCase().includes(search.toLowerCase()) ||
      item.category?.toLowerCase().includes(search.toLowerCase());
    
    const matchesCategory = !categoryFilter || item.category === categoryFilter;
    
    return matchesSearch && matchesCategory;
  });

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const data = {
      item: formData.get('item') as string,
      category: formData.get('category') as string || null,
      supplierName: formData.get('supplierName') as string || null,
      brand: formData.get('brand') as string || null,
      supplierSku: formData.get('supplierSku') as string || null,
      orderUnit: formData.get('orderUnit') as string || null,
      unitDescription: formData.get('unitDescription') as string || null,
      unitCost: formData.get('unitCost') ? parseFloat(formData.get('unitCost') as string) : null,
      lastReviewDate: formData.get('lastReviewDate') as string || null,
    };

    if (editingItem) {
      updateMutation.mutate({ id: editingItem.id, data });
    } else {
      createMutation.mutate(data);
    }
  };

  return (
    <div className="p-4">
      <div className="mb-4">
        <h1 className="text-3xl font-bold text-slate-900 mb-1">Purchasing List</h1>
        <p className="text-xs text-slate-600">Master list of all items we buy. Used for daily purchasing and stock planning.</p>
      </div>

      <Card className="p-4 mb-4 rounded-[4px] border-slate-200">
        <div className="flex gap-3 items-center mb-4">
          <div className="flex-1 relative">
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
        </div>
      </Card>

      {isLoading ? (
        <div className="text-xs text-slate-600">Loading...</div>
      ) : (
        <Card className="rounded-[4px] border-slate-200">
          <Table>
            <TableHeader>
              <TableRow className="border-slate-200">
                <TableHead className="text-xs font-medium text-slate-900">Item</TableHead>
                <TableHead className="text-xs font-medium text-slate-900">Category</TableHead>
                <TableHead className="text-xs font-medium text-slate-900">Supplier</TableHead>
                <TableHead className="text-xs font-medium text-slate-900">Brand</TableHead>
                <TableHead className="text-xs font-medium text-slate-900">SKU</TableHead>
                <TableHead className="text-xs font-medium text-slate-900">Order Unit</TableHead>
                <TableHead className="text-xs font-medium text-slate-900">Unit Desc</TableHead>
                <TableHead className="text-xs font-medium text-slate-900 text-right">Unit Cost</TableHead>
                <TableHead className="text-xs font-medium text-slate-900">Last Review</TableHead>
                <TableHead className="text-xs font-medium text-slate-900 text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredItems.map((item) => (
                <TableRow key={item.id} className="border-slate-200" data-testid={`row-item-${item.id}`}>
                  <TableCell className="text-xs text-slate-900 font-medium">{item.item}</TableCell>
                  <TableCell className="text-xs text-slate-600">{item.category || '-'}</TableCell>
                  <TableCell className="text-xs text-slate-600">{item.supplierName || '-'}</TableCell>
                  <TableCell className="text-xs text-slate-600">{item.brand || '-'}</TableCell>
                  <TableCell className="text-xs text-slate-600">{item.supplierSku || '-'}</TableCell>
                  <TableCell className="text-xs text-slate-600">{item.orderUnit || '-'}</TableCell>
                  <TableCell className="text-xs text-slate-600">{item.unitDescription || '-'}</TableCell>
                  <TableCell className="text-xs text-slate-900 font-medium text-right">
                    {item.unitCost !== null ? thb(item.unitCost) : '-'}
                  </TableCell>
                  <TableCell className="text-xs text-slate-600">{item.lastReviewDate || '-'}</TableCell>
                  <TableCell className="text-right">
                    <div className="flex gap-2 justify-end">
                      <Button
                        data-testid={`button-edit-${item.id}`}
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          setEditingItem(item);
                          setShowDialog(true);
                        }}
                        className="text-xs h-8 px-2 hover:bg-slate-100"
                      >
                        <Pencil className="h-3 w-3" />
                      </Button>
                      <Button
                        data-testid={`button-delete-${item.id}`}
                        variant="ghost"
                        size="sm"
                        onClick={() => setDeleteId(item.id)}
                        className="text-xs h-8 px-2 hover:bg-red-50 hover:text-red-600"
                      >
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
              {filteredItems.length === 0 && (
                <TableRow>
                  <TableCell colSpan={10} className="text-center text-xs text-slate-600 py-8">
                    No items found
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
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
                <Input
                  data-testid="input-category"
                  name="category"
                  defaultValue={editingItem?.category || ''}
                  className="text-xs rounded-[4px] border-slate-200"
                />
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
            Are you sure you want to delete this item? This action cannot be undone.
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
    </div>
  );
}
