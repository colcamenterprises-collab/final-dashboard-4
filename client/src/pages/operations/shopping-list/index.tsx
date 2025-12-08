// PATCH 1 & 3 — Shopping List Display Pipeline with PDF Export
// STRICT: This file alone. No modifications elsewhere.

import { useQuery } from '@tanstack/react-query';
import axios from 'axios';

export default function ShoppingListPage() {
  const { data, isLoading, error } = useQuery({
    queryKey: ['shopping-list-latest'],
    queryFn: async () => {
      const res = await axios.get('/api/shopping-list/latest');
      return res.data;
    },
  });

  const items: any[] = Array.isArray(data?.items) ? data.items : [];

  return (
    <div className="p-6">
      <h1 className="text-2xl font-extrabold mb-4">Shopping List</h1>

      <button
        onClick={() => {
          window.open("/api/shopping-list/pdf/latest", "_blank");
        }}
        className="mb-4 px-4 py-2 bg-black text-white rounded hover:bg-gray-800"
        data-testid="button-download-pdf"
      >
        Download PDF
      </button>

      {isLoading && <p>Loading...</p>}
      {error && <p className="text-red-500">Failed to load shopping list.</p>}

      {!isLoading && !error && (
        items.length === 0 ? (
          <p>No items found.</p>
        ) : (
          <ul className="space-y-2">
            {items.map((item: any, i: number) => (
              <li key={i} className="border p-3 rounded" data-testid={`list-item-${i}`}>
                <strong>{item.item}</strong>
                <div>Qty: {item.quantity}</div>
                {item.notes && <div>Notes: {item.notes}</div>}
              </li>
            ))}
          </ul>
        )
      )}
    </div>
  );
}
