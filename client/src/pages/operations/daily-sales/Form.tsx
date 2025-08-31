import React, { useState, useEffect } from "react";

// THB formatting helper
const thb = (v: unknown): string => {
  const n = typeof v === "number" && Number.isFinite(v) ? v : Number(v) || 0;
  return "฿" + n.toLocaleString("en-TH", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
};

export default function DailySalesForm() {
  const [completedBy, setCompletedBy] = useState("");
  const [startingCash, setStartingCash] = useState(0);
  const [cashSales, setCashSales] = useState(0);
  const [qrSales, setQrSales] = useState(0);
  const [grabSales, setGrabSales] = useState(0);
  const [aroiDeeSales, setAroiDeeSales] = useState(0);

  const [expenses, setExpenses] = useState<
    { item: string; cost: number; shop: string }[]
  >([{ item: "", cost: 0, shop: "" }]);

  const [wages, setWages] = useState<
    { staff: string; amount: number; type: string }[]
  >([{ staff: "", amount: 0, type: "Wages" }]);

  const [closingCash, setClosingCash] = useState(0);
  const [cashBanked, setCashBanked] = useState(0);
  const [qrTransfer, setQrTransfer] = useState(0);

  const [totalSales, setTotalSales] = useState(0);
  const [totalExpenses, setTotalExpenses] = useState(0);

  // ---- Auto-calcs ----
  useEffect(() => {
    const sales = cashSales + qrSales + grabSales + aroiDeeSales;
    setTotalSales(sales);

    const expenseSum =
      expenses.reduce((sum, e) => sum + (e.cost || 0), 0) +
      wages.reduce((sum, w) => sum + (w.amount || 0), 0);
    setTotalExpenses(expenseSum);

    const banked = startingCash + cashSales - expenseSum - closingCash;
    setCashBanked(banked < 0 ? 0 : banked);

    setQrTransfer(qrSales);
  }, [
    startingCash,
    cashSales,
    qrSales,
    grabSales,
    aroiDeeSales,
    expenses,
    wages,
    closingCash,
  ]);

  // ---- Uniform Styling ----
  const sectionHeader = "text-lg font-semibold mb-2";
  const label = "block text-sm font-medium mb-1";
  const input =
    "w-full rounded-md border border-gray-300 p-2 text-base focus:outline-none focus:ring-2 focus:ring-black";
  const readonlyInput =
    "w-full rounded-md border border-gray-200 bg-gray-100 p-2 text-base text-gray-600";

  return (
    <div className="p-4 space-y-6">
      {/* Shift Information */}
      <div>
        <h2 className={sectionHeader}>Shift Information</h2>
        <div className="grid grid-cols-3 gap-4">
          <div>
            <label className={label}>Shift Date</label>
            <input type="date" className={input} />
          </div>
          <div>
            <label className={label}>Completed By</label>
            <input
              type="text"
              className={input}
              value={completedBy}
              onChange={(e) => setCompletedBy(e.target.value)}
            />
          </div>
          <div>
            <label className={label}>Starting Cash (฿)</label>
            <input
              type="number"
              className={input}
              value={startingCash}
              onChange={(e) => setStartingCash(parseInt(e.target.value) || 0)}
            />
          </div>
        </div>
      </div>

      {/* Sales */}
      <div>
        <h2 className={sectionHeader}>Sales Information</h2>
        <div className="grid grid-cols-4 gap-4">
          <div>
            <label className={label}>Cash Sales</label>
            <input
              type="number"
              className={input}
              value={cashSales}
              onChange={(e) => setCashSales(parseInt(e.target.value) || 0)}
            />
          </div>
          <div>
            <label className={label}>QR Sales</label>
            <input
              type="number"
              className={input}
              value={qrSales}
              onChange={(e) => setQrSales(parseInt(e.target.value) || 0)}
            />
          </div>
          <div>
            <label className={label}>Grab Sales</label>
            <input
              type="number"
              className={input}
              value={grabSales}
              onChange={(e) => setGrabSales(parseInt(e.target.value) || 0)}
            />
          </div>
          <div>
            <label className={label}>Aroi Dee Sales</label>
            <input
              type="number"
              className={input}
              value={aroiDeeSales}
              onChange={(e) => setAroiDeeSales(parseInt(e.target.value) || 0)}
            />
          </div>
        </div>
        <p className="mt-2 font-medium">Total Sales: {thb(totalSales)}</p>
      </div>

      {/* Expenses */}
      <div>
        <h2 className={sectionHeader}>Expenses</h2>
        <p className="font-medium">Total Expenses: {thb(totalExpenses)}</p>
      </div>

      {/* Summary */}
      <div>
        <h2 className={sectionHeader}>Summary</h2>
        <p className="text-base">Total Sales: {thb(totalSales)}</p>
        <p className="text-base">Total Expenses: {thb(totalExpenses)}</p>
        <p className="text-base font-semibold">
          Net Position: {thb(totalSales - totalExpenses)}
        </p>
      </div>

      {/* Banking */}
      <div>
        <h2 className={sectionHeader}>Banking</h2>
        <div className="grid grid-cols-3 gap-4">
          <div>
            <label className={label}>Closing Cash (฿)</label>
            <input
              type="number"
              className={input}
              value={closingCash}
              onChange={(e) => setClosingCash(parseInt(e.target.value) || 0)}
            />
          </div>
          <div>
            <label className={label}>Cash Banked (฿)</label>
            <input
              type="text"
              className={readonlyInput}
              readOnly
              value={thb(cashBanked)}
            />
            <p className="text-xs text-gray-500">
              Auto-calculated: (Starting Cash + Cash Sales) − Expenses − Closing
              Cash
            </p>
          </div>
          <div>
            <label className={label}>QR Transfer Amount (฿)</label>
            <input
              type="text"
              className={readonlyInput}
              readOnly
              value={thb(qrTransfer)}
            />
            <p className="text-xs text-gray-500">
              Auto-copied from QR Sales (funds go straight to bank)
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}