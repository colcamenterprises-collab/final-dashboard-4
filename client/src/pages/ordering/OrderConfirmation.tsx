// PATCH O2 — ORDER CONFIRMATION PAGE
// PATCH O3 — DISPLAY ORDER NUMBER
// PATCH O4 — DISPLAY ETA
import { useSearch } from "wouter";

export default function OrderConfirmation() {
  const search = useSearch();
  const params = new URLSearchParams(search);
  const orderId = params.get("orderId");
  const orderNumber = params.get("orderNumber");
  const etaParam = params.get("etaJSON");

  let eta: { prepMinutes?: number; travelMinutes?: number; estimateMinutes?: number } = {};
  try {
    if (etaParam) {
      eta = JSON.parse(decodeURIComponent(etaParam));
    }
  } catch (e) {
    console.error("Failed to parse ETA:", e);
  }

  return (
    <div className="p-6 text-center">
      <h1 className="text-xl font-bold">Order Confirmed!</h1>
      <p className="mt-2">Your order number is:</p>
      <h2 className="text-3xl font-bold mt-2" data-testid="text-order-number">
        #{orderNumber || orderId?.slice(-6)}
      </h2>
      <p className="mt-4">We'll start preparing it right away.</p>
      
      {eta.estimateMinutes && eta.estimateMinutes > 0 && (
        <p className="mt-4 text-lg" data-testid="text-eta">
          Estimated delivery: <span className="font-bold">{eta.estimateMinutes} minutes</span>
        </p>
      )}
      
      <a href="/order" className="mt-6 inline-block text-blue-600 underline">
        Back to menu
      </a>
    </div>
  );
}
