import type { CartItem, OrderingLanguage } from "./orderingApi";
import { itemLabel, money } from "./orderingApi";

type Props = { cart: CartItem[]; language: OrderingLanguage; onQty: (index: number, quantity: number) => void; onRemove: (index: number) => void };

export default function OrderingCart({ cart, language, onQty, onRemove }: Props) {
  const total = cart.reduce((sum, item) => sum + (Number(item.price) + item.modifiers.reduce((m, mod) => m + Number(mod.price_delta) * mod.quantity, 0)) * item.quantity, 0);
  return (
    <aside className="rounded-lg border bg-white p-4 shadow-sm">
      <h2 className="text-xl font-semibold">Cart</h2>
      {!cart.length && <p className="mt-2 text-sm text-gray-600">No items added.</p>}
      <div className="mt-3 space-y-3">
        {cart.map((item, index) => (
          <div key={`${item.menu_item_id}-${index}`} className="border-b pb-3">
            <div className="flex justify-between gap-3">
              <div className="font-medium">{itemLabel(item, language)}</div>
              <button className="text-sm underline" onClick={() => onRemove(index)}>Remove</button>
            </div>
            {item.modifiers.map((modifier) => <div key={modifier.item_modifier_id} className="text-sm text-gray-600">+ {itemLabel(modifier, language)} {Number(modifier.price_delta) ? money(modifier.price_delta) : ""}</div>)}
            {item.notes && <div className="text-sm text-gray-600">Note: {item.notes}</div>}
            <div className="mt-2 flex items-center gap-2">
              <button className="rounded border px-3 py-1" onClick={() => onQty(index, item.quantity - 1)}>-</button>
              <span>{item.quantity}</span>
              <button className="rounded border px-3 py-1" onClick={() => onQty(index, item.quantity + 1)}>+</button>
            </div>
          </div>
        ))}
      </div>
      <div className="mt-4 flex justify-between text-lg font-semibold"><span>Total</span><span>{money(total)}</span></div>
    </aside>
  );
}
