// PATCH O2 — ORDER CONFIRMATION PAGE
import { useSearch } from "wouter";

export default function OrderConfirmation() {
  const search = useSearch();
  const params = new URLSearchParams(search);
  const orderId = params.get("orderId");

  return (
    <div className="p-6 text-center">
      <h1 className="text-xl font-bold">Order Confirmed!</h1>
      <p className="mt-2">Your order number is:</p>
      <h2 className="text-3xl font-bold mt-2" data-testid="text-order-id">{orderId}</h2>
      <p className="mt-4">We'll start preparing it right away.</p>
      <a href="/order" className="mt-6 inline-block text-blue-600 underline">
        Back to menu
      </a>
    </div>
  );
}
