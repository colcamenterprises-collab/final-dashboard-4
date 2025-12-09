import React, { useEffect, useState } from "react";
import KDSOrderCard from "./KDSOrderCard";
import axios from "axios";

export default function KDS() {
  const [orders, setOrders] = useState([]);

  async function load() {
    try {
      const res = await axios.get("/api/kds/active");
      if (res.data.success) setOrders(res.data.orders);
    } catch (err) {
      console.error("KDS load error:", err);
    }
  }

  async function updateStatus(orderId, status) {
    try {
      await axios.post("/api/kds/update-status", { orderId, status });
      await load();
    } catch (err) {
      console.error("KDS update error:", err);
    }
  }

  useEffect(() => {
    load();
    const interval = setInterval(load, 5000); // auto-refresh 5s
    return () => clearInterval(interval);
  }, []);

  return (
    <div style={{ padding: "24px" }}>
      <h1 style={{ fontSize: "40px", marginBottom: "20px" }}>
        Kitchen Display System
      </h1>

      {orders.length === 0 && (
        <h2 style={{ fontSize: "24px" }}>No active orders</h2>
      )}

      {orders.map((order) => (
        <KDSOrderCard
          key={order.id}
          order={order}
          onUpdate={updateStatus}
        />
      ))}
    </div>
  );
}
