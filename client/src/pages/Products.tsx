/**
 * PATCH P1: Products Page
 * 
 * Lists all products with multi-channel pricing and cost display
 * Tablet and mobile responsive
 */

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { Plus, Edit3, Trash2, Eye } from "lucide-react";
import { ProductEditor } from "@/components/ProductEditor";

type Product = {
  id: number;
  name: string;
  description: string | null;
  imageUrl: string | null;
  active: boolean;
  createdAt: string;
  cost: number;
};

type ProductDetail = {
  product: Product;
  ingredients: any[];
  prices: { channel: string; price: number }[];
  cost: number;
};

function ProductViewModal({ productId, isOpen, onClose, onEdit }: {
  productId: number | null;
  isOpen: boolean;
  onClose: () => void;
  onEdit: () => void;
}) {
  const { data, isLoading } = useQuery<ProductDetail>({
    queryKey: ['/api/products', productId],
    queryFn: async () => {
      const res = await fetch(`/api/products/${productId}`);
      return res.json();
    },
    enabled: isOpen && productId !== null,
  });

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-[4px] w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <div className="p-4 border-b">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold">{data?.product?.name || 'Loading...'}</h2>
            <Badge 
              className={`text-[10px] rounded-[4px] ${data?.product?.active ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-200 text-slate-600'}`}
            >
              {data?.product?.active ? "Active" : "Inactive"}
            </Badge>
          </div>
        </div>

        {isLoading ? (
          <div className="p-4 text-center text-slate-400 text-xs">Loading...</div>
        ) : data ? (
          <div className="p-4 space-y-4">
            {data.product.description && (
              <p className="text-xs text-slate-600">{data.product.description}</p>
            )}

            <div>
              <h3 className="text-xs font-semibold mb-2">Ingredients ({data.ingredients.length})</h3>
              {data.ingredients.length > 0 ? (
                <div className="space-y-1">
                  {data.ingredients.map((i: any) => (
                    <div key={i.ingredientId} className="flex justify-between text-xs bg-slate-50 p-2 rounded-[4px]">
                      <span>{i.name}</span>
                      <span className="text-slate-500">{i.portionQty} {i.baseUnit}</span>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-slate-400">No ingredients</p>
              )}
            </div>

            <div>
              <h3 className="text-xs font-semibold mb-2">Pricing</h3>
              <div className="space-y-2">
                {['IN_STORE', 'GRAB', 'ONLINE'].map(ch => {
                  const p = data.prices.find((pr: any) => pr.channel === ch);
                  const price = p ? Number(p.price) : 0;
                  const margin = price - data.cost;
                  return (
                    <div key={ch} className="flex justify-between text-xs bg-slate-50 p-2 rounded-[4px]">
                      <span>{ch.replace('_', ' ')}</span>
                      <div className="text-right">
                        <span className="font-medium">฿{price.toFixed(0)}</span>
                        {price > 0 && (
                          <span className={`ml-2 ${margin >= 0 ? 'text-emerald-600' : 'text-red-500'}`}>
                            (margin ฿{margin.toFixed(2)})
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="flex justify-between items-center pt-2 border-t">
              <span className="text-xs text-slate-500">Cost per serve</span>
              <span className="text-sm font-semibold text-emerald-600">฿{data.cost.toFixed(2)}</span>
            </div>
          </div>
        ) : null}

        <div className="p-4 border-t flex flex-col-reverse sm:flex-row sm:justify-end gap-2">
          <Button variant="outline" onClick={onClose} className="text-xs rounded-[4px] h-9 min-h-[36px]">
            Close
          </Button>
          <Button onClick={onEdit} className="text-xs rounded-[4px] bg-emerald-600 hover:bg-emerald-700 h-9 min-h-[36px]">
            Edit Product
          </Button>
        </div>
      </div>
    </div>
  );
}

export default function Products() {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [editorOpen, setEditorOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [viewingId, setViewingId] = useState<number | null>(null);

  const { data, isLoading } = useQuery<{ ok: boolean; products: Product[] }>({
    queryKey: ['/api/products'],
    queryFn: async () => {
      const res = await fetch('/api/products');
      return res.json();
    },
  });
  const products = data?.products || [];

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      const res = await fetch(`/api/products/${id}`, { method: 'DELETE' });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/products'] });
      toast({ title: "Product deleted" });
    },
  });

  const handleCreate = () => {
    setEditingId(null);
    setEditorOpen(true);
  };

  const handleEdit = (id: number) => {
    setEditingId(id);
    setEditorOpen(true);
  };

  const handleView = (id: number) => {
    setViewingId(id);
  };

  const handleDelete = (id: number) => {
    if (window.confirm('Delete this product?')) {
      deleteMutation.mutate(id);
    }
  };

  const handleEditFromView = () => {
    if (viewingId) {
      setViewingId(null);
      setEditingId(viewingId);
      setEditorOpen(true);
    }
  };

  if (isLoading) {
    return (
      <div className="w-full px-3 sm:px-4 lg:px-6 py-4 max-w-7xl mx-auto">
        <div className="mb-4">
          <h1 className="text-sm font-semibold text-slate-900">Products</h1>
        </div>
        <div className="animate-pulse">
          <div className="h-80 bg-slate-100 rounded-[4px]"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full px-3 sm:px-4 lg:px-6 py-4 space-y-4 max-w-7xl mx-auto">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="text-sm font-semibold text-slate-900">Products</h1>
        <Button size="sm" onClick={handleCreate} className="h-8 text-xs rounded-[4px] bg-emerald-600 hover:bg-emerald-700">
          <Plus className="h-3 w-3 mr-1" />
          New Product
        </Button>
      </div>

      <Card className="rounded-[4px] border-slate-200">
        <CardHeader className="p-3 pb-2">
          <CardTitle className="text-xs font-medium">Products ({products.length})</CardTitle>
        </CardHeader>
        <CardContent className="p-3 pt-0">
          <div className="hidden sm:block">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-slate-200">
                  <th className="text-left py-2 font-medium text-slate-600">Name</th>
                  <th className="text-right py-2 font-medium text-slate-600">Cost</th>
                  <th className="text-left py-2 font-medium text-slate-600">Status</th>
                  <th className="text-right py-2 font-medium text-slate-600">Actions</th>
                </tr>
              </thead>
              <tbody>
                {products.map(p => (
                  <tr key={p.id} className="border-b border-slate-100 hover:bg-slate-50">
                    <td className="py-2 text-slate-900">{p.name}</td>
                    <td className="py-2 text-right text-emerald-600 font-medium">฿{Number(p.cost || 0).toFixed(2)}</td>
                    <td className="py-2">
                      <Badge className={`text-[10px] rounded-[4px] ${p.active ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-200 text-slate-600'}`}>
                        {p.active ? "Active" : "Inactive"}
                      </Badge>
                    </td>
                    <td className="py-2 text-right">
                      <div className="flex justify-end gap-1">
                        <Button variant="ghost" size="sm" onClick={() => handleView(p.id)} className="h-6 w-6 p-0">
                          <Eye className="h-3 w-3" />
                        </Button>
                        <Button variant="ghost" size="sm" onClick={() => handleEdit(p.id)} className="h-6 w-6 p-0">
                          <Edit3 className="h-3 w-3" />
                        </Button>
                        <Button variant="ghost" size="sm" onClick={() => handleDelete(p.id)} className="h-6 w-6 p-0 text-red-500">
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
                {products.length === 0 && (
                  <tr>
                    <td colSpan={4} className="py-8 text-center text-slate-400">No products yet</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          <div className="sm:hidden space-y-2">
            {products.map(p => (
              <div key={p.id} className="bg-slate-50 rounded-[4px] p-3 border border-slate-100">
                <div className="flex justify-between items-start mb-2">
                  <div>
                    <span className="text-xs font-medium text-slate-900">{p.name}</span>
                    <Badge className={`ml-2 text-[10px] rounded-[4px] ${p.active ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-200 text-slate-600'}`}>
                      {p.active ? "Active" : "Inactive"}
                    </Badge>
                  </div>
                  <span className="text-xs font-mono text-emerald-600">฿{Number(p.cost || 0).toFixed(2)}</span>
                </div>
                <div className="flex gap-1 mt-2">
                  <Button variant="outline" size="sm" onClick={() => handleView(p.id)} className="h-8 text-xs flex-1 rounded-[4px]">
                    <Eye className="h-3 w-3 mr-1" /> View
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => handleEdit(p.id)} className="h-8 text-xs flex-1 rounded-[4px]">
                    <Edit3 className="h-3 w-3 mr-1" /> Edit
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => handleDelete(p.id)} className="h-8 w-8 p-0 text-red-500 rounded-[4px]">
                    <Trash2 className="h-3 w-3" />
                  </Button>
                </div>
              </div>
            ))}
            {products.length === 0 && (
              <div className="py-8 text-center text-slate-400 text-xs">No products yet</div>
            )}
          </div>
        </CardContent>
      </Card>

      <ProductViewModal
        productId={viewingId}
        isOpen={viewingId !== null}
        onClose={() => setViewingId(null)}
        onEdit={handleEditFromView}
      />

      <ProductEditor
        productId={editingId}
        isOpen={editorOpen}
        onClose={() => {
          setEditorOpen(false);
          setEditingId(null);
        }}
        onSaved={() => {
          queryClient.invalidateQueries({ queryKey: ['/api/products'] });
        }}
      />
    </div>
  );
}
