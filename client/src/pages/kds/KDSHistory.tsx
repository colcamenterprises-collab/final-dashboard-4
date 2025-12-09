import React, { useEffect, useState } from "react";
import axios from "axios";

export default function KDSHistory() {
  const [history, setHistory] = useState([]);

  async function load() {
    try {
      const res = await axios.get("/api/kds/history");
      if (res.data.success) setHistory(res.data.history);
    } catch (err) {
      console.error("History load error:", err);
    }
  }

  useEffect(() => {
    load();
  }, []);

  return (
    <div style={{ padding: "24px" }}>
      <h1 style={{ fontSize: "32px", marginBottom: "20px" }}>
        Completed Orders
      </h1>

      {history.length === 0 && (
        <h2 style={{ fontSize: "22px" }}>No completed orders</h2>
      )}

      {history.map((order) => (
        <div
          key={order.id}
          style={{
            border: "1px solid #000",
            padding: "12px",
            borderRadius: "8px",
            marginBottom: "12px",
            background: "#fafafa",
          }}
        >
          <strong>#{order.orderNumber}</strong> — {order.orderType}
          <div>Completed at: {new Date(order.kdsUpdatedAt).toLocaleString()}</div>
        </div>
      ))}
    </div>
  );
}
