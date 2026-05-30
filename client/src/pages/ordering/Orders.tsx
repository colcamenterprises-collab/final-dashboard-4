import { useQuery } from "@tanstack/react-query";
import { Badge } from "@/components/ui/badge";
import { ShoppingBag } from "lucide-react";

interface Order {
  id: string | number;
  orderNumber?: string;
  status?: string;
  customerName?: string;
  customerPhone?: string;
  totalAmount?: number;
  itemCount?: number;
  createdAt?: string;
  type?: string;
}

interface OrdersResponse {
  orders: Order[];
  total?: number;
}

function statusColor(s?: string) {
  switch (s?.toUpperCase()) {
    case "PENDING":    return "bg-amber-100 text-amber-700 border-amber-200";
    case "CONFIRMED":  return "bg-blue-100 text-blue-700 border-blue-200";
    case "PREPARING":  return "bg-purple-100 text-purple-700 border-purple-200";
    case "READY":      return "bg-green-100 text-green-700 border-green-200";
    case "COMPLETED":  return "bg-slate-100 text-slate-600 border-slate-200";
    case "CANCELLED":  return "bg-red-100 text-red-600 border-red-200";
    default:           return "bg-slate-100 text-slate-500 border-slate-200";
  }
}

function formatDate(d?: string) {
  if (!d) return "—";
  const dt = new Date(d);
  return `${String(dt.getDate()).padStart(2,"0")}/${String(dt.getMonth()+1).padStart(2,"0")}/${dt.getFullYear()} ${String(dt.getHours()).padStart(2,"0")}:${String(dt.getMinutes()).padStart(2,"0")}`;
}

export default function Orders() {
  const { data, isLoading, isError } = useQuery<OrdersResponse>({
    queryKey: ["/api/orders"],
  });

  const orders = data?.orders ?? [];

  return (
    <div className="p-4 space-y-4 max-w-4xl mx-auto">
      <div className="flex items-center gap-3">
        <ShoppingBag className="h-5 w-5 text-slate-400" />
        <div>
          <h1 className="text-lg font-semibold text-slate-900 dark:text-white">Orders</h1>
          <p className="text-xs text-slate-500">{orders.length} orders</p>
        </div>
      </div>

      {isLoading && (
        <div className="text-center py-12 text-slate-400 text-xs">Loading orders...</div>
      )}
      {isError && (
        <div className="text-center py-12 text-red-500 text-xs">Failed to load orders.</div>
      )}

      {!isLoading && !isError && orders.length === 0 && (
        <div className="flex flex-col items-center py-16 gap-3 text-slate-400">
          <ShoppingBag className="h-10 w-10 opacity-30" />
          <p className="text-xs">No orders yet.</p>
        </div>
      )}

      {orders.length > 0 && (
        <div className="border border-slate-200 dark:border-slate-700 rounded-lg overflow-hidden">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800">
                <th className="text-left px-3 py-2 font-medium text-slate-500">Order #</th>
                <th className="text-left px-3 py-2 font-medium text-slate-500">Customer</th>
                <th className="text-left px-3 py-2 font-medium text-slate-500">Type</th>
                <th className="text-left px-3 py-2 font-medium text-slate-500">Status</th>
                <th className="text-right px-3 py-2 font-medium text-slate-500">Amount (฿)</th>
                <th className="text-right px-3 py-2 font-medium text-slate-500">Time</th>
              </tr>
            </thead>
            <tbody>
              {orders.map((o, idx) => (
                <tr
                  key={o.id}
                  className={`border-b border-slate-100 dark:border-slate-800 last:border-0 ${
                    idx % 2 === 0 ? "bg-white dark:bg-slate-900" : "bg-slate-50/50 dark:bg-slate-800/50"
                  }`}
                >
                  <td className="px-3 py-2 font-mono text-slate-700 dark:text-slate-300">
                    {o.orderNumber || `#${o.id}`}
                  </td>
                  <td className="px-3 py-2 text-slate-600">{o.customerName || "—"}</td>
                  <td className="px-3 py-2 text-slate-500">{o.type || "—"}</td>
                  <td className="px-3 py-2">
                    <Badge className={`text-[10px] px-1.5 py-0 border ${statusColor(o.status)}`}>
                      {o.status || "Unknown"}
                    </Badge>
                  </td>
                  <td className="px-3 py-2 text-right font-mono text-slate-700 dark:text-slate-300">
                    {o.totalAmount != null ? o.totalAmount.toLocaleString("en-TH", { minimumFractionDigits: 0 }) : "—"}
                  </td>
                  <td className="px-3 py-2 text-right font-mono text-slate-400 text-[10px]">
                    {formatDate(o.createdAt)}
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
