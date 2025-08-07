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

  // Safe helper function for accessing nested properties
  const safeAccess = (obj: any, fallback: any = 0) => {
    return obj != null ? obj : fallback;
  };

  return (
    <div style={{ padding: '20px', fontFamily: 'Arial, sans-serif' }}>
      <h2>Shift Summary - {summary.shiftDate ? new Date(summary.shiftDate).toLocaleDateString() : 'N/A'}</h2>
      <p><strong>Receipts:</strong> {safeAccess(summary.totalReceipts)}</p>
      <p><strong>Gross Sales:</strong> ฿{safeAccess(summary.grossSales).toFixed(2)}</p>
      <p><strong>Net Sales:</strong> ฿{safeAccess(summary.netSales).toFixed(2)}</p>
      <p><strong>First Receipt:</strong> {summary.firstReceipt || 'N/A'}</p>
      <p><strong>Last Receipt:</strong> {summary.lastReceipt || 'N/A'}</p>

      <h3>Payment Breakdown</h3>
      <ul>
        {summary.paymentBreakdown && typeof summary.paymentBreakdown === 'object' ? 
          Object.entries(summary.paymentBreakdown).map(([method, data]) => (
            <li key={method}>
              {method}: {safeAccess(data?.count)} transactions - ฿{safeAccess(data?.amount).toFixed(2)}
            </li>
          )) : <li>No payment data available</li>
        }
      </ul>

      <h3>Items Sold</h3>
      <ul>
        {summary.itemsSold && typeof summary.itemsSold === 'object' ? 
          Object.entries(summary.itemsSold).map(([item, data]) => (
            <li key={item}>{item}: {safeAccess(data?.quantity)} units - ฿{safeAccess(data?.total).toFixed(2)}</li>
          )) : <li>No items data available</li>
        }
      </ul>

      <h3>Modifiers Sold</h3>
      <ul>
        {summary.modifiersSold && typeof summary.modifiersSold === 'object' ? 
          Object.entries(summary.modifiersSold).map(([mod, data]) => (
            <li key={mod}>{mod}: {safeAccess(data?.count)} times - ฿{safeAccess(data?.total).toFixed(2)}</li>
          )) : <li>No modifiers data available</li>
        }
      </ul>

      <h3>Drink Quantities</h3>
      <ul>
        {summary.drinkQuantities && typeof summary.drinkQuantities === 'object' ? 
          Object.entries(summary.drinkQuantities).map(([drink, quantity]) => (
            <li key={drink}>{drink}: {safeAccess(quantity)}</li>
          )) : <li>No drink data available</li>
        }
      </ul>

      <p><strong>Burger Rolls Used:</strong> {safeAccess(summary.burgerRollsUsed)}</p>
      <p><strong>Estimated Meat Used:</strong> {safeAccess(summary.meatUsedKg).toFixed(2)} kg</p>

      {Array.isArray(summary.refunds) && summary.refunds.length > 0 && (
        <>
          <h3>Refunds</h3>
          <ul>
            {summary.refunds.map((refund, index) => (
              <li key={index}>
                Receipt {refund?.receiptNumber || 'N/A'}: ฿{safeAccess(refund?.amount).toFixed(2)} on {refund?.date ? new Date(refund.date).toLocaleDateString() : 'N/A'}
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
};

export default Receipts;