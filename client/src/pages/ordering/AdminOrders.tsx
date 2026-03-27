import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";

const STATUSES = ["PENDING", "ACCEPTED", "PREPARING", "READY", "COMPLETED", "CANCELLED"] as const;

type OnlineOrderItem = {
  itemId: string | null;
  sku: string | null;
  name: string;
  quantity: number;
  unitPrice: number;
  lineTotal: number;
  modifiers?: Array<{ optionName?: string }>;
};

type OnlineOrder = {
  id: string;
  orderNumber: string;
  createdAt: string;
  status: string;
  channel: string;
  customerName?: string | null;
  customerPhone?: string | null;
  total: number;
  items: OnlineOrderItem[];
};

type OnlineOrdersResponse = {
  orders: OnlineOrder[];
};

export default function AdminOrders() {
  const queryClient = useQueryClient();
  const [statusFilter, setStatusFilter] = useState<string>("ALL");

  const { data, isLoading, isError } = useQuery<OnlineOrdersResponse>({
    queryKey: ["/api/online/orders", statusFilter],
    queryFn: async () => {
      const qs = statusFilter === "ALL" ? "" : `?status=${encodeURIComponent(statusFilter)}`;
      const response = await fetch(`/api/online/orders${qs}`);
      if (!response.ok) throw new Error("Failed to load");
      return response.json();
    },
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
      <div className="mb-4">
        <label className="text-sm mr-2">Filter status</label>
        <select className="border rounded px-2 py-1" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
          <option value="ALL">All</option>
          {STATUSES.map((status) => <option key={status} value={status}>{status}</option>)}
        </select>
      </div>

      {orders.length === 0 ? (
        <p className="text-gray-500">No orders yet.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="min-w-full border border-gray-200 text-sm">
            <thead className="bg-gray-50">
              <tr>
                <th className="border px-3 py-2 text-left">Order</th>
                <th className="border px-3 py-2 text-left">Time</th>
                <th className="border px-3 py-2 text-left">Customer</th>
                <th className="border px-3 py-2 text-left">Items</th>
                <th className="border px-3 py-2 text-left">Total</th>
                <th className="border px-3 py-2 text-left">Status</th>
              </tr>
            </thead>
            <tbody>
              {orders.map((order) => (
                <tr key={order.id} className="border-t">
                  <td className="border px-3 py-2 font-medium">{order.orderNumber || order.id}</td>
                  <td className="border px-3 py-2">{new Date(order.createdAt).toLocaleString("en-TH", { timeZone: "Asia/Bangkok" })}</td>
                  <td className="border px-3 py-2">{order.customerName || "-"}<br />{order.customerPhone || ""}</td>
                  <td className="border px-3 py-2">
                    <div className="space-y-1">
                      {order.items.map((item, index) => (
                        <div key={`${order.id}-${index}`}>
                          {item.quantity}x {item.name}
                          {Array.isArray(item.modifiers) && item.modifiers.length > 0 ? ` (${item.modifiers.map((m: any) => m.optionName).filter(Boolean).join(", ")})` : ""}
                        </div>
                      ))}
                    </div>
                  </td>
                  <td className="border px-3 py-2">฿{order.total}</td>
                  <td className="border px-3 py-2">
                    <select
                      className="border rounded px-2 py-1"
                      value={order.status}
                      onChange={(event) => updateStatus.mutate({ id: order.id, status: event.target.value })}
                      disabled={updateStatus.isPending}
                    >
                      {STATUSES.map((status) => (
                        <option key={status} value={status}>{status}</option>
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
