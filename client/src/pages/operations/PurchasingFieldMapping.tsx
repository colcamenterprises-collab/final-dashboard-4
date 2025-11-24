import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Save, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { useState } from 'react';
import { apiRequest } from '@/lib/queryClient';

// THB formatting helper
const thb = (v: number | null): string => {
  if (v === null || v === undefined) return '-';
  return "฿" + v.toLocaleString("en-TH", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
};

type FieldKey = {
  fieldKey: string;
  purchasingItemId: number | null;
  item: string | null;
  brand: string | null;
  supplierName: string | null;
  supplierSku: string | null;
  unitDescription: string | null;
  unitCost: number | null;
};

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
};

export default function PurchasingFieldMapping() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [selectedItems, setSelectedItems] = useState<Record<string, number | null>>({});

  // Fetch all field keys with current mappings
  const { data: fieldKeys = [], isLoading: isLoadingKeys } = useQuery<FieldKey[]>({
    queryKey: ['purchasing-field-keys'],
    queryFn: async () => {
      const res = await fetch('/api/purchasing-field-mapping/field-keys');
      if (!res.ok) throw new Error('Failed to load field keys');
      return res.json();
    },
  });

  // Fetch all purchasing items for dropdowns
  const { data: purchasingItems = [], isLoading: isLoadingItems } = useQuery<PurchasingItem[]>({
    queryKey: ['purchasing-items'],
    queryFn: async () => {
      const res = await fetch('/api/purchasing-field-mapping/items');
      if (!res.ok) throw new Error('Failed to load purchasing items');
      return res.json();
    },
  });

  // Save mapping mutation
  const saveMappingMutation = useMutation({
    mutationFn: async ({ fieldKey, purchasingItemId }: { fieldKey: string; purchasingItemId: number }) => {
      return apiRequest('/api/purchasing-field-mapping/map', {
        method: 'POST',
        body: JSON.stringify({ fieldKey, purchasingItemId }),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['purchasing-field-keys'] });
      toast({
        title: "Mapping saved",
        description: "Field mapping updated successfully",
      });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: "Failed to save mapping",
        variant: "destructive",
      });
    },
  });

  // Delete mapping mutation
  const deleteMappingMutation = useMutation({
    mutationFn: async (fieldKey: string) => {
      return apiRequest(`/api/purchasing-field-mapping/map/${fieldKey}`, {
        method: 'DELETE',
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['purchasing-field-keys'] });
      toast({
        title: "Mapping removed",
        description: "Field mapping deleted successfully",
      });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: "Failed to delete mapping",
        variant: "destructive",
      });
    },
  });

  const handleSave = (fieldKey: string) => {
    const itemId = selectedItems[fieldKey];
    if (!itemId) {
      toast({
        title: "Error",
        description: "Please select an item before saving",
        variant: "destructive",
      });
      return;
    }
    saveMappingMutation.mutate({ fieldKey, purchasingItemId: itemId });
  };

  const handleDelete = (fieldKey: string) => {
    deleteMappingMutation.mutate(fieldKey);
    setSelectedItems(prev => ({ ...prev, [fieldKey]: null }));
  };

  const handleSelectChange = (fieldKey: string, value: string) => {
    const itemId = value === 'none' ? null : parseInt(value, 10);
    setSelectedItems(prev => ({ ...prev, [fieldKey]: itemId }));
  };

  const getCurrentItemId = (fieldKey: FieldKey): string => {
    if (selectedItems[fieldKey.fieldKey] !== undefined) {
      return selectedItems[fieldKey.fieldKey]?.toString() || 'none';
    }
    return fieldKey.purchasingItemId?.toString() || 'none';
  };

  const getSelectedItemDetails = (fieldKey: string): PurchasingItem | null => {
    const itemId = selectedItems[fieldKey];
    if (!itemId) return null;
    return purchasingItems.find(item => item.id === itemId) || null;
  };

  const getCurrentItemDetails = (fieldKey: FieldKey): PurchasingItem | null => {
    if (selectedItems[fieldKey.fieldKey] !== undefined) {
      return getSelectedItemDetails(fieldKey.fieldKey);
    }
    if (!fieldKey.purchasingItemId) return null;
    return purchasingItems.find(item => item.id === fieldKey.purchasingItemId) || null;
  };

  if (isLoadingKeys || isLoadingItems) {
    return (
      <div className="p-6">
        <h1 className="text-xl font-bold text-slate-900 mb-4">Purchasing Field Mapping</h1>
        <p className="text-xs text-slate-600">Loading...</p>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-full">
      <div className="mb-6">
        <h1 className="text-xl font-bold text-slate-900">Purchasing Field Mapping</h1>
        <p className="text-xs text-slate-600 mt-1">
          Map Daily Stock form fields to purchasing items for automated shopping lists
        </p>
      </div>

      {fieldKeys.length === 0 ? (
        <Card className="p-6">
          <p className="text-xs text-slate-600">
            No purchasing fields found in Daily Stock forms. Submit a Daily Stock form with purchasing data first.
          </p>
        </Card>
      ) : (
        <Card className="p-0 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full text-xs">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200">
                  <th className="p-3 text-left font-medium text-slate-600">Form Field Key</th>
                  <th className="p-3 text-left font-medium text-slate-600">Mapped Item</th>
                  <th className="p-3 text-left font-medium text-slate-600">Brand</th>
                  <th className="p-3 text-left font-medium text-slate-600">Supplier</th>
                  <th className="p-3 text-left font-medium text-slate-600">SKU</th>
                  <th className="p-3 text-left font-medium text-slate-600">Unit</th>
                  <th className="p-3 text-right font-medium text-slate-600">Unit Cost</th>
                  <th className="p-3 text-center font-medium text-slate-600">Actions</th>
                </tr>
              </thead>
              <tbody>
                {fieldKeys.map((fieldKey) => {
                  const currentDetails = getCurrentItemDetails(fieldKey);
                  const hasChanges = selectedItems[fieldKey.fieldKey] !== undefined;
                  const isDeleted = selectedItems[fieldKey.fieldKey] === null && fieldKey.purchasingItemId !== null;

                  return (
                    <tr 
                      key={fieldKey.fieldKey} 
                      className={`border-b border-slate-200 hover:bg-slate-50 ${isDeleted ? 'bg-red-50' : ''}`}
                      data-testid={`row-field-${fieldKey.fieldKey}`}
                    >
                      <td className="p-3 text-slate-900 font-mono text-xs" data-testid={`text-fieldkey-${fieldKey.fieldKey}`}>
                        {fieldKey.fieldKey}
                      </td>
                      <td className="p-3">
                        <Select
                          value={getCurrentItemId(fieldKey)}
                          onValueChange={(value) => handleSelectChange(fieldKey.fieldKey, value)}
                          data-testid={`select-item-${fieldKey.fieldKey}`}
                        >
                          <SelectTrigger className="w-full text-xs h-8 rounded-[4px]">
                            <SelectValue placeholder="Select item..." />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="none">-- Not Mapped --</SelectItem>
                            {purchasingItems.map((item) => (
                              <SelectItem key={item.id} value={item.id.toString()}>
                                {item.item} {item.brand ? `(${item.brand})` : ''}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </td>
                      <td className="p-3 text-slate-600">{currentDetails?.brand || '-'}</td>
                      <td className="p-3 text-slate-600">{currentDetails?.supplierName || '-'}</td>
                      <td className="p-3 text-slate-600">{currentDetails?.supplierSku || '-'}</td>
                      <td className="p-3 text-slate-600">{currentDetails?.unitDescription || currentDetails?.orderUnit || '-'}</td>
                      <td className="p-3 text-right text-slate-600">{thb(currentDetails?.unitCost || null)}</td>
                      <td className="p-3">
                        <div className="flex items-center justify-center gap-2">
                          {hasChanges && (
                            <Button
                              size="sm"
                              onClick={() => handleSave(fieldKey.fieldKey)}
                              className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs h-7 px-2 rounded-[4px]"
                              data-testid={`button-save-${fieldKey.fieldKey}`}
                            >
                              <Save className="h-3 w-3 mr-1" />
                              Save
                            </Button>
                          )}
                          {fieldKey.purchasingItemId && !isDeleted && (
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => handleDelete(fieldKey.fieldKey)}
                              className="text-red-600 hover:text-red-700 hover:bg-red-50 text-xs h-7 px-2 rounded-[4px]"
                              data-testid={`button-delete-${fieldKey.fieldKey}`}
                            >
                              <Trash2 className="h-3 w-3" />
                            </Button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      <div className="mt-4 text-xs text-slate-500">
        Total fields: {fieldKeys.length} | Mapped: {fieldKeys.filter(fk => fk.purchasingItemId !== null).length}
      </div>
    </div>
  );
}
