import React from "react";

export default function POSCategoryBar({ categories, activeCategory, onSelect }) {
  return (
    <div style={{ display: "flex", overflowX: "auto", marginBottom: 20, gap: 10 }}>
      {categories.map((c) => (
        <button
          key={c.id}
          onClick={() => onSelect(c.id)}
          style={{
            padding: "12px 24px",
            fontSize: 20,
            background: activeCategory === c.id ? "#ff6700" : "#000",
            color: "#fff",
            border: "none",
            borderRadius: 8,
            minWidth: 140
          }}
        >
          {c.name}
        </button>
      ))}
    </div>
  );
}
