import React from "react";

export default function POSItemGrid({ items, onSelect }) {
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "repeat(3, 1fr)",
        gap: 16
      }}
    >
      {items.map((i) => (
        <button
          key={i.id}
          onClick={() => onSelect(i)}
          style={{
            padding: 20,
            background: "#f2f2f2",
            border: "1px solid #ccc",
            borderRadius: 10,
            fontSize: 22,
            textAlign: "left"
          }}
        >
          <strong>{i.name}</strong>
          <br />
          {i.price} THB
        </button>
      ))}
    </div>
  );
}
