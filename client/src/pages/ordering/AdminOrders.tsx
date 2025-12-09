// PATCH O2 — ADMIN ORDER LIST
import { useQuery } from "@tanstack/react-query";

type OrderModifier = {
  id: string;
  name: string;
  price: number;
};

type OrderItem = {
  id: string;
  itemName: string;
  qty: number;
  basePrice: number;
  modifiers: OrderModifier[];
};

type Order = {
  id: string;
  createdAt: string;
  customerName: string;
  customerPhone: string;
  orderType: string;
  address?: string;
  notes?: string;
  paymentType: string;
  paidStatus: string;
  subtotal: number;
  total: number;
  partnerCode?: string;
  orderNumber?: string;
  loyverseStatus: string;
  items: OrderItem[];
};

export default function AdminOrders() {
  const { data: orders = [], isLoading } = useQuery<Order[]>({
    queryKey: ["/api/orders-v2/all"],
  });

  if (isLoading) {
    return <div className="p-6">Loading orders...</div>;
  }

  return (
    <div className="p-6">
      <h1 className="text-xl font-bold mb-4">Online Orders</h1>

      {orders.length === 0 ? (
        <p className="text-gray-500">No orders yet.</p>
      ) : (
        <div className="space-y-3">
          {orders.map((o) => (
            <div key={o.id} className="border p-4 rounded bg-white shadow" data-testid={`order-card-${o.id}`}>
              <div className="font-bold text-lg">Order #{o.orderNumber || o.id.slice(-6)}</div>
              <div>{o.customerName} — {o.customerPhone}</div>
              <div className="capitalize">{o.orderType} • {o.paymentType}</div>
              <div className="text-sm">
                Payment: <span className={o.paidStatus === 'paid' ? 'text-green-600 font-bold' : 'text-yellow-600'}>{o.paidStatus === 'paid' ? 'PAID' : 'Pending'}</span>
              </div>
              <div className="text-sm">Loyverse: <span className={o.loyverseStatus === 'sent' ? 'text-green-600' : o.loyverseStatus === 'failed' ? 'text-red-600' : 'text-yellow-600'}>{o.loyverseStatus}</span></div>
              {o.address && <div className="text-sm text-gray-600">📍 {o.address}</div>}
              {o.partnerCode && <div className="text-sm text-blue-600">Partner: {o.partnerCode}</div>}
              <div className="mt-2 border-t pt-2">
                {o.items.map((item) => (
                  <div key={item.id} className="text-sm">
                    {item.qty}x {item.itemName} — {item.basePrice * item.qty} THB
                    {item.modifiers.length > 0 && (
                      <span className="text-gray-500 ml-2">
                        (+{item.modifiers.map(m => m.name).join(", ")})
                      </span>
                    )}
                  </div>
                ))}
              </div>
              <div className="font-bold mt-2">Total: {o.total} THB</div>
              <div className="text-sm text-gray-600">
                {new Date(o.createdAt).toLocaleString("en-TH", {
                  timeZone: "Asia/Bangkok",
                })}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
