import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Printer, Plus, Edit2, Trash2, Search } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

export default function Ingredients() {
  const [csvContent, setCsvContent] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("");
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Get ingredients from the actual ingredients API that has all the data
  const { data: ingredients, isLoading } = useQuery({
    queryKey: ["/api/ingredients"],
  });

  // Keep the CSV import functionality for the costing system
  const { data: costingIngredientsData } = useQuery({
    queryKey: ["/api/costing/ingredients"],
  });

  const importMutation = useMutation({
    mutationFn: async (csv: string) => {
      const r = await fetch("/api/costing/ingredients/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ csv }),
      });

      // If server didn't return JSON OK, read the text so we don't get the '<!DOCTYPE' error
      if (!r.ok) {
        const msg = await r.text();
        throw new Error(`Import failed: ${msg}`);
      }
      const j = await r.json();
      if (!j.ok) throw new Error(j.error || "Import failed");
      return j;
    },
    onSuccess: (data) => {
      toast({ title: "Success", description: `Imported ${data.imported} ingredients` });
      queryClient.invalidateQueries({ queryKey: ["/api/costing/ingredients"] });
      setCsvContent("");
    },
    onError: (error: any) => {
      console.error(error);
      toast({ title: "Error", description: error.message || "Import failed", variant: "destructive" });
    }
  });

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (e) => {
        setCsvContent(e.target?.result as string);
      };
      reader.readAsText(file);
    }
  };

  const handleImport = () => {
    if (csvContent.trim()) {
      importMutation.mutate(csvContent);
    }
  };

  const handlePrint = () => {
    window.open('/api/ingredients/print', '_blank');
  };

  const formatPrice = (price: string | undefined | null) => {
    const numPrice = parseFloat(price || '0');
    return `฿${isNaN(numPrice) ? '0.00' : numPrice.toFixed(2)}`;
  };

  const getCategoryColor = (category: string) => {
    const colors: { [key: string]: string } = {
      'Fresh Food': 'bg-green-100 text-green-800',
      'Frozen Food': 'bg-blue-100 text-blue-800',
      'Drinks': 'bg-purple-100 text-purple-800',
      'Kitchen Supplies': 'bg-orange-100 text-orange-800',
      'Packaging': 'bg-gray-100 text-gray-800',
      'Shelf Items': 'bg-yellow-100 text-yellow-800',
    };
    return colors[category] || 'bg-gray-100 text-gray-800';
  };

  // Filter ingredients
  const filteredIngredients = (ingredients || []).filter((ingredient: any) => {
    const matchesSearch = ingredient.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         ingredient.supplier?.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCategory = !selectedCategory || ingredient.category === selectedCategory;
    return matchesSearch && matchesCategory;
  });

  const categories = [...new Set((ingredients || []).map((ing: any) => ing.category).filter(Boolean))];

  const costingIngredients = costingIngredientsData?.list || [];

  return (
    <div className="container mx-auto p-6">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-3xl font-bold">Ingredient Management</h1>
          <p className="text-gray-600 mt-2">Manage your restaurant's ingredient inventory and pricing</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={handlePrint}>
            <Printer className="h-4 w-4 mr-2" />
            Print
          </Button>
        </div>
      </div>

      {/* Search and Filter */}
      <div className="mb-6 flex flex-col sm:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
          <Input
            placeholder="Search ingredients by name or supplier..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10"
          />
        </div>
        <Select value={selectedCategory || "all"} onValueChange={(value) => setSelectedCategory(value === "all" ? "" : value)}>
          <SelectTrigger className="w-full sm:w-48">
            <SelectValue placeholder="All Categories" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Categories</SelectItem>
            {categories.map((category) => (
              <SelectItem key={category} value={category}>
                {category}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Main Ingredients Table */}
      <div className="border rounded-lg mb-8">
        <div className="p-4 border-b bg-gray-50">
          <h2 className="text-xl font-semibold">Current Ingredients</h2>
        </div>
        {isLoading ? (
          <div className="text-center py-8">Loading...</div>
        ) : filteredIngredients.length === 0 ? (
          <div className="text-center py-8 text-gray-500">No ingredients found</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b bg-gray-50">
                  <th className="text-left py-3 px-4 font-semibold">Item</th>
                  <th className="text-left py-3 px-4 font-semibold">Category</th>
                  <th className="text-left py-3 px-4 font-semibold">Supplier</th>
                  <th className="text-left py-3 px-4 font-semibold">Brand</th>
                  <th className="text-left py-3 px-4 font-semibold">Packaging Qty</th>
                  <th className="text-left py-3 px-4 font-semibold">Cost</th>
                  <th className="text-left py-3 px-4 font-semibold">Average Menu Portion</th>
                  <th className="text-left py-3 px-4 font-semibold">Last Review Date</th>
                  <th className="text-left py-3 px-4 font-semibold">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredIngredients.map((ingredient: any) => (
                  <tr key={ingredient.id} className="border-b hover:bg-gray-50">
                    <td className="py-3 px-4 font-medium">{ingredient.name}</td>
                    <td className="py-3 px-4">
                      <Badge className={getCategoryColor(ingredient.category)}>
                        {ingredient.category}
                      </Badge>
                    </td>
                    <td className="py-3 px-4">{ingredient.supplier}</td>
                    <td className="py-3 px-4">{(ingredient as any).brand || '-'}</td>
                    <td className="py-3 px-4">{(ingredient as any).packagingQty || '-'}</td>
                    <td className="py-3 px-4 font-semibold text-green-600">
                      {(ingredient as any).cost || formatPrice(ingredient.unitPrice)}
                    </td>
                    <td className="py-3 px-4">{(ingredient as any).averageMenuPortion || '-'}</td>
                    <td className="py-3 px-4">{(ingredient as any).lastReviewDate || '-'}</td>
                    <td className="py-3 px-4">
                      <div className="flex space-x-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          title="Edit ingredient"
                        >
                          <Edit2 className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          title="Delete ingredient"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

        {/* CSV Import Section */}
        <div className="border rounded-lg">
          <div className="p-4 border-b bg-gray-50">
            <h2 className="text-xl font-semibold">Import from CSV</h2>
          </div>
          <div className="p-6">
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-2">
                Upload CSV (name, unit, unitCost, supplier)
              </label>
              <Input
                type="file"
                accept=".csv"
                onChange={handleFileUpload}
                className="block w-full"
              />
            </div>
            {csvContent && (
              <div>
                <label className="block text-sm font-medium mb-2">CSV Preview:</label>
                <textarea
                  value={csvContent.substring(0, 500)}
                  readOnly
                  className="w-full h-32 p-3 border rounded-md text-sm font-mono"
                />
              </div>
            )}
            <Button
              onClick={handleImport}
              disabled={!csvContent.trim() || importMutation.isPending}
            >
              {importMutation.isPending ? "Importing..." : "Import Ingredients"}
            </Button>
          </div>
        </div>

        {/* Costing System Ingredients (for CSV import reference) */}
        <div className="border rounded-lg">
          <div className="p-4 border-b bg-gray-50">
            <h2 className="text-xl font-semibold">Costing System Ingredients</h2>
            <p className="text-sm text-gray-600">Basic ingredient data for costing calculations</p>
          </div>
          {costingIngredients.length === 0 ? (
            <div className="text-center py-8 text-gray-500">No costing ingredients found</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b bg-gray-50">
                    <th className="text-left py-3 px-4 font-semibold">Name</th>
                    <th className="text-left py-3 px-4 font-semibold">Unit</th>
                    <th className="text-left py-3 px-4 font-semibold">Unit Cost (฿)</th>
                    <th className="text-left py-3 px-4 font-semibold">Supplier</th>
                  </tr>
                </thead>
                <tbody>
                  {costingIngredients.map((ingredient: any) => (
                    <tr key={ingredient.id} className="border-b hover:bg-gray-50">
                      <td className="py-3 px-4">{ingredient.name}</td>
                      <td className="py-3 px-4">{ingredient.unit}</td>
                      <td className="py-3 px-4">{Number(ingredient.unitCost).toFixed(2)}</td>
                      <td className="py-3 px-4">{ingredient.supplier || "-"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}