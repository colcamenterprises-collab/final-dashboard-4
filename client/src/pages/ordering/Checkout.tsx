// PATCH O2 — CHECKOUT PAGE
// PATCH O4 — QR PAYMENT COMPONENT
// PATCH O7 — HYBRID REFERRAL + MANUAL PARTNER SELECTOR
import { useState, useEffect } from "react";
import axios from "../../utils/axiosInstance";
import { useCart } from "../../lib/cartStore";
import QRCodePayment from "../../components/QRCodePayment";

type Partner = { id: string; name: string; code: string };

export default function Checkout() {
  const { items, clearCart } = useCart();

  const [customerName, setCustomerName] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [orderType, setOrderType] = useState("pickup");
  const [address, setAddress] = useState("");
  // PATCH O7 — Get partner code from session storage first
  const [partnerCode, setPartnerCode] = useState(() => localStorage.getItem("partnerCode") || "");
  const [manualPartner, setManualPartner] = useState("");
  const [partners, setPartners] = useState<Partner[]>([]);
  const [notes, setNotes] = useState("");
  const [paymentType, setPaymentType] = useState("cash");
  const [isSubmitting, setIsSubmitting] = useState(false);

  // PATCH O7 — Load partner list for manual selection
  useEffect(() => {
    axios.get("/partners/all").then((res) => setPartners(res.data)).catch(() => {});
  }, []);

  const subtotal = items.reduce((s, i) => s + i.total, 0);
  const total = subtotal;

  const submitOrder = async () => {
    if (!customerName || !customerPhone) {
      alert("Please enter your name and phone number");
      return;
    }

    if (orderType === "delivery" && !address) {
      alert("Please enter your delivery address");
      return;
    }

    setIsSubmitting(true);

    // static fallback coords for Rawai (until map search added)
    const lat = 7.78;
    const lng = 98.32;

    try {
      const res = await axios.post("/orders-v2/create", {
        customerName,
        customerPhone,
        orderType,
        address,
        notes,
        partnerCode,
        paymentType,
        items,
        subtotal,
        total,
        lat,
        lng,
      });
      // PATCH O7 — If manual partner selected, call manual-partner endpoint
      if (manualPartner && res.data.orderId) {
        await axios.post("/orders-v2/manual-partner", {
          orderId: res.data.orderId,
          partnerId: manualPartner,
        });
      }

      clearCart();
      // PATCH O3 — Pass orderNumber to confirmation
      // PATCH O4 — Pass ETA to confirmation
      const orderNumber = res.data.orderNumber || '';
      const etaJSON = encodeURIComponent(JSON.stringify(res.data.eta || {}));
      window.location.href =
        "/online-ordering/confirmation?orderId=" + res.data.orderId + "&orderNumber=" + orderNumber + "&etaJSON=" + etaJSON;
    } catch (err: any) {
      alert(err.response?.data?.error || "Order failed");
      setIsSubmitting(false);
    }
  };

  if (items.length === 0) {
    return (
      <div className="p-6 text-center">
        <h1 className="text-xl font-bold mb-4">Your cart is empty</h1>
        <a href="/order" className="text-blue-600 underline">
          Back to menu
        </a>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-md mx-auto">
      <h1 className="text-xl font-bold mb-4">Checkout</h1>

      <div className="mb-4 border rounded p-3 bg-gray-50">
        <h2 className="font-semibold mb-2">Order Summary</h2>
        {items.map((item, i) => (
          <div key={i} className="flex justify-between text-sm py-1">
            <span>{item.qty}x {item.itemName}</span>
            <span>{item.total} THB</span>
          </div>
        ))}
        <div className="border-t mt-2 pt-2 font-bold flex justify-between">
          <span>Total</span>
          <span>{total} THB</span>
        </div>
      </div>

      <div className="space-y-3">
        <input
          className="border p-2 rounded w-full"
          placeholder="Name *"
          value={customerName}
          onChange={(e) => setCustomerName(e.target.value)}
          data-testid="input-customer-name"
        />

        <input
          className="border p-2 rounded w-full"
          placeholder="Phone *"
          value={customerPhone}
          onChange={(e) => setCustomerPhone(e.target.value)}
          data-testid="input-customer-phone"
        />

        <select
          className="border p-2 rounded w-full"
          value={orderType}
          onChange={(e) => setOrderType(e.target.value)}
          data-testid="select-order-type"
        >
          <option value="pickup">Pickup</option>
          <option value="delivery">Delivery</option>
          <option value="instore">In Store</option>
        </select>

        {orderType === "delivery" && (
          <input
            className="border p-2 rounded w-full"
            placeholder="Delivery Address *"
            value={address}
            onChange={(e) => setAddress(e.target.value)}
            data-testid="input-address"
          />
        )}

        <input
          className="border p-2 rounded w-full"
          placeholder="Partner Code (Optional)"
          value={partnerCode}
          onChange={(e) => setPartnerCode(e.target.value)}
          data-testid="input-partner-code"
        />

        {/* PATCH O7 — Manual Partner Selector (Fallback) */}
        <select
          className="border p-2 rounded w-full"
          value={manualPartner}
          onChange={(e) => setManualPartner(e.target.value)}
          data-testid="select-partner"
        >
          <option value="">Not a partner order</option>
          {partners.map((p) => (
            <option key={p.id} value={p.id}>{p.name}</option>
          ))}
        </select>

        <textarea
          className="border p-2 rounded w-full"
          placeholder="Order Notes"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          data-testid="textarea-notes"
        />

        <select
          className="border p-2 rounded w-full"
          value={paymentType}
          onChange={(e) => setPaymentType(e.target.value)}
          data-testid="select-payment-type"
        >
          <option value="cash">Cash</option>
          <option value="qr">QR Payment</option>
          <option value="pickup-cash">Pay on Pickup</option>
        </select>

        {paymentType === "qr" && <QRCodePayment amount={total} />}

        <button
          onClick={submitOrder}
          disabled={isSubmitting}
          className="px-4 py-2 bg-black text-white rounded w-full disabled:opacity-50"
          data-testid="button-place-order"
        >
          {isSubmitting ? "Submitting..." : `Place Order · ${total} THB`}
        </button>
      </div>
    </div>
  );
}
