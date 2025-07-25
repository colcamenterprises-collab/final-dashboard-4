import { useState, useEffect } from 'react';
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";

interface Supplier {
  id: number;
  item: string;
  category: string;
  supplier: string;
  brand: string;
  cost: number;
  packagingQty: string;
  unit: string;
  portionSize: string;
  minStock: string;
  reviewedDate?: string;
}

const Purchasing = () => {
  // Fetch suppliers data from JSON endpoint
  const { data: suppliers = [], isLoading } = useQuery<Supplier[]>({
    queryKey: ["/api/suppliers-json"],
  });

  // Group suppliers by category
  const grouped = suppliers.reduce((acc: Record<string, Supplier[]>, item: Supplier) => {
    const cat = item.category || 'Other';
    acc[cat] = acc[cat] || [];
    acc[cat].push(item);
    return acc;
  }, {});

  if (isLoading) {
    return (
      <div className="ml-64 p-6 bg-gradient-to-r from-gray-800 to-gray-900 text-white">
        <div className="text-center text-lg">Loading suppliers...</div>
      </div>
    );
  }

  return (
    <div className="ml-64 p-6 bg-gradient-to-r from-gray-800 to-gray-900 text-white min-h-screen">
      <h1 className="text-3xl font-bold mb-4">Supplier Management</h1>
      <Button className="bg-orange-500 hover:bg-orange-600 text-white px-4 py-2 rounded mb-4">
        + Add Ingredient
      </Button>
      
      {Object.entries(grouped).map(([cat, catItems]) => (
        <div key={cat} className="mb-8">
          <h2 className="text-xl font-bold mb-4 text-orange-400">{cat}</h2>
          <div className="overflow-x-auto">
            <table className="w-full text-left table-auto bg-white/10 rounded-lg border border-gray-600">
              <thead>
                <tr className="border-b border-gray-600 bg-white/5">
                  <th className="px-4 py-3 text-sm font-semibold text-gray-200">Name</th>
                  <th className="px-4 py-3 text-sm font-semibold text-gray-200">Category</th>
                  <th className="px-4 py-3 text-sm font-semibold text-gray-200">Package Price (THB)</th>
                  <th className="px-4 py-3 text-sm font-semibold text-gray-200">Packaging Quantity</th>
                  <th className="px-4 py-3 text-sm font-semibold text-gray-200">Portion Size</th>
                  <th className="px-4 py-3 text-sm font-semibold text-gray-200">Cost/Portion</th>
                  <th className="px-4 py-3 text-sm font-semibold text-gray-200">Supplier</th>
                  <th className="px-4 py-3 text-sm font-semibold text-gray-200">Updated</th>
                  <th className="px-4 py-3 text-sm font-semibold text-gray-200">Actions</th>
                </tr>
              </thead>
              <tbody>
                {catItems.map((item: Supplier) => {
                  // Calculate cost per portion
                  const portionValue = parseFloat(item.portionSize) || 1;
                  const costPerPortion = (item.cost / portionValue).toFixed(2);
                  
                  return (
                    <tr key={item.item} className="border-b border-gray-700 hover:bg-white/5 transition-colors">
                      <td className="px-4 py-3 text-sm text-white font-medium">{item.item}</td>
                      <td className="px-4 py-3 text-sm text-gray-300">{item.category}</td>
                      <td className="px-4 py-3 text-sm text-gray-300">฿{item.cost.toFixed(2)}</td>
                      <td className="px-4 py-3 text-sm text-gray-300">{item.packagingQty}</td>
                      <td className="px-4 py-3 text-sm text-gray-300">{item.portionSize}</td>
                      <td className="px-4 py-3 text-sm text-gray-300">฿{costPerPortion}</td>
                      <td className="px-4 py-3 text-sm text-gray-300">{item.supplier}</td>
                      <td className="px-4 py-3 text-sm text-gray-300">{item.reviewedDate || 'N/A'}</td>
                      <td className="px-4 py-3">
                        <Button 
                          variant="ghost" 
                          size="sm"
                          className="text-blue-400 hover:text-blue-300 hover:bg-blue-400/10"
                        >
                          Edit
                        </Button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      ))}
    </div>
  );
};

export default Purchasing;