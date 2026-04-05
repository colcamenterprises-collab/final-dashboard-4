import { useEffect, useState } from "react";

type DisplayOrder = {
  id: string;
  total: number;
  items: Array<{ id: string; itemName: string; qty: number }>;
};

export default function CustomerDisplay() {
  const [currentOrder, setCurrentOrder] = useState<DisplayOrder | null>(null);

  useEffect(() => {
    const stream = new EventSource("/api/pos/events");
    stream.onmessage = (evt) => {
      const parsed = JSON.parse(evt.data);
      if (parsed.type === "order_created") {
        const order = parsed.payload?.order as DisplayOrder | undefined;
        if (order) setCurrentOrder(order);
      }
    };
    return () => stream.close();
  }, []);

  if (!currentOrder) return <div style={{ padding: 24 }}>Waiting for next order...</div>;

  return (
    <div style={{ padding: 24 }}>
      <h2>Now Preparing</h2>
      <h1>{currentOrder.id}</h1>
      {currentOrder.items.map((item) => (
        <div key={item.id}>{item.itemName} × {item.qty}</div>
      ))}
      <h3>Total: {currentOrder.total.toFixed(2)}</h3>
    </div>
  );
}
