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
      <h1 className="text-2xl font-extrabold font-[Poppins] mb-4">Shopping List</h1>

      {isLoading && <p>Loading...</p>}
      {error && <p className="text-red-500">Failed to load shopping list.</p>}

      {!isLoading && !error && (
        items.length === 0 ? (
          <p>No shopping list generated yet.</p>
        ) : (
          <table className="min-w-full bg-white border border-gray-200 rounded-lg">
            <thead>
              <tr className="bg-gray-100 text-left text-sm font-semibold font-[Poppins]">
                <th className="p-2 border-b">Name</th>
                <th className="p-2 border-b">Qty</th>
                <th className="p-2 border-b">Unit</th>
                <th className="p-2 border-b">Notes</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item: any, idx: number) => (
                <tr key={idx} className="text-sm font-[Poppins]">
                  <td className="p-2 border-b">{item.name || item.itemName || ''}</td>
                  <td className="p-2 border-b">{item.qty || item.quantity || ''}</td>
                  <td className="p-2 border-b">{item.unit || ''}</td>
                  <td className="p-2 border-b">{item.notes || ''}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )
      )}
    </div>
  );
}
