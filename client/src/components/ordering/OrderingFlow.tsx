import OrderingCart from "./OrderingCart";
import { money, type CartItem, type OrderingLanguage } from "./orderingApi";

type Props = {
  step: "cart" | "checkout";
  cart: CartItem[];
  language: OrderingLanguage;
  total: number;
  loading: boolean;
  orderingEnabled: boolean;
  qrEnabled: boolean;
  fulfilment: "pickup" | "delivery";
  paymentMethod: string;
  customerName: string;
  customerPhone: string;
  deliveryAddress: string;
  orderNotes: string;
  error: string;
  partnerVenueName?: string | null;
  deliveryLocked?: boolean;
  standardDeliveryFee?: number;
  chargedDeliveryFee?: number;
  onQty: (index: number, quantity: number) => void;
  onRemove: (index: number) => void;
  onClose: () => void;
  onBack: () => void;
  onCheckout: () => void;
  onSubmit: () => void;
  onFulfilment: (value: "pickup" | "delivery") => void;
  onPayment: (value: string) => void;
  onName: (value: string) => void;
  onPhone: (value: string) => void;
  onAddress: (value: string) => void;
  onNotes: (value: string) => void;
  showCustomerDetails: boolean;
};

export default function OrderingFlow(props: Props) {
  const standardFee = Number(props.standardDeliveryFee || 0);
  const chargedFee = Number(props.chargedDeliveryFee || 0);
  return <div className="sbo-flow-backdrop" onMouseDown={props.onClose}>
    <section className="sbo-flow-sheet" onMouseDown={(event) => event.stopPropagation()}>
      <div className="sbo-flow-head">
        <button type="button" onClick={props.onBack}>←</button>
        <div><small>{props.step === "cart" ? "Your order" : "Checkout"}</small><h2>{props.step === "cart" ? `${props.cart.reduce((sum, item) => sum + item.quantity, 0)} items` : "Almost there"}</h2></div>
        <button type="button" onClick={props.onClose}>×</button>
      </div>
      {props.step === "cart" ? <>
        <OrderingCart cart={props.cart} language={props.language} onQty={props.onQty} onRemove={props.onRemove} />
        <button className="sbo-primary-flow-btn" disabled={!props.cart.length} onClick={props.onCheckout}>Continue to checkout · {money(props.total)}</button>
      </> : <section className="sbo-panel sbo-checkout-panel">
        {props.showCustomerDetails && <>
          {props.deliveryLocked ? <div className="sbo-partner-delivery"><small>Partner venue delivery</small><strong>{props.partnerVenueName || "Partner venue"}</strong><span>Your food will be delivered here so you can stay at the venue.</span></div> : <div className="sbo-fulfilment">
            <button type="button" className={props.fulfilment === "pickup" ? "active" : ""} onClick={() => props.onFulfilment("pickup")}>Pickup</button>
            <button type="button" className={props.fulfilment === "delivery" ? "active" : ""} onClick={() => props.onFulfilment("delivery")}>Delivery</button>
          </div>}
          <label>Name<input placeholder="Your name" value={props.customerName} onChange={(e) => props.onName(e.target.value)} /></label>
          <label>Phone<input inputMode="tel" placeholder="Phone number" value={props.customerPhone} onChange={(e) => props.onPhone(e.target.value)} /></label>
          {props.fulfilment === "delivery" && <label>Delivery details<textarea readOnly={props.deliveryLocked} placeholder="Address, hotel or villa and unit" value={props.deliveryAddress} onChange={(e) => props.onAddress(e.target.value)} /></label>}
        </>}
        <label>Order notes<textarea placeholder="Anything the kitchen should know?" value={props.orderNotes} onChange={(e) => props.onNotes(e.target.value)} /></label>
        <label>Payment<select value={props.paymentMethod} onChange={(e) => props.onPayment(e.target.value)}>
          {props.fulfilment === "pickup" && <option value="pay_at_counter">Pay at pickup</option>}
          <option value="cash">Cash</option>
          {props.qrEnabled && <option value="manual_qr_transfer">QR transfer</option>}
        </select></label>
        {props.fulfilment === "delivery" && <div className="sbo-delivery-free"><span>Delivery</span><strong>{chargedFee === 0 ? <>{standardFee > 0 && <del>{money(standardFee)}</del>} <b>FREE</b></> : money(chargedFee)}</strong></div>}
        {props.error && <div className="sbo-modal-error">{props.error}</div>}
        <button className="sbo-primary-flow-btn" disabled={!props.cart.length || props.loading || !props.orderingEnabled} onClick={props.onSubmit}>{props.loading ? "Sending order..." : `Place order · ${money(props.total + (props.fulfilment === "delivery" ? chargedFee : 0))}`}</button>
      </section>}
    </section>
  </div>;
}
