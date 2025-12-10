import React from "react";

export default function POSReceiptPreview() {
  const order = JSON.parse(localStorage.getItem("pos_last_order") || "{}");

  return (
    <div style={{ padding: 40 }}>
      <h1>Order #{order.orderNumber}</h1>

      {order.items?.map((i, idx) => (
        <div key={idx} style={{ marginBottom: 10 }}>
          <strong>{i.name}</strong> — {i.qty} × {i.price}
          {i.modifiers.length > 0 && (
            <ul>
              {i.modifiers.map((m) => (
                <li key={m.id}>
                  {m.name} (+{m.price})
                </li>
              ))}
            </ul>
          )}
        </div>
      ))}

      <h2>Total: {order.total} THB</h2>

      <button
        onClick={() => (window.location.href = "/pos")}
        style={{
          padding: 16,
          fontSize: 22,
          background: "#ff6700",
          color: "white",
          borderRadius: 8,
        }}
      >
        New Order
      </button>
    </div>
  );
}
