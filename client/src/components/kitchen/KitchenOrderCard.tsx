import { money, patchOrderingStatus } from "@/components/ordering/orderingApi";

const nextStatuses = ["ACCEPTED", "PREPARING", "READY", "COMPLETED", "CANCELLED"];

export default function KitchenOrderCard({ order, onChanged }: { order: any; onChanged: () => void }) {
  const elapsed = Math.max(0, Math.floor((Date.now() - new Date(order.created_at).getTime()) / 60000));
  async function setStatus(status: string) {
    await patchOrderingStatus(order.id, status, "kitchen");
    onChanged();
  }
  return (
    <article className="rounded-lg border bg-white p-4 shadow-sm">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h3 className="text-2xl font-bold">#{order.order_number}</h3>
          <p className="text-sm uppercase tracking-wide text-gray-600">{order.channel}{order.table_code ? ` · Table ${order.table_code}` : ""}</p>
        </div>
        <div className="text-right"><div className="font-semibold">{order.status_code ?? order.status}</div><div className="text-sm text-gray-600">{elapsed} min</div></div>
      </div>
      <div className="mt-4 space-y-3">
        {(order.items ?? []).map((item: any) => (
          <div key={item.id} className="border-t pt-3">
            <div className="font-semibold">{item.quantity} × {item.item_name_en}</div>
            {(item.modifiers ?? []).map((modifier: any) => <div key={modifier.id} className="text-sm text-gray-700">+ {modifier.modifier_name_en}</div>)}
            {item.notes && <div className="text-sm text-gray-700">Note: {item.notes}</div>}
          </div>
        ))}
      </div>
      {order.order_notes && <div className="mt-3 rounded bg-yellow-50 p-2 text-sm">Order note: {order.order_notes}</div>}
      <div className="mt-3 font-semibold">{money(order.total)}</div>
      <div className="mt-4 flex flex-wrap gap-2">
        {nextStatuses.map((status) => <button key={status} className="rounded border px-3 py-2" onClick={() => setStatus(status)}>{status}</button>)}
      </div>
    </article>
  );
}
