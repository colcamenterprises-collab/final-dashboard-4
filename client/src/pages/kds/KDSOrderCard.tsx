import React from "react";

export default function KDSOrderCard({ order, onUpdate }) {
  const minutes = Math.floor(
    (Date.now() - new Date(order.createdAt).getTime()) / 60000
  );

  return (
    <div
      style={{
        border: "2px solid #000",
        borderRadius: "12px",
        padding: "16px",
        marginBottom: "16px",
        background: "#fff",
      }}
    >
      <h2 style={{ fontSize: "24px", fontWeight: "700" }}>
        #{order.orderNumber || "???"}
      </h2>

      <div style={{ marginBottom: "8px", fontSize: "16px" }}>
        <strong>Type:</strong> {order.orderType?.toUpperCase()}
      </div>

      {order.partner && (
        <div style={{ color: "purple", fontWeight: "700" }}>
          Partner: {order.partner.name}
        </div>
      )}

      {order.delivery && (
        <div style={{ color: "green" }}>
          Delivery — Status: {order.delivery.status}
        </div>
      )}

      <div style={{ margin: "12px 0" }}>
        <strong>Items:</strong>
        <ul>
          {order.items.map((item) => (
            <li key={item.id}>
              {item.name} × {item.quantity}
              {item.modifiers?.length > 0 && (
                <ul style={{ marginLeft: "12px" }}>
                  {item.modifiers.map((m) => (
                    <li key={m.id}>{m.name}</li>
                  ))}
                </ul>
              )}
            </li>
          ))}
        </ul>
      </div>

      <div style={{ fontSize: "18px", marginBottom: "8px" }}>
        <strong>Age:</strong> {minutes} min
      </div>

      <div style={{ display: "flex", gap: "8px" }}>
        {order.kdsStatus === "new" && (
          <button onClick={() => onUpdate(order.id, "cooking")}>
            Start Cooking
          </button>
        )}
        {order.kdsStatus === "cooking" && (
          <button onClick={() => onUpdate(order.id, "ready")}>Ready</button>
        )}
        {order.kdsStatus === "ready" && (
          <button onClick={() => onUpdate(order.id, "picked_up")}>
            Picked Up
          </button>
        )}
        {order.kdsStatus === "picked_up" && (
          <button onClick={() => onUpdate(order.id, "delivered")}>
            Delivered
          </button>
        )}
      </div>
    </div>
  );
}
