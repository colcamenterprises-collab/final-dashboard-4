import type { CartItem, OrderingLanguage } from "./orderingApi";
import { itemLabel, money } from "./orderingApi";

type Props = { cart: CartItem[]; language: OrderingLanguage; onQty: (index: number, quantity: number) => void; onRemove: (index: number) => void };

export default function OrderingCart({ cart, language, onQty, onRemove }: Props) {
  const total = cart.reduce((sum, item) => sum + (Number(item.price) + item.modifiers.reduce((m, mod) => m + Number(mod.price_delta) * mod.quantity, 0)) * item.quantity, 0);
  return (
    <aside className="sbo-cart">
      <h2>Your Cart</h2>
      {!cart.length && <p className="sbo-cart-empty">No items added.</p>}
      <div className="sbo-cart-lines">
        {cart.map((item, index) => (
          <div key={`${item.menu_item_id}-${index}`} className="sbo-cart-line">
            <div className="sbo-cart-line-head">
              <div>{itemLabel(item, language)}</div>
              <button className="sbo-cart-remove" onClick={() => onRemove(index)}>Remove</button>
            </div>
            {item.modifiers.map((modifier) => <div key={modifier.item_modifier_id} className="sbo-cart-meta">+ {itemLabel(modifier, language)} {Number(modifier.price_delta) ? money(modifier.price_delta) : ""}</div>)}
            {item.notes && <div className="sbo-cart-meta">Note: {item.notes}</div>}
            <div className="sbo-qty">
              <button onClick={() => onQty(index, item.quantity - 1)}>-</button>
              <span>{item.quantity}</span>
              <button onClick={() => onQty(index, item.quantity + 1)}>+</button>
            </div>
          </div>
        ))}
      </div>
      <div className="sbo-total"><span>Total</span><span>{money(total)}</span></div>
    </aside>
  );
}
