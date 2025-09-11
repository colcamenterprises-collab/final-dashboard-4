// Do not do this:
// – Do not rename, move, or split this file
// – Do not remove existing pages
// – Only apply exactly what is written below

import { useQuery } from '@tanstack/react-query';
import axios from 'axios';

// THB formatting helper
const thb = (v: unknown): string => {
  const n = typeof v === "number" && Number.isFinite(v) ? v : Number(v) || 0;
  return "฿" + n.toLocaleString("en-TH", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
};

type Item = {
  name: string;
  qty: number;
  unit: string;
  category: string;
  cost: number;
  unitCost?: number;
  supplier?: string;
  brand?: string;
  package?: string;
  portion?: string;
  lastReview?: string;
};

export default function ShoppingListPage() {
  const { data, isLoading } = useQuery({ 
    queryKey: ['shopping-list'], 
    queryFn: () => axios.get('/api/shopping-list') 
  });
  
  const { list = [], totalCost = 0 } = data?.data?.data || { list: [], totalCost: 0 };
  const items: Item[] = list.map((item: any) => ({
    name: item.name,
    category: item.category || 'General',
    supplier: item.supplier || 'Unknown',
    brand: item.brand || '',
    qty: item.qty,
    package: item.package || item.unit,
    portion: item.portion || '',
    cost: item.totalCost || item.cost || 0,
    unitCost: item.unitCost || 0,
    lastReview: item.lastReview || '',
    unit: item.unit
  }));

  const total = totalCost || items.reduce((sum, i) => sum + i.cost, 0);

  return (
    <div className="p-6">
      <h1 className="text-2xl font-extrabold font-[Poppins] mb-4">Shopping List</h1>
      
      {isLoading && <p>Loading...</p>}

      {items.length === 0 ? (
        <p>No shopping list found for today.</p>
      ) : (
        <table className="min-w-full bg-white border border-gray-200 rounded-lg">
          <thead>
            <tr className="bg-gray-100 text-left text-sm font-semibold font-[Poppins]">
              <th className="p-2 border-b">Name</th>
              <th className="p-2 border-b">Category</th>
              <th className="p-2 border-b">Supplier</th>
              <th className="p-2 border-b">Brand</th>
              <th className="p-2 border-b">Qty</th>
              <th className="p-2 border-b">Package</th>
              <th className="p-2 border-b">Portion</th>
              <th className="p-2 border-b">Cost (THB)</th>
              <th className="p-2 border-b">Last Review</th>
            </tr>
          </thead>
          <tbody>
            {items.map((i, idx) => (
              <tr key={idx} className="text-sm font-[Poppins]">
                <td className="p-2 border-b">{i.name}</td>
                <td className="p-2 border-b">{i.category}</td>
                <td className="p-2 border-b">{i.supplier}</td>
                <td className="p-2 border-b">{i.brand}</td>
                <td className="p-2 border-b">{i.qty}</td>
                <td className="p-2 border-b">{i.package}</td>
                <td className="p-2 border-b">{i.portion}</td>
                <td className="p-2 border-b font-semibold">{thb(i.cost)}</td>
                <td className="p-2 border-b text-xs text-gray-600">{i.lastReview}</td>
              </tr>
            ))}
            <tr className="bg-green-50">
              <td colSpan={7} className="p-2 text-right font-bold text-green-800">
                Total Estimated Cost
              </td>
              <td className="p-2 font-bold text-green-800 text-lg">{thb(total)}</td>
              <td className="p-2"></td>
            </tr>
          </tbody>
        </table>
      )}
      
      <div className="mt-4 text-sm text-gray-600">
        Loaded list length: {items.length}, drinks count: {items.filter(i => i.category === 'Drinks').length}
      </div>
    </div>
  );
}