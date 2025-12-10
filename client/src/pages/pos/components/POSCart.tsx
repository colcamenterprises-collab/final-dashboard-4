import React from "react";

export default function POSCart({ cart, onCheckout, onRemove }) {
  const total = cart.reduce((sum, item) => sum + item.total, 0);

  return (
    <div
      style={{
        position: "fixed",
        right: 0,
        top: 0,
        bottom: 0,
        width: "30%",
        background: "#fff",
        borderLeft: "3px solid #000",
        padding: 20,
        overflowY: "auto"
      }}
    >
      <h2 style={{ fontSize: 26 }}>Cart</h2>

      {cart.map((i, idx) => (
        <div key={idx} style={{ marginBottom: 20 }}>
          <strong>{i.name}</strong> — {i.price} THB  
          <br />
          Qty: {i.qty}
          <br />
          {i.modifiers.length > 0 && (
            <ul>
              {i.modifiers.map((m) => (
                <li key={m.id}>
                  {m.name} (+{m.price})
                </li>
              ))}
            </ul>
          )}

          <button
            onClick={() => onRemove(idx)}
            style={{
              marginTop: 6,
              background: "#b30000",
              color: "white",
              padding: 8,
              border: "none",
              borderRadius: 6
            }}
          >
            Remove
          </button>
        </div>
      ))}

      <h2>Total: {total} THB</h2>

      <button
        onClick={onCheckout}
        style={{
          padding: 16,
          width: "100%",
          fontSize: 22,
          background: "#ff6700",
          color: "white",
          border: "none",
          borderRadius: 8
        }}
      >
        Checkout
      </button>
    </div>
  );
}
