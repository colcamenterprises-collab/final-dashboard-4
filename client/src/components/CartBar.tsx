// PATCH O2 — FLOATING CART BAR
import { useCart } from "../lib/cartStore";
import { Link } from "wouter";

export default function CartBar() {
  const { items } = useCart();

  if (items.length === 0) return null;

  const subtotal = items.reduce((sum, item) => sum + item.total, 0);

  return (
    <div className="fixed bottom-0 left-0 right-0 bg-black text-white p-4 flex justify-between items-center shadow-lg z-50">
      <div>{items.length} items · {subtotal} THB</div>
      <Link
        href="/online-ordering/checkout"
        className="px-4 py-2 bg-white text-black rounded"
      >
        Checkout
      </Link>
    </div>
  );
}
