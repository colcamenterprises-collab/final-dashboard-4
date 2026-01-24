// 🔒 INGREDIENT AUTHORITY
// Management-editable governance layer
// Lives under Menu Management for access ONLY
// Units are free-text (dropdowns are assistive only)
// MUST NOT be referenced by recipe builder or ingredient add flow

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { apiRequest } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';

interface ReviewItem {
  id: number;
  name: string;
  category: string;
  supplier_id?: number;
  supplier_name?: string;
  package_cost?: number;
  package_qty?: number;
  package_unit?: string;
  portion_qty?: number;
  portion_unit?: string;
}

interface IngredientAuthority {
  id: number;
  name: string;
  category: string;
  supplier: string;
  purchase_quantity: number;
  purchase_unit: string;
  purchase_cost_thb: number;
  portion_quantity: number;
  portion_unit: string;
  conversion_factor?: number;
  is_active: boolean;
  notes?: string;
  version_count?: number;
  created_at: string;
  updated_at: string;
}

interface Version {
  id: number;
  ingredient_authority_id: number;
  version_number: number;
  snapshot_json: Record<string, any>;
  created_at: string;
  created_by?: string;
}

const CATEGORIES = [
  'Meat & Protein',
  'Dairy & Cheese',
  'Vegetables',
  'Condiments & Sauces',
  'Bread & Bakery',
  'Beverages',
  'Dry Goods',
  'Other'
];

const UNIT_SUGGESTIONS = ['g', 'kg', 'ml', 'l', 'each', 'slice', 'cup', 'pack', 'bottle', 'box', 'bag', 'piece', 'portion'];

export default function IngredientAuthorityPage() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState('review');
  const [selectedItem, setSelectedItem] = useState<ReviewItem | null>(null);
  const [selectedAuthority, setSelectedAuthority] = useState<IngredientAuthority | null>(null);
  const [showApprovalModal, setShowApprovalModal] = useState(false);
  const [showVersionsModal, setShowVersionsModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showManualAddModal, setShowManualAddModal] = useState(false);

  const [formData, setFormData] = useState({
    name: '',
    category: '',
    supplier: '',
    purchaseQuantity: 1,
    purchaseUnit: 'kg',
    purchaseCostThb: 0,
    portionQuantity: 1,
    portionUnit: 'g',
    conversionFactor: null as number | null,
    notes: ''
  });

  const reviewQueue = useQuery({
    queryKey: ['/api/admin/ingredient-authority/review-queue'],
    queryFn: async () => {
      const res = await fetch('/api/admin/ingredient-authority/review-queue');
      const data = await res.json();
      return data.items || [];
    }
  });

  const authorities = useQuery({
    queryKey: ['/api/admin/ingredient-authority'],
    queryFn: async () => {
      const res = await fetch('/api/admin/ingredient-authority');
      const data = await res.json();
      return data.items || [];
    }
  });

  const versions = useQuery({
    queryKey: ['/api/admin/ingredient-authority', selectedAuthority?.id, 'versions'],
    queryFn: async () => {
      if (!selectedAuthority?.id) return [];
      const res = await fetch(`/api/admin/ingredient-authority/${selectedAuthority.id}/versions`);
      const data = await res.json();
      return data.items || [];
    },
    enabled: !!selectedAuthority?.id && showVersionsModal
  });

  const approveMutation = useMutation({
    mutationFn: async (data: Record<string, any>) => {
      const res = await apiRequest('POST', '/api/admin/ingredient-authority', data);
      return res.json();
    },
    onSuccess: () => {
      toast({ title: 'Ingredient Approved', description: 'Added to Ingredient Authority' });
      queryClient.invalidateQueries({ queryKey: ['/api/admin/ingredient-authority'] });
      queryClient.invalidateQueries({ queryKey: ['/api/admin/ingredient-authority/review-queue'] });
      setShowApprovalModal(false);
      setSelectedItem(null);
    },
    onError: (err: any) => {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    }
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: number; data: Record<string, any> }) => {
      const res = await apiRequest('PUT', `/api/admin/ingredient-authority/${id}`, data);
      return res.json();
    },
    onSuccess: () => {
      toast({ title: 'Authority Updated', description: 'New version created' });
      queryClient.invalidateQueries({ queryKey: ['/api/admin/ingredient-authority'] });
      setShowEditModal(false);
      setSelectedAuthority(null);
    },
    onError: (err: any) => {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    }
  });

  const deactivateMutation = useMutation({
    mutationFn: async (id: number) => {
      const res = await apiRequest('PATCH', `/api/admin/ingredient-authority/${id}/deactivate`, { deactivatedBy: 'admin' });
      return res.json();
    },
    onSuccess: () => {
      toast({ title: 'Ingredient Deactivated', description: 'Record has been soft-deleted' });
      queryClient.invalidateQueries({ queryKey: ['/api/admin/ingredient-authority'] });
    },
    onError: (err: any) => {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    }
  });

  const manualAddMutation = useMutation({
    mutationFn: async (data: Record<string, any>) => {
      const res = await apiRequest('POST', '/api/admin/ingredient-authority', {
        ...data,
        legacyIngredientId: null,
        createdBy: 'admin'
      });
      return res.json();
    },
    onSuccess: () => {
      toast({ title: 'Ingredient Added', description: 'Manual entry created with version 1' });
      queryClient.invalidateQueries({ queryKey: ['/api/admin/ingredient-authority'] });
      setShowManualAddModal(false);
      resetForm();
    },
    onError: (err: any) => {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    }
  });

  const resetForm = () => {
    setFormData({
      name: '',
      category: 'Other',
      supplier: '',
      purchaseQuantity: 1,
      purchaseUnit: '',
      purchaseCostThb: 0,
      portionQuantity: 1,
      portionUnit: '',
      conversionFactor: null,
      notes: ''
    });
  };

  const openManualAddModal = () => {
    resetForm();
    setShowManualAddModal(true);
  };

  const handleManualAdd = () => {
    if (!formData.name || !formData.category) {
      toast({ title: 'Error', description: 'Name and category are required', variant: 'destructive' });
      return;
    }
    manualAddMutation.mutate({
      name: formData.name,
      category: formData.category,
      supplier: formData.supplier,
      purchaseQuantity: formData.purchaseQuantity,
      purchaseUnit: formData.purchaseUnit,
      purchaseCostThb: formData.purchaseCostThb,
      portionQuantity: formData.portionQuantity,
      portionUnit: formData.portionUnit,
      conversionFactor: formData.conversionFactor,
      notes: formData.notes
    });
  };

  const handleDeactivate = (authority: IngredientAuthority) => {
    if (confirm(`Deactivate "${authority.name}"? This is a soft delete.`)) {
      deactivateMutation.mutate(authority.id);
    }
  };

  const openApprovalModal = (item: ReviewItem) => {
    setSelectedItem(item);
    setFormData({
      name: item.name || '',
      category: item.category || 'Other',
      supplier: item.supplier_name || '',
      purchaseQuantity: item.package_qty || 1,
      purchaseUnit: item.package_unit || 'kg',
      purchaseCostThb: item.package_cost || 0,
      portionQuantity: item.portion_qty || 1,
      portionUnit: item.portion_unit || 'g',
      conversionFactor: null,
      notes: ''
    });
    setShowApprovalModal(true);
  };

  const openEditModal = (authority: IngredientAuthority) => {
    setSelectedAuthority(authority);
    setFormData({
      name: authority.name,
      category: authority.category,
      supplier: authority.supplier,
      purchaseQuantity: authority.purchase_quantity,
      purchaseUnit: authority.purchase_unit,
      purchaseCostThb: authority.purchase_cost_thb,
      portionQuantity: authority.portion_quantity,
      portionUnit: authority.portion_unit,
      conversionFactor: authority.conversion_factor || null,
      notes: authority.notes || ''
    });
    setShowEditModal(true);
  };

  const openVersionsModal = (authority: IngredientAuthority) => {
    setSelectedAuthority(authority);
    setShowVersionsModal(true);
  };

  const handleApprove = () => {
    if (!selectedItem) return;
    approveMutation.mutate({
      legacyIngredientId: String(selectedItem.id),
      name: formData.name,
      category: formData.category,
      supplier: formData.supplier,
      purchaseQuantity: formData.purchaseQuantity,
      purchaseUnit: formData.purchaseUnit,
      purchaseCostThb: formData.purchaseCostThb,
      portionQuantity: formData.portionQuantity,
      portionUnit: formData.portionUnit,
      conversionFactor: formData.conversionFactor,
      notes: formData.notes,
      createdBy: 'admin'
    });
  };

  const handleUpdate = () => {
    if (!selectedAuthority) return;
    updateMutation.mutate({
      id: selectedAuthority.id,
      data: {
        name: formData.name,
        category: formData.category,
        supplier: formData.supplier,
        purchaseQuantity: formData.purchaseQuantity,
        purchaseUnit: formData.purchaseUnit,
        purchaseCostThb: formData.purchaseCostThb,
        portionQuantity: formData.portionQuantity,
        portionUnit: formData.portionUnit,
        conversionFactor: formData.conversionFactor,
        notes: formData.notes,
        updatedBy: 'admin'
      }
    });
  };

  return (
    <div className="p-6 space-y-6 bg-white min-h-screen">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold text-slate-900">Ingredient Authority</h1>
        <Badge variant="outline" className="text-xs border-amber-500 text-amber-600">ADMIN ONLY</Badge>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="review">Review Queue ({reviewQueue.data?.length || 0})</TabsTrigger>
          <TabsTrigger value="authority">Authority List ({authorities.data?.length || 0})</TabsTrigger>
        </TabsList>

        <TabsContent value="review" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Pending Approval</CardTitle>
            </CardHeader>
            <CardContent>
              {reviewQueue.isLoading ? (
                <p className="text-slate-500">Loading...</p>
              ) : reviewQueue.data?.length === 0 ? (
                <p className="text-slate-500">All ingredients approved</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Name</TableHead>
                      <TableHead>Category</TableHead>
                      <TableHead>Supplier</TableHead>
                      <TableHead>Package</TableHead>
                      <TableHead>Action</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {reviewQueue.data?.map((item: ReviewItem) => (
                      <TableRow key={item.id}>
                        <TableCell className="font-medium">{item.name}</TableCell>
                        <TableCell>{item.category || '-'}</TableCell>
                        <TableCell>{item.supplier_name || '-'}</TableCell>
                        <TableCell>
                          {item.package_qty} {item.package_unit} @ ฿{item.package_cost}
                        </TableCell>
                        <TableCell>
                          <Button size="sm" onClick={() => openApprovalModal(item)}>
                            Review
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="authority" className="mt-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-lg">Approved Ingredients</CardTitle>
              <Button size="sm" onClick={openManualAddModal}>
                Manual Add
              </Button>
            </CardHeader>
            <CardContent>
              {authorities.isLoading ? (
                <p className="text-slate-500">Loading...</p>
              ) : authorities.data?.length === 0 ? (
                <p className="text-slate-500">No approved ingredients yet</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Name</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Category</TableHead>
                      <TableHead>Purchase</TableHead>
                      <TableHead>Portion</TableHead>
                      <TableHead>Cost</TableHead>
                      <TableHead>Versions</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {authorities.data?.map((auth: IngredientAuthority) => (
                      <TableRow key={auth.id} className={!auth.is_active ? 'opacity-50' : ''}>
                        <TableCell className="font-medium">{auth.name}</TableCell>
                        <TableCell>
                          <Badge variant={auth.is_active ? 'default' : 'secondary'}>
                            {auth.is_active ? 'Active' : 'Inactive'}
                          </Badge>
                        </TableCell>
                        <TableCell>{auth.category}</TableCell>
                        <TableCell>{auth.purchase_quantity} {auth.purchase_unit}</TableCell>
                        <TableCell>{auth.portion_quantity} {auth.portion_unit}</TableCell>
                        <TableCell>฿{auth.purchase_cost_thb}</TableCell>
                        <TableCell>
                          <Badge variant="secondary">{auth.version_count || 1}</Badge>
                        </TableCell>
                        <TableCell className="space-x-2">
                          {auth.is_active && (
                            <>
                              <Button size="sm" variant="outline" onClick={() => openEditModal(auth)}>
                                Edit
                              </Button>
                              <Button size="sm" variant="ghost" onClick={() => handleDeactivate(auth)}>
                                Deactivate
                              </Button>
                            </>
                          )}
                          <Button size="sm" variant="ghost" onClick={() => openVersionsModal(auth)}>
                            History
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <Dialog open={showApprovalModal} onOpenChange={setShowApprovalModal}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Approve Ingredient</DialogTitle>
            <DialogDescription>
              Review and approve this ingredient for the Authority system.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Name</Label>
                <Input
                  value={formData.name}
                  onChange={e => setFormData(p => ({ ...p, name: e.target.value }))}
                />
              </div>
              <div>
                <Label>Category</Label>
                <Select value={formData.category} onValueChange={v => setFormData(p => ({ ...p, category: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {CATEGORIES.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div>
              <Label>Supplier</Label>
              <Input
                value={formData.supplier}
                onChange={e => setFormData(p => ({ ...p, supplier: e.target.value }))}
              />
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div>
                <Label>Purchase Qty</Label>
                <Input
                  type="number"
                  value={formData.purchaseQuantity}
                  onChange={e => setFormData(p => ({ ...p, purchaseQuantity: Number(e.target.value) }))}
                />
              </div>
              <div>
                <Label>Purchase Unit</Label>
                <Input
                  list="unit-suggestions"
                  value={formData.purchaseUnit}
                  onChange={e => setFormData(p => ({ ...p, purchaseUnit: e.target.value }))}
                  placeholder="e.g. kg, each, bag"
                />
              </div>
              <div>
                <Label>Cost (THB)</Label>
                <Input
                  type="number"
                  value={formData.purchaseCostThb}
                  onChange={e => setFormData(p => ({ ...p, purchaseCostThb: Number(e.target.value) }))}
                />
              </div>
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div>
                <Label>Portion Qty</Label>
                <Input
                  type="number"
                  value={formData.portionQuantity}
                  onChange={e => setFormData(p => ({ ...p, portionQuantity: Number(e.target.value) }))}
                />
              </div>
              <div>
                <Label>Portion Unit</Label>
                <Input
                  list="unit-suggestions"
                  value={formData.portionUnit}
                  onChange={e => setFormData(p => ({ ...p, portionUnit: e.target.value }))}
                  placeholder="e.g. g, slice, each"
                />
              </div>
              <div>
                <Label>Conversion Factor</Label>
                <Input
                  type="number"
                  placeholder="Optional"
                  value={formData.conversionFactor ?? ''}
                  onChange={e => setFormData(p => ({ ...p, conversionFactor: e.target.value ? Number(e.target.value) : null }))}
                />
              </div>
            </div>
            <div>
              <Label>Notes</Label>
              <Textarea
                value={formData.notes}
                onChange={e => setFormData(p => ({ ...p, notes: e.target.value }))}
                placeholder="Optional notes..."
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowApprovalModal(false)}>Cancel</Button>
            <Button onClick={handleApprove} disabled={approveMutation.isPending}>
              {approveMutation.isPending ? 'Approving...' : 'Approve'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={showEditModal} onOpenChange={setShowEditModal}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Edit Ingredient Authority</DialogTitle>
            <DialogDescription>
              Changes create a new version.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Name</Label>
                <Input
                  value={formData.name}
                  onChange={e => setFormData(p => ({ ...p, name: e.target.value }))}
                />
              </div>
              <div>
                <Label>Category</Label>
                <Select value={formData.category} onValueChange={v => setFormData(p => ({ ...p, category: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {CATEGORIES.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div>
              <Label>Supplier</Label>
              <Input
                value={formData.supplier}
                onChange={e => setFormData(p => ({ ...p, supplier: e.target.value }))}
              />
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div>
                <Label>Purchase Qty</Label>
                <Input
                  type="number"
                  value={formData.purchaseQuantity}
                  onChange={e => setFormData(p => ({ ...p, purchaseQuantity: Number(e.target.value) }))}
                />
              </div>
              <div>
                <Label>Purchase Unit</Label>
                <Input
                  list="unit-suggestions"
                  value={formData.purchaseUnit}
                  onChange={e => setFormData(p => ({ ...p, purchaseUnit: e.target.value }))}
                  placeholder="e.g. kg, each, bag"
                />
              </div>
              <div>
                <Label>Cost (THB)</Label>
                <Input
                  type="number"
                  value={formData.purchaseCostThb}
                  onChange={e => setFormData(p => ({ ...p, purchaseCostThb: Number(e.target.value) }))}
                />
              </div>
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div>
                <Label>Portion Qty</Label>
                <Input
                  type="number"
                  value={formData.portionQuantity}
                  onChange={e => setFormData(p => ({ ...p, portionQuantity: Number(e.target.value) }))}
                />
              </div>
              <div>
                <Label>Portion Unit</Label>
                <Input
                  list="unit-suggestions"
                  value={formData.portionUnit}
                  onChange={e => setFormData(p => ({ ...p, portionUnit: e.target.value }))}
                  placeholder="e.g. g, slice, each"
                />
              </div>
              <div>
                <Label>Conversion Factor</Label>
                <Input
                  type="number"
                  placeholder="Optional"
                  value={formData.conversionFactor ?? ''}
                  onChange={e => setFormData(p => ({ ...p, conversionFactor: e.target.value ? Number(e.target.value) : null }))}
                />
              </div>
            </div>
            <div>
              <Label>Notes</Label>
              <Textarea
                value={formData.notes}
                onChange={e => setFormData(p => ({ ...p, notes: e.target.value }))}
                placeholder="Optional notes..."
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowEditModal(false)}>Cancel</Button>
            <Button onClick={handleUpdate} disabled={updateMutation.isPending}>
              {updateMutation.isPending ? 'Saving...' : 'Save Changes'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={showVersionsModal} onOpenChange={setShowVersionsModal}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Version History: {selectedAuthority?.name}</DialogTitle>
          </DialogHeader>
          <div className="max-h-96 overflow-auto">
            {versions.isLoading ? (
              <p className="text-slate-500">Loading...</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Version</TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead>By</TableHead>
                    <TableHead>Changes</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {versions.data?.map((v: Version) => (
                    <TableRow key={v.id}>
                      <TableCell>
                        <Badge>v{v.version_number}</Badge>
                      </TableCell>
                      <TableCell>{new Date(v.created_at).toLocaleDateString()}</TableCell>
                      <TableCell>{v.created_by || 'admin'}</TableCell>
                      <TableCell className="text-xs text-slate-600 max-w-xs truncate">
                        {JSON.stringify(v.snapshot_json)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={showManualAddModal} onOpenChange={setShowManualAddModal}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Manual Add Ingredient</DialogTitle>
            <DialogDescription>
              Create a new Ingredient Authority record (legacy_ingredient_id = NULL).
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Name *</Label>
                <Input
                  value={formData.name}
                  onChange={e => setFormData(p => ({ ...p, name: e.target.value }))}
                  placeholder="Ingredient name"
                />
              </div>
              <div>
                <Label>Category *</Label>
                <Select value={formData.category} onValueChange={v => setFormData(p => ({ ...p, category: v }))}>
                  <SelectTrigger><SelectValue placeholder="Select category" /></SelectTrigger>
                  <SelectContent>
                    {CATEGORIES.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div>
              <Label>Supplier</Label>
              <Input
                value={formData.supplier}
                onChange={e => setFormData(p => ({ ...p, supplier: e.target.value }))}
              />
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div>
                <Label>Purchase Qty</Label>
                <Input
                  type="number"
                  value={formData.purchaseQuantity}
                  onChange={e => setFormData(p => ({ ...p, purchaseQuantity: Number(e.target.value) }))}
                />
              </div>
              <div>
                <Label>Purchase Unit</Label>
                <Input
                  list="unit-suggestions"
                  value={formData.purchaseUnit}
                  onChange={e => setFormData(p => ({ ...p, purchaseUnit: e.target.value }))}
                  placeholder="e.g. kg, each, bag"
                />
              </div>
              <div>
                <Label>Cost (THB)</Label>
                <Input
                  type="number"
                  value={formData.purchaseCostThb}
                  onChange={e => setFormData(p => ({ ...p, purchaseCostThb: Number(e.target.value) }))}
                />
              </div>
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div>
                <Label>Portion Qty</Label>
                <Input
                  type="number"
                  value={formData.portionQuantity}
                  onChange={e => setFormData(p => ({ ...p, portionQuantity: Number(e.target.value) }))}
                />
              </div>
              <div>
                <Label>Portion Unit</Label>
                <Input
                  list="unit-suggestions"
                  value={formData.portionUnit}
                  onChange={e => setFormData(p => ({ ...p, portionUnit: e.target.value }))}
                  placeholder="e.g. g, slice, each"
                />
              </div>
              <div>
                <Label>Conversion Factor</Label>
                <Input
                  type="number"
                  placeholder="Optional"
                  value={formData.conversionFactor ?? ''}
                  onChange={e => setFormData(p => ({ ...p, conversionFactor: e.target.value ? Number(e.target.value) : null }))}
                />
              </div>
            </div>
            <div>
              <Label>Notes</Label>
              <Textarea
                value={formData.notes}
                onChange={e => setFormData(p => ({ ...p, notes: e.target.value }))}
                placeholder="Optional notes..."
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowManualAddModal(false)}>Cancel</Button>
            <Button onClick={handleManualAdd} disabled={manualAddMutation.isPending}>
              {manualAddMutation.isPending ? 'Adding...' : 'Add Ingredient'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <datalist id="unit-suggestions">
        {UNIT_SUGGESTIONS.map(u => <option key={u} value={u} />)}
      </datalist>
    </div>
  );
}
