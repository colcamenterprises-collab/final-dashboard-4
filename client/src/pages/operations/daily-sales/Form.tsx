// Do not do this:
// – Do not rename, move, or split this file
// – Do not drop fields
// – Only apply exactly what is written below

import React, { useState } from "react";

export default function DailySalesForm() {
  const [formData, setFormData] = useState<any>({
    completedBy: "",
    startingCash: 0,
    cashSales: 0,
    qrSales: 0,
    grabSales: 0,
    aroiDeeSales: 0,
    expenses: [],
    wages: [],
    closingCash: 0,
    requisition: [],
    rollsEnd: 0,
    meatEnd: 0,
  });

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const { name, value } = e.target;
    setFormData((prev: any) => ({ ...prev, [name]: value }));
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
      className="p-4 space-y-6 grid grid-cols-1 md:grid-cols-2 gap-4"
    >
      {/* Staff + Sales */}
      <div>
        <h2 className="text-lg font-bold mb-2">Sales</h2>
        <input
          type="text"
          name="completedBy"
          placeholder="Completed By"
          onChange={handleChange}
          className="w-full border p-2 mb-2 rounded"
        />
        <input
          type="number"
          name="startingCash"
          placeholder="Starting Cash"
          onChange={handleChange}
          className="w-full border p-2 mb-2 rounded"
        />
        <input
          type="number"
          name="cashSales"
          placeholder="Cash Sales"
          onChange={handleChange}
          className="w-full border p-2 mb-2 rounded"
        />
        <input
          type="number"
          name="qrSales"
          placeholder="QR Sales"
          onChange={handleChange}
          className="w-full border p-2 mb-2 rounded"
        />
        <input
          type="number"
          name="grabSales"
          placeholder="Grab Sales"
          onChange={handleChange}
          className="w-full border p-2 mb-2 rounded"
        />
        <input
          type="number"
          name="aroiDeeSales"
          placeholder="Aroi Dee Sales"
          onChange={handleChange}
          className="w-full border p-2 mb-2 rounded"
        />
      </div>

      {/* Stock */}
      <div>
        <h2 className="text-lg font-bold mb-2">Stock</h2>
        <input
          type="number"
          name="rollsEnd"
          placeholder="Rolls Remaining"
          onChange={handleChange}
          className="w-full border p-2 mb-2 rounded"
        />
        <input
          type="number"
          name="meatEnd"
          placeholder="Meat Remaining (g)"
          onChange={handleChange}
          className="w-full border p-2 mb-2 rounded"
        />
      </div>

      {/* Expenses */}
      <div className="md:col-span-2">
        <h2 className="text-lg font-bold mb-2">Expenses</h2>
        <input
          type="number"
          name="closingCash"
          placeholder="Closing Cash"
          onChange={handleChange}
          className="w-full border p-2 mb-2 rounded"
        />
        {/* TODO: dynamic expense rows here */}
      </div>

      {/* Submit */}
      <div className="md:col-span-2 flex justify-end">
        <button
          type="submit"
          className="px-4 py-2 bg-black text-white rounded-lg"
        >
          Submit
        </button>
      </div>
    </form>
  );
}