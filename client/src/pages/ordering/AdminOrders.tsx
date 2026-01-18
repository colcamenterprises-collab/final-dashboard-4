import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

const STATUSES = ["NEW", "PREPARING", "READY"] as const;

type OnlineOrderItem = {
  productId: string | null;
  name: string;
  quantity: number;
  priceAtTimeOfSale: number;
};

type OnlineOrder = {
  id: string;
  createdAt: string;
  status: string;
  channel: string;
  items: OnlineOrderItem[];
};

type OnlineOrdersResponse = {
  orders: OnlineOrder[];
};

export default function AdminOrders() {
  const queryClient = useQueryClient();
  const { data, isLoading, isError } = useQuery<OnlineOrdersResponse>({
    queryKey: ["/api/online/orders"],
  });

  const updateStatus = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      const response = await fetch(`/api/online/orders/${id}/status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });

      if (!response.ok) {
        const payload = await response.json().catch(() => ({}));
        throw new Error(payload?.error || "Failed to update status");
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/online/orders"] });
    },
  });

  const orders = data?.orders ?? [];

  if (isLoading) {
    return <div className="p-6">Loading orders...</div>;
  }

  if (isError) {
    return <div className="p-6">Failed to load online orders.</div>;
  }

  return (
    <div className="p-6">
      <h1 className="text-xl font-bold mb-4">Online Orders</h1>

      {orders.length === 0 ? (
        <p className="text-gray-500">No orders yet.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="min-w-full border border-gray-200 text-sm">
            <thead className="bg-gray-50">
              <tr>
                <th className="border px-3 py-2 text-left">Order ID</th>
                <th className="border px-3 py-2 text-left">Time</th>
                <th className="border px-3 py-2 text-left">Items</th>
                <th className="border px-3 py-2 text-left">Channel</th>
                <th className="border px-3 py-2 text-left">Status</th>
              </tr>
            </thead>
            <tbody>
              {orders.map((order) => (
                <tr key={order.id} className="border-t">
                  <td className="border px-3 py-2 font-medium">{order.id}</td>
                  <td className="border px-3 py-2">
                    {new Date(order.createdAt).toLocaleString("en-TH", {
                      timeZone: "Asia/Bangkok",
                    })}
                  </td>
                  <td className="border px-3 py-2">
                    <div className="space-y-1">
                      {order.items.map((item, index) => (
                        <div key={`${order.id}-${index}`}>
                          {item.quantity}x {item.name}
                        </div>
                      ))}
                    </div>
                  </td>
                  <td className="border px-3 py-2">{order.channel}</td>
                  <td className="border px-3 py-2">
                    <select
                      className="border rounded px-2 py-1"
                      value={order.status}
                      onChange={(event) =>
                        updateStatus.mutate({ id: order.id, status: event.target.value })
                      }
                      disabled={updateStatus.isPending}
                    >
                      {STATUSES.map((status) => (
                        <option key={status} value={status}>
                          {status}
                        </option>
                      ))}
                    </select>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
