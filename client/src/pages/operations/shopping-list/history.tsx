// PATCH 5C — Shopping List History
import { useQuery } from '@tanstack/react-query';
import axios from 'axios';

export default function ShoppingListHistory() {
  const { data, isLoading, error } = useQuery({
    queryKey: ['shopping-list-history'],
    queryFn: async () => {
      const res = await axios.get('/api/shopping-list/history');
      return res.data;
    },
  });

  const lists: any[] = data?.lists || [];

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-4">Shopping List History</h1>

      {isLoading && <p>Loading...</p>}
      {error && <p className="text-red-500">Failed to load history.</p>}

      {!isLoading && !error && lists.length === 0 && <p>No history found.</p>}

      <div className="space-y-3">
        {lists.map((l: any) => {
          const date = new Date(l.createdAt).toLocaleString("en-TH", {
            timeZone: "Asia/Bangkok",
          });

          return (
            <div key={l.id} className="border p-4 rounded" data-testid={`history-item-${l.id}`}>
              <strong>{date}</strong>

              <div className="mt-2 space-x-2">
                <button
                  onClick={() => window.open("/operations/shopping-list/view/" + l.salesId)}
                  className="px-3 py-1 bg-black text-white rounded"
                  data-testid={`button-view-${l.id}`}
                >
                  View Items
                </button>

                <button
                  onClick={() =>
                    window.open("/api/shopping-list/pdf/latest?date=" + l.createdAt)
                  }
                  className="px-3 py-1 bg-gray-700 text-white rounded"
                  data-testid={`button-pdf-${l.id}`}
                >
                  Download PDF
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
