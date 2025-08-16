// src/pages/Expenses.tsx
import { useState } from "react";

type PaidState = "PAID" | "UNPAID";

function Modal({
  open, onClose, title, children, onSave, saveLabel = "Save",
}: {
  open: boolean; onClose: () => void; title: string;
  children: React.ReactNode; onSave: () => Promise<void> | void; saveLabel?: string;
}) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 bg-black/30 flex items-center justify-center p-4">
      <div className="w-full max-w-lg rounded-2xl bg-white shadow-xl">
        <div className="px-5 pt-5 pb-3 border-b">
          <div className="text-lg font-semibold">{title}</div>
        </div>
        <div className="p-5">{children}</div>
        <div className="px-5 pb-5 flex justify-end gap-2">
          <button onClick={onClose} className="px-3 py-1 rounded-lg border">Close</button>
          <button onClick={() => void onSave()} className="px-3 py-1 rounded-lg border bg-emerald-600 text-white">
            {saveLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function Expenses() {
  // Rolls
  const [rollsOpen, setRollsOpen] = useState(false);
  const [rollsAmount, setRollsAmount] = useState<number>(0);
  const [rollsCost, setRollsCost] = useState<number>(0);
  const [rollsPaid, setRollsPaid] = useState<PaidState>("PAID");
  const [rollsTs, setRollsTs] = useState<string>(new Date().toISOString().slice(0,16));

  // Meat
  const [meatOpen, setMeatOpen] = useState(false);
  const [meatWeight, setMeatWeight] = useState<number>(0);
  const [meatType, setMeatType] = useState<string>("90g patty");
  const [meatTs, setMeatTs] = useState<string>(new Date().toISOString().slice(0,16));

  // Drinks
  const [drinksOpen, setDrinksOpen] = useState(false);
  const [drinkName, setDrinkName] = useState<string>("Coke 330ml");
  const [drinkQty, setDrinkQty] = useState<number>(0);
  const [drinkTs, setDrinkTs] = useState<string>(new Date().toISOString().slice(0,16));

  // Upload
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);

  async function postJSON(path: string, body: any) {
    const res = await fetch(path, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    if (!res.ok) throw new Error(await res.text());
  }

  const saveRolls = async () => {
    await postJSON("/api/expenses/purchase", {
      type: "ROLLS",
      amount: Number(rollsAmount),
      cost: Number(rollsCost),
      paid: rollsPaid,
      timestamp: new Date(rollsTs).toISOString(),
    });
    setRollsOpen(false); setRollsAmount(0); setRollsCost(0);
  };

  const saveMeat = async () => {
    await postJSON("/api/expenses/purchase", {
      type: "MEAT",
      weightGrams: Number(meatWeight),
      meatType,
      timestamp: new Date(meatTs).toISOString(),
    });
    setMeatOpen(false); setMeatWeight(0);
  };

  const saveDrinks = async () => {
    await postJSON("/api/expenses/purchase", {
      type: "DRINKS",
      itemName: drinkName,
      quantity: Number(drinkQty),
      timestamp: new Date(drinkTs).toISOString(),
    });
    setDrinksOpen(false); setDrinkQty(0);
  };

  const uploadStatements = async () => {
    if (!file) return;
    setUploading(true);
    const fd = new FormData();
    fd.append("file", file);
    const res = await fetch("/api/expenses/upload-statements", { method: "POST", body: fd });
    setUploading(false);
    if (!res.ok) throw new Error(await res.text());
    setFile(null);
  };

  return (
    <div>
      <h1 className="text-2xl font-extrabold mb-4">Expenses</h1>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Quick capture */}
        <div className="rounded-2xl border bg-white p-5 shadow-sm">
          <div className="font-semibold mb-3">Quick Purchases</div>
          <div className="flex flex-wrap gap-2">
            <button className="px-3 py-2 border rounded-lg" onClick={() => setRollsOpen(true)}>Add Rolls</button>
            <button className="px-3 py-2 border rounded-lg" onClick={() => setMeatOpen(true)}>Add Meat</button>
            <button className="px-3 py-2 border rounded-lg" onClick={() => setDrinksOpen(true)}>Add Drinks</button>
          </div>
          <div className="text-sm text-neutral-500 mt-3">
            Rolls: Amount, Cost, Paid/Unpaid, Timestamp — Meat: Weight & Type — Drinks: Item & Qty.
          </div>
        </div>

        {/* Upload statements (moved from its own page) */}
        <div className="rounded-2xl border bg-white p-5 shadow-sm">
          <div className="font-semibold mb-3">Upload Bank Statements</div>
          <input
            type="file"
            accept=".csv,.xls,.xlsx,.pdf,.ofx,.qif,image/*"
            onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            className="block mb-3"
          />
          <button
            disabled={!file || uploading}
            onClick={() => void uploadStatements()}
            className="px-3 py-2 border rounded-lg disabled:opacity-50"
          >
            {uploading ? "Uploading…" : "Upload"}
          </button>
          <div className="text-sm text-neutral-500 mt-3">
            Files are parsed and attached to this shift's expenses review.
          </div>
        </div>
      </div>

      {/* Modals */}
      <Modal open={rollsOpen} onClose={() => setRollsOpen(false)} title="Add Rolls Purchase" onSave={saveRolls}>
        <div className="grid grid-cols-2 gap-3">
          <label className="text-sm">Amount
            <input type="number" className="mt-1 w-full border rounded-lg px-3 py-2"
              value={rollsAmount} onChange={(e) => setRollsAmount(Number(e.target.value))} />
          </label>
          <label className="text-sm">Cost
            <input type="number" className="mt-1 w-full border rounded-lg px-3 py-2"
              value={rollsCost} onChange={(e) => setRollsCost(Number(e.target.value))} />
          </label>
          <label className="text-sm">Paid
            <select className="mt-1 w-full border rounded-lg px-3 py-2"
              value={rollsPaid} onChange={(e) => setRollsPaid(e.target.value as PaidState)}>
              <option value="PAID">Paid</option>
              <option value="UNPAID">Unpaid</option>
            </select>
          </label>
          <label className="text-sm">Timestamp
            <input type="datetime-local" className="mt-1 w-full border rounded-lg px-3 py-2"
              value={rollsTs} onChange={(e) => setRollsTs(e.target.value)} />
          </label>
        </div>
      </Modal>

      <Modal open={meatOpen} onClose={() => setMeatOpen(false)} title="Add Meat Purchase" onSave={saveMeat}>
        <div className="grid grid-cols-2 gap-3">
          <label className="text-sm">Weight (grams)
            <input type="number" className="mt-1 w-full border rounded-lg px-3 py-2"
              value={meatWeight} onChange={(e) => setMeatWeight(Number(e.target.value))} />
          </label>
          <label className="text-sm">Type
            <input type="text" className="mt-1 w-full border rounded-lg px-3 py-2"
              value={meatType} onChange={(e) => setMeatType(e.target.value)} />
          </label>
          <label className="text-sm">Timestamp
            <input type="datetime-local" className="mt-1 w-full border rounded-lg px-3 py-2"
              value={meatTs} onChange={(e) => setMeatTs(e.target.value)} />
          </label>
        </div>
      </Modal>

      <Modal open={drinksOpen} onClose={() => setDrinksOpen(false)} title="Add Drinks Purchase" onSave={saveDrinks}>
        <div className="grid grid-cols-2 gap-3">
          <label className="text-sm">Drink
            <select className="mt-1 w-full border rounded-lg px-3 py-2"
              value={drinkName} onChange={(e) => setDrinkName(e.target.value)}>
              <option>Coke 330ml</option><option>Coke Zero 330ml</option>
              <option>Sprite 330ml</option><option>Fanta 330ml</option>
              <option>Water 600ml</option>
            </select>
          </label>
          <label className="text-sm">Quantity
            <input type="number" className="mt-1 w-full border rounded-lg px-3 py-2"
              value={drinkQty} onChange={(e) => setDrinkQty(Number(e.target.value))} />
          </label>
          <label className="text-sm">Timestamp
            <input type="datetime-local" className="mt-1 w-full border rounded-lg px-3 py-2"
              value={drinkTs} onChange={(e) => setDrinkTs(e.target.value)} />
          </label>
        </div>
      </Modal>
    </div>
  );
}