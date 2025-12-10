import React, { useState, useEffect } from "react";
import axios from "../../utils/axiosInstance";

export default function POSCheckout() {
  const cart = JSON.parse(localStorage.getItem("pos_cart") || "[]");
  const total = cart.reduce((sum, item) => sum + item.total, 0);

  const [paymentType, setPaymentType] = useState("cash");

  const submitOrder = async () => {
    const payload = {
      source: "pos",
      items: cart.map((i) => ({
        name: i.name,
        qty: i.qty,
        price: i.price,
        modifiers: i.modifiers,
      })),
      paymentType,
      total,
    };

    const res = await axios.post("/api/pos/order/checkout", payload);
    localStorage.setItem("pos_last_order", JSON.stringify(res.data));
    localStorage.removeItem("pos_cart");
    window.location.href = "/pos-receipt";
  };

  return (
    <div style={{ padding: 40 }}>
      <h1>Checkout</h1>
      <h2>Total: {total} THB</h2>

      <select
        value={paymentType}
        onChange={(e) => setPaymentType(e.target.value)}
        style={{ fontSize: 24, padding: 10 }}
      >
        <option value="cash">Cash</option>
        <option value="qr">QR</option>
        <option value="scb">SCB</option>
        <option value="card">Card</option>
      </select>

      <br /><br />

      <button
        onClick={submitOrder}
        style={{
          padding: "16px 24px",
          fontSize: 24,
          background: "#000",
          color: "white",
          borderRadius: 8,
        }}
      >
        Complete Order
      </button>
    </div>
  );
}
