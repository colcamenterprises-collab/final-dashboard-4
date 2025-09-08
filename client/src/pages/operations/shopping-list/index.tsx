// Do not do this:
// – Do not rename, move, or split this file
// – Do not remove existing pages
// – Only apply exactly what is written below

import React, { useEffect, useState } from "react";

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
};

export default function ShoppingListPage() {
  const [date, setDate] = useState(() => new Date().toISOString().split("T")[0]);
  const [items, setItems] = useState<Item[]>([]);
  const [loading, setLoading] = useState(false);

  async function fetchList(d: string) {
    setLoading(true);
    try {
      const res = await fetch(`/api/forms/daily-sales/v2`);
      const data = await res.json();
      
      if (data.ok && data.records) {
        // Extract requisition items from records on the selected date
        const selectedDate = new Date(d).toISOString().split('T')[0];
        const allItems: Item[] = [];
        
        data.records.forEach((record: any) => {
          const recordDate = new Date(record.date).toISOString().split('T')[0];
          if (recordDate === selectedDate && record.payload?.requisition) {
            record.payload.requisition.forEach((item: any) => {
              allItems.push({
                name: item.name,
                qty: item.qty,
                unit: item.unit,
                category: item.category || 'General',
                cost: 0 // Cost will be calculated if needed
              });
            });
          }
        });
        
        // Group and sum quantities for duplicate items
        const groupedItems = allItems.reduce((acc: any, item) => {
          const key = item.name;
          if (acc[key]) {
            acc[key].qty += item.qty;
          } else {
            acc[key] = { ...item };
          }
          return acc;
        }, {});
        
        setItems(Object.values(groupedItems));
      } else {
        setItems([]);
      }
    } catch (err) {
      console.error('Failed to fetch shopping list:', err);
      setItems([]);
    }
    setLoading(false);
  }

  useEffect(() => {
    fetchList(date);
  }, [date]);

  const total = items.reduce((sum, i) => sum + i.cost, 0);

  return (
    <div className="p-6">
      <h1 className="text-2xl font-extrabold font-[Poppins] mb-4">Shopping List</h1>
      <div className="mb-4">
        <label className="mr-2">Select Date:</label>
        <input
          type="date"
          value={date}
          onChange={(e) => setDate(e.target.value)}
          className="border p-2 rounded"
        />
      </div>

      {loading && <p>Loading...</p>}

      {items.length === 0 ? (
        <p>No shopping list found for this date.</p>
      ) : (
        <table className="min-w-full bg-white border border-gray-200 rounded-lg">
          <thead>
            <tr className="bg-gray-100 text-left text-sm font-semibold font-[Poppins]">
              <th className="p-2 border-b">Category</th>
              <th className="p-2 border-b">Item</th>
              <th className="p-2 border-b">Qty</th>
              <th className="p-2 border-b">Unit</th>
              <th className="p-2 border-b">Cost</th>
            </tr>
          </thead>
          <tbody>
            {items.map((i, idx) => (
              <tr key={idx} className="text-sm font-[Poppins]">
                <td className="p-2 border-b">{i.category}</td>
                <td className="p-2 border-b">{i.name}</td>
                <td className="p-2 border-b">{i.qty}</td>
                <td className="p-2 border-b">{i.unit}</td>
                <td className="p-2 border-b">{thb(i.cost)}</td>
              </tr>
            ))}
            <tr>
              <td colSpan={4} className="p-2 text-right font-bold">
                Total
              </td>
              <td className="p-2 font-bold">{thb(total)}</td>
            </tr>
          </tbody>
        </table>
      )}
    </div>
  );
}