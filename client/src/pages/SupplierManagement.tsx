import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardHeader, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Plus, Edit, Trash2, Package } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

interface Supplier {
  id: number;
  item: string;
  category: string;
  supplier: string;
  brand: string;
  sku: string;
  cost: number;
  packagingQty: string;
  unit: string;
  portionSize: string;
  minStock: string;
  reviewedDate: string;
  notes: string;
}

const categories = [
  'Fresh Food',
  'Frozen Food',
  'Shelf Items',
  'Drinks',
  'Kitchen Supplies',
  'Packaging'
];

const units = [
  'kg', 'g', 'litre', 'ml', 'each', 'piece', 'box', 'bag', 'bottle', 'can'
];

const SupplierManagement = () => {
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingSupplier, setEditingSupplier] = useState<Supplier | null>(null);
  const [categoryFilter, setCategoryFilter] = useState('all');
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: suppliers = [], isLoading } = useQuery({
    queryKey: ['/api/suppliers'],
  });

  const addMutation = useMutation({
    mutationFn: (data: Omit<Supplier, 'id'>) => apiRequest('/api/suppliers', 'POST', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/suppliers'] });
      setIsDialogOpen(false);
      toast({ title: "Success", description: "Supplier added successfully" });
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, ...data }: Supplier) => apiRequest(`/api/suppliers/${id}`, 'PUT', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/suppliers'] });
      setIsDialogOpen(false);
      setEditingSupplier(null);
      toast({ title: "Success", description: "Supplier updated successfully" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => apiRequest(`/api/suppliers/${id}`, 'DELETE'),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/suppliers'] });
      toast({ title: "Success", description: "Supplier deleted successfully" });
    },
  });

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    
    const supplierData = {
      item: formData.get('item') as string,
      category: formData.get('category') as string,
      supplier: formData.get('supplier') as string,
      brand: formData.get('brand') as string,
      sku: formData.get('sku') as string,
      cost: parseFloat(formData.get('cost') as string) || 0,
      packagingQty: formData.get('packagingQty') as string,
      unit: formData.get('unit') as string,
      portionSize: formData.get('portionSize') as string,
      minStock: formData.get('minStock') as string,
      reviewedDate: formData.get('reviewedDate') as string,
      notes: formData.get('notes') as string,
    };

    if (editingSupplier) {
      updateMutation.mutate({ ...supplierData, id: editingSupplier.id });
    } else {
      addMutation.mutate(supplierData);
    }
  };

  const filteredSuppliers = suppliers.filter((supplier: Supplier) => 
    categoryFilter === 'all' || supplier.category === categoryFilter
  );

  if (isLoading) {
    return (
      <div className="p-6">
        <div className="animate-pulse">
          <div className="h-6 bg-gray-200 rounded w-48 mb-4"></div>
          <div className="space-y-3">
            <div className="h-4 bg-gray-200 rounded"></div>
            <div className="h-4 bg-gray-200 rounded w-5/6"></div>
            <div className="h-4 bg-gray-200 rounded w-4/6"></div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-full mx-auto">
      <Card>
        <CardHeader>
          <div className="flex justify-between items-center">
            <h1 className="text-2xl font-semibold text-left">Supplier Management</h1>
            <div className="flex gap-3">
              <Select value={categoryFilter} onValueChange={setCategoryFilter}>
                <SelectTrigger className="w-48">
                  <SelectValue placeholder="Filter by category" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Categories</SelectItem>
                  {categories.map(category => (
                    <SelectItem key={category} value={category}>{category}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              
              <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
                <DialogTrigger asChild>
                  <Button className="flex items-center gap-2">
                    <Plus className="h-4 w-4" />
                    Add Supplier
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-w-2xl">
                  <DialogHeader>
                    <DialogTitle>
                      {editingSupplier ? 'Edit Supplier' : 'Add New Supplier'}
                    </DialogTitle>
                  </DialogHeader>
                  
                  <form onSubmit={handleSubmit} className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium mb-1">Item Name</label>
                        <Input 
                          name="item" 
                          defaultValue={editingSupplier?.item || ''} 
                          required 
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium mb-1">Category</label>
                        <Select name="category" defaultValue={editingSupplier?.category || ''}>
                          <SelectTrigger>
                            <SelectValue placeholder="Select category" />
                          </SelectTrigger>
                          <SelectContent>
                            {categories.map(category => (
                              <SelectItem key={category} value={category}>{category}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div>
                        <label className="block text-sm font-medium mb-1">Supplier</label>
                        <Input 
                          name="supplier" 
                          defaultValue={editingSupplier?.supplier || ''} 
                          required 
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium mb-1">Brand</label>
                        <Input 
                          name="brand" 
                          defaultValue={editingSupplier?.brand || ''} 
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium mb-1">SKU</label>
                        <Input 
                          name="sku" 
                          defaultValue={editingSupplier?.sku || ''} 
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium mb-1">Cost (฿)</label>
                        <Input 
                          name="cost" 
                          type="number" 
                          step="0.01"
                          defaultValue={editingSupplier?.cost || ''} 
                          required 
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium mb-1">Packaging Qty</label>
                        <Input 
                          name="packagingQty" 
                          defaultValue={editingSupplier?.packagingQty || ''} 
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium mb-1">Unit</label>
                        <Select name="unit" defaultValue={editingSupplier?.unit || ''}>
                          <SelectTrigger>
                            <SelectValue placeholder="Select unit" />
                          </SelectTrigger>
                          <SelectContent>
                            {units.map(unit => (
                              <SelectItem key={unit} value={unit}>{unit}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div>
                        <label className="block text-sm font-medium mb-1">Portion Size</label>
                        <Input 
                          name="portionSize" 
                          defaultValue={editingSupplier?.portionSize || ''} 
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium mb-1">Min Stock</label>
                        <Input 
                          name="minStock" 
                          defaultValue={editingSupplier?.minStock || ''} 
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium mb-1">Reviewed Date</label>
                        <Input 
                          name="reviewedDate" 
                          type="date"
                          defaultValue={editingSupplier?.reviewedDate || ''} 
                        />
                      </div>
                    </div>
                    <div>
                      <label className="block text-sm font-medium mb-1">Notes</label>
                      <Input 
                        name="notes" 
                        defaultValue={editingSupplier?.notes || ''} 
                      />
                    </div>
                    
                    <div className="flex justify-end gap-2">
                      <Button 
                        type="button" 
                        variant="outline" 
                        onClick={() => {
                          setIsDialogOpen(false);
                          setEditingSupplier(null);
                        }}
                      >
                        Cancel
                      </Button>
                      <Button 
                        type="submit"
                        disabled={addMutation.isPending || updateMutation.isPending}
                      >
                        {editingSupplier ? 'Update' : 'Add'} Supplier
                      </Button>
                    </div>
                  </form>
                </DialogContent>
              </Dialog>
            </div>
          </div>
        </CardHeader>
        
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Item</TableHead>
                  <TableHead>Category</TableHead>
                  <TableHead>Supplier</TableHead>
                  <TableHead>Cost (฿)</TableHead>
                  <TableHead>Unit</TableHead>
                  <TableHead>Min Stock</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredSuppliers.map((supplier: Supplier) => (
                  <TableRow key={supplier.id}>
                    <TableCell className="font-medium">{supplier.item}</TableCell>
                    <TableCell>{supplier.category}</TableCell>
                    <TableCell>{supplier.supplier}</TableCell>
                    <TableCell>฿{supplier.cost.toFixed(2)}</TableCell>
                    <TableCell>{supplier.unit}</TableCell>
                    <TableCell>{supplier.minStock || 'N/A'}</TableCell>
                    <TableCell>
                      <div className="flex gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            setEditingSupplier(supplier);
                            setIsDialogOpen(true);
                          }}
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="destructive"
                          size="sm"
                          onClick={() => deleteMutation.mutate(supplier.id)}
                          disabled={deleteMutation.isPending}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            
            {filteredSuppliers.length === 0 && (
              <div className="text-center py-8">
                <Package className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                <p className="text-gray-500">
                  {categoryFilter === 'all' ? 'No suppliers found' : `No suppliers in ${categoryFilter} category`}
                </p>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default SupplierManagement;