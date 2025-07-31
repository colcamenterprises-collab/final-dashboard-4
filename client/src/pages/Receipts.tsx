import React, { useEffect, useState } from "react";
import axios from "axios";

interface ReceiptSummary {
  shiftDate: string;
  shiftStart: string;
  shiftEnd: string;
  firstReceipt: string;
  lastReceipt: string;
  totalReceipts: number;
  grossSales: number;
  netSales: number;
  paymentBreakdown: Record<string, { count: number; amount: number }>;
  itemsSold: Record<string, { quantity: number; total: number }>;
  drinkQuantities: Record<string, number>;
  burgerRollsUsed: number;
  meatUsedKg: number;
  modifiersSold: Record<string, { count: number; total: number }>;
  refunds: Array<{
    receiptNumber: string;
    amount: number;
    date: string;
  }>;
}

const Receipts: React.FC = () => {
  const [summary, setSummary] = useState<ReceiptSummary | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchLatestSummary = async () => {
      try {
        const response = await axios.get("/api/receipts/jussi-summary/latest");
        setSummary(response.data);
      } catch (error) {
        console.error("Failed to fetch receipt summary", error);
      } finally {
        setLoading(false);
      }
    };

    fetchLatestSummary();
  }, []);

  if (loading) return <div className="receipt-summary">Loading receipt data…</div>;
  if (!summary) return <div className="receipt-summary">No data available for the current shift.</div>;

  return (
    <div style={{ padding: '20px', fontFamily: 'Arial, sans-serif' }}>
      <h2>Shift Summary - {new Date(summary.shiftDate).toLocaleDateString()}</h2>
      <p><strong>Receipts:</strong> {summary.totalReceipts}</p>
      <p><strong>Gross Sales:</strong> ฿{summary.grossSales.toFixed(2)}</p>
      <p><strong>Net Sales:</strong> ฿{summary.netSales.toFixed(2)}</p>
      <p><strong>First Receipt:</strong> {summary.firstReceipt}</p>
      <p><strong>Last Receipt:</strong> {summary.lastReceipt}</p>

      <h3>Payment Breakdown</h3>
      <ul>
        {Object.entries(summary.paymentBreakdown).map(([method, data]) => (
          <li key={method}>
            {method}: {data.count} transactions - ฿{data.amount.toFixed(2)}
          </li>
        ))}
      </ul>

      <h3>Items Sold</h3>
      <ul>
        {Object.entries(summary.itemsSold).map(([item, data]) => (
          <li key={item}>{item}: {data.quantity} units - ฿{data.total.toFixed(2)}</li>
        ))}
      </ul>

      <h3>Modifiers Sold</h3>
      <ul>
        {Object.entries(summary.modifiersSold).map(([mod, data]) => (
          <li key={mod}>{mod}: {data.count} times - ฿{data.total.toFixed(2)}</li>
        ))}
      </ul>

      <h3>Drink Quantities</h3>
      <ul>
        {Object.entries(summary.drinkQuantities).map(([drink, quantity]) => (
          <li key={drink}>{drink}: {quantity}</li>
        ))}
      </ul>

      <p><strong>Burger Rolls Used:</strong> {summary.burgerRollsUsed}</p>
      <p><strong>Estimated Meat Used:</strong> {summary.meatUsedKg.toFixed(2)} kg</p>

      {summary.refunds.length > 0 && (
        <>
          <h3>Refunds</h3>
          <ul>
            {summary.refunds.map((refund, index) => (
              <li key={index}>
                Receipt {refund.receiptNumber}: ฿{refund.amount.toFixed(2)} on {new Date(refund.date).toLocaleDateString()}
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
};

export default Receipts;