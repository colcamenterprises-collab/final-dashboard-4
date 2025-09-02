// Frontend: Fixed rename, balance check, auto banked, responsive UI
import React, { useState } from "react";

export default function DailySalesForm() {
  const [formData, setFormData] = useState<any>({
    completedBy: "",
    startingCash: 2500,
    cashSales: 0,
    qrSales: 0,
    grabSales: 0,
    otherSales: 0,
    expenses: [],
    wages: [],
    closingCash: 0,
    requisition: [],
    rollsEnd: 0,
    meatEnd: 0,
  });

  const [balanced, setBalanced] = useState<boolean | null>(null);

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const { name, value } = e.target;
    const parsed = parseInt(value) || 0;
    const updated = { ...formData, [name]: parsed };
    setFormData(updated);

    if (name === "closingCash") {
      const expected =
        formData.startingCash + formData.cashSales + formData.otherSales; // minus expenses later
      const diff = Math.abs(expected - parsed);
      setBalanced(diff <= 30);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    await fetch("/api/forms/daily-sales/v2", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(formData),
    });
    alert("Form submitted successfully!");
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="p-4 space-y-6 grid grid-cols-1 md:grid-cols-2 gap-4 font-[Poppins]"
    >
      <div>
        <h2 className="text-lg font-bold mb-2">Sales</h2>
        <input type="text" name="completedBy" placeholder="Completed By" onChange={handleChange} className="w-full border p-2 mb-2 rounded" />
        <input type="number" name="startingCash" value={formData.startingCash} placeholder="Starting Cash" onChange={handleChange} className="w-full border p-2 mb-2 rounded" />
        <input type="number" name="cashSales" placeholder="Cash Sales" onChange={handleChange} className="w-full border p-2 mb-2 rounded" />
        <input type="number" name="qrSales" placeholder="QR Sales" onChange={handleChange} className="w-full border p-2 mb-2 rounded" />
        <input type="number" name="grabSales" placeholder="Grab Sales" onChange={handleChange} className="w-full border p-2 mb-2 rounded" />
        <input type="number" name="otherSales" placeholder="Other Sales" onChange={handleChange} className="w-full border p-2 mb-2 rounded" />
      </div>

      <div>
        <h2 className="text-lg font-bold mb-2">Stock</h2>
        <input type="number" name="rollsEnd" placeholder="Rolls Remaining" onChange={handleChange} className="w-full border p-2 mb-2 rounded" />
        <input type="number" name="meatEnd" placeholder="Meat Remaining (g)" onChange={handleChange} className="w-full border p-2 mb-2 rounded" />
      </div>

      <div className="md:col-span-2">
        <h2 className="text-lg font-bold mb-2">Banking</h2>
        <input type="number" name="closingCash" placeholder="Total Cash in Register at Close" onChange={handleChange} className="w-full border p-2 mb-2 rounded" />
        {balanced !== null && (
          <div className={`p-2 mt-2 rounded ${balanced ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"}`}>
            {balanced ? "Balanced ✅" : "Not Balanced ❌"}
          </div>
        )}
        <input type="number" name="cashBanked" placeholder="Cash Banked (auto)" value={formData.closingCash - 2500} readOnly className="w-full border p-2 mb-2 rounded bg-gray-100 text-gray-600" />
        <input type="number" name="qrTransfer" placeholder="QR Banked (auto)" value={formData.qrSales} readOnly className="w-full border p-2 mb-2 rounded bg-gray-100 text-gray-600" />
      </div>

      <div className="md:col-span-2 flex justify-end">
        <button type="submit" className="px-4 py-2 bg-black text-white rounded-lg">Submit</button>
      </div>
    </form>
  );
}