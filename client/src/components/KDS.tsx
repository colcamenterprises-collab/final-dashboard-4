import { useEffect, useState } from "react";

type Order = {
  id: string;
  kdsStatus: string;
  items: Array<{ id: string; itemName: string; qty: number }>;
};

export default function BlazeKDS() {
  const [orders, setOrders] = useState<Order[]>([]);

  const load = async () => {
    const res = await fetch("/api/kds/active");
    const data = await res.json();
    if (data.success) setOrders(data.orders || []);
  };

  useEffect(() => {
    load();
    const stream = new EventSource("/api/pos/events");
    stream.onmessage = () => load();
    return () => stream.close();
  }, []);

  return (
    <div style={{ padding: 16 }}>
      <h2>KDS</h2>
      {orders.map((order) => (
        <div key={order.id} style={{ border: "1px solid #ddd", padding: 8, marginBottom: 8 }}>
          <strong>{order.id}</strong> ({order.kdsStatus})
          {order.items.map((item) => (
            <div key={item.id}>{item.itemName} x {item.qty}</div>
          ))}
        </div>
      ))}
    </div>
  );
}
