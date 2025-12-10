import React from "react";

export default function POSModifierSheet({ item, groups, onSelectModifier, onFinish }) {
  if (!item) return null;

  return (
    <div
      style={{
        position: "fixed",
        bottom: 0,
        left: 0,
        right: 0,
        background: "white",
        borderTop: "3px solid #000",
        padding: 20,
        maxHeight: "60vh",
        overflowY: "auto"
      }}
    >
      <h2 style={{ fontSize: 26, marginBottom: 10 }}>{item.name} — Modifiers</h2>

      {groups.map((g) => (
        <div key={g.id} style={{ marginBottom: 20 }}>
          <h3>{g.name}</h3>
          {g.modifiers.map((m) => (
            <button
              key={m.id}
              onClick={() => onSelectModifier(g, m)}
              style={{
                display: "block",
                width: "100%",
                padding: 14,
                marginBottom: 6,
                fontSize: 20,
                border: "1px solid #ccc",
                background: "#fafafa",
                borderRadius: 6
              }}
            >
              {m.name} (+{m.price} THB)
            </button>
          ))}
        </div>
      ))}

      <button
        onClick={onFinish}
        style={{
          marginTop: 20,
          padding: 14,
          width: "100%",
          background: "#000",
          color: "white",
          fontSize: 22,
          borderRadius: 8
        }}
      >
        Add to Cart
      </button>
    </div>
  );
}
