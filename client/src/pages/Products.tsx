/**
 * PATCH P1: Products Page
 * 
 * Lists all products with multi-channel pricing and cost display
 * Tablet and mobile responsive
 */

import { useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { Plus, Trash2, Eye } from "lucide-react";

type Product = {
  id: number;
  name: string;
  description: string | null;
  active: boolean;
  created_at: string;
  total_cost: number | null;
  category?: string | null;
  sale_price?: number | null;
};

export default function Products() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const queryClient = useQueryClient();

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
    navigate("/products/new");
  };

  const handleOpen = (id: number) => {
    navigate(`/products/${id}`);
  };

  const handleDelete = (id: number) => {
    if (window.confirm('Delete this product?')) {
      deleteMutation.mutate(id);
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
                  <th className="text-left py-2 font-medium text-slate-600">Category</th>
                  <th className="text-right py-2 font-medium text-slate-600">Sale Price</th>
                  <th className="text-right py-2 font-medium text-slate-600">Total Cost</th>
                  <th className="text-left py-2 font-medium text-slate-600">Status</th>
                  <th className="text-right py-2 font-medium text-slate-600">Actions</th>
                </tr>
              </thead>
              <tbody>
                {products.map(p => (
                  <tr key={p.id} className="border-b border-slate-100 hover:bg-slate-50">
                    <td className="py-2 text-slate-900">{p.name}</td>
                    <td className="py-2 text-slate-500">{p.category || "UNMAPPED"}</td>
                    <td className="py-2 text-right text-slate-700">
                      {p.sale_price === null || p.sale_price === undefined ? "—" : `฿${Number(p.sale_price).toFixed(2)}`}
                    </td>
                    <td className="py-2 text-right text-emerald-600 font-medium">
                      {p.total_cost === null ? "—" : `฿${Number(p.total_cost).toFixed(2)}`}
                    </td>
                    <td className="py-2">
                      <Badge className={`text-[10px] rounded-[4px] ${p.active ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-200 text-slate-600'}`}>
                        {p.active ? "Active" : "Inactive"}
                      </Badge>
                    </td>
                    <td className="py-2 text-right">
                      <div className="flex justify-end gap-1">
                        <Button variant="ghost" size="sm" onClick={() => handleOpen(p.id)} className="h-6 w-6 p-0">
                          <Eye className="h-3 w-3" />
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
                    <td colSpan={6} className="py-8 text-center text-slate-400">No products yet</td>
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
                  <span className="text-xs font-mono text-emerald-600">
                    {p.total_cost === null ? "—" : `฿${Number(p.total_cost).toFixed(2)}`}
                  </span>
                </div>
                <div className="text-[10px] text-slate-500">
                  Sale: {p.sale_price === null || p.sale_price === undefined ? "—" : `฿${Number(p.sale_price).toFixed(2)}`}
                </div>
                <div className="flex gap-1 mt-2">
                  <Button variant="outline" size="sm" onClick={() => handleOpen(p.id)} className="h-8 text-xs flex-1 rounded-[4px]">
                    <Eye className="h-3 w-3 mr-1" /> View
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

    </div>
  );
}
