// 🚫 GOLDEN FILE — DO NOT MODIFY WITHOUT CAM'S APPROVAL
// Active Daily Sales & Stock system (V2).

// Do not do this:
// – Do not rename, move, or split this file
// – Do not change API routes
// – Do not add dependencies
// – Only apply exactly what is written below

import React, { useEffect, useState } from "react";
import { useQuery } from '@tanstack/react-query';
import axios from 'axios';
import { Eye, Printer, Download, AlertTriangle } from 'lucide-react';
import { ConfirmDialog, SuccessDialog } from '@/components/ui/confirm-dialog';

// MEGA PATCH V3: Safe number helpers
const safeNumber = (v: any) => (v === 0 || typeof v === "number") ? v : (Number(v) || 0);

// THB formatting helper
const thb = (v: unknown): string => {
  const n = typeof v === "number" && Number.isFinite(v) ? v : Number(v) || 0;
  return "฿" + n.toLocaleString("en-TH", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
};

const getReceiptCounts = (rec: RecordType) => {
  const p: any = rec.payload || {};
  const grab = Number(rec.grabReceiptCount ?? p.grabReceiptCount ?? 0);
  const cash = Number(rec.cashReceiptCount ?? p.cashReceiptCount ?? 0);
  const qr = Number(rec.qrReceiptCount ?? p.qrReceiptCount ?? 0);
  return { grab, cash, qr, total: grab + cash + qr };
};

type RecordType = {
  id: string;
  date: string;
  staff: string;
  totalSales: number;
  buns: number | string;
  meat: number | string;
  drinks?: { name: string; quantity: number }[];
  drinksCount?: number;
  status: string;
  hasStock?: boolean;
  grabReceiptCount?: number;
  cashReceiptCount?: number;
  qrReceiptCount?: number;
  total_receipts?: number;
  payload?: { 
    balanced?: boolean;
    drinkStock?: { name: string; quantity: number; unit: string }[] | Record<string, number>;
  };
  deletedAt?: string | null;
};

type FullRecord = {
  id: string;
  date: string;
  staff: string;
  sales: any;
  expenses: any;
  wages?: any[];
  banking: any;
  stock: any;
  shoppingList: { name: string; qty: number; unit: string; category?: string }[];
  audit?: Array<{ id: string; actor: string; actionType: string; changedFields: Array<{ field: string; from: any; to: any }>; createdAt: string }>;
};

// Drinks Requisition Component with costs from ingredient_v2
function DrinksRequisitionSection({ requisition }: { requisition: any[] }) {
  const { data: ingredients } = useQuery({ 
    queryKey: ['ingredients'], 
    queryFn: () => axios.get('/api/ingredients') 
  });
  
  if (!ingredients?.data?.length) {
    return null;
  }
  
  const drinksRequisition = requisition.filter(r => {
    const ingredient = ingredients.data.find(i => i.id === r.id || i.name.toLowerCase() === r.name.toLowerCase());
    return ingredient?.category === 'Drinks';
  });
  
  if (drinksRequisition.length === 0) {
    return null;
  }

  return (
    <div className="bg-red-50 p-3 rounded text-xs">
      <h4 className="text-xs font-semibold mb-2">Drinks Requisition</h4>
      <table className="w-full text-xs">
        <thead>
          <tr className="border-b">
            <th className="text-left p-1 text-xs">Item</th>
            <th className="text-right p-1 text-xs">Qty</th>
            <th className="text-right p-1 text-xs">Cost</th>
          </tr>
        </thead>
        <tbody>
          {drinksRequisition.map((r, idx) => {
            const ingredient = ingredients.data.find(i => i.id === r.id || i.name.toLowerCase() === r.name.toLowerCase());
            const cost = r.qty * (ingredient?.unitCost || 0);
            return (
              <tr key={idx} className="text-xs">
                <td className="p-1 text-xs">{ingredient?.name || r.name}</td>
                <td className="text-right p-1 text-xs">{r.qty}</td>
                <td className="text-right p-1 text-xs font-semibold">{thb(cost)}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

export default function DailySalesV2Library() {
  const [records, setRecords] = useState<RecordType[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [showArchived, setShowArchived] = useState(false);
  const [selected, setSelected] = useState<FullRecord | null>(null);
  
  // Dialog states
  const [deleteDialog, setDeleteDialog] = useState<{ isOpen: boolean; id: string | null }>({ isOpen: false, id: null });
  const [successDialog, setSuccessDialog] = useState<{ isOpen: boolean; message: string }>({ isOpen: false, message: '' });
  const [errorDialog, setErrorDialog] = useState<{ isOpen: boolean; message: string }>({ isOpen: false, message: '' });

  async function fetchRecords() {
    setLoading(true);
    try {
      const res = await fetch("/api/forms/daily-sales/v2");
      const data = await res.json();
      if (data.ok && data.records) {
        setRecords(data.records);
      } else {
        setError("No records found");
      }
    } catch (err) {
      setError("Network error");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchRecords();
  }, []);

  async function confirmDeleteRecord(id: string) {
    setDeleteDialog({ isOpen: true, id });
  }

  async function deleteRecord() {
    if (!deleteDialog.id) return;
    try {
      await fetch(`/api/forms/daily-sales/v2/${deleteDialog.id}`, { method: "DELETE" });
      await fetchRecords();
      setSuccessDialog({ isOpen: true, message: 'Record deleted successfully' });
    } catch (err) {
      setErrorDialog({ isOpen: true, message: 'Failed to delete record. Please try again.' });
    }
  }
  
  function printRecord(id: string) {
    window.open(`/api/forms/daily-sales/v2/${id}/print-full`, '_blank');
  }
  
  async function downloadRecord(record: RecordType) {
    try {
      // Fetch full record data for comprehensive PDF
      const response = await fetch(`/api/forms/daily-sales/v2/${record.id}`);
      const data = await response.json();
      
      if (!data.ok) {
        setErrorDialog({ isOpen: true, message: 'Failed to fetch record data' });
        return;
      }
      
      const fullRecord = data.record;
      const p = fullRecord.payload || {};
      
      // Import jsPDF dynamically
      const { jsPDF } = await import('jspdf');
      const doc = new jsPDF();
      
      // Generate comprehensive PDF
      doc.setFontSize(16);
      doc.text('Daily Sales & Stock Report', 20, 20);
      
      doc.setFontSize(12);
      doc.text(`Date: ${new Date(fullRecord.date).toLocaleDateString()}`, 20, 35);
      doc.text(`Staff: ${fullRecord.staff}`, 20, 45);
      
      let yPos = 60;
      
      // Sales
      doc.setFontSize(14); doc.text('Sales', 20, yPos); yPos += 10;
      doc.setFontSize(10);
      doc.text(`Cash: ฿${(p.cashSales || 0).toLocaleString()}`, 20, yPos); yPos += 6;
      doc.text(`QR: ฿${(p.qrSales || 0).toLocaleString()}`, 20, yPos); yPos += 6;
      doc.text(`Total: ฿${(p.totalSales || 0).toLocaleString()}`, 20, yPos); yPos += 10;

      // Receipt Summary
      doc.setFontSize(14); doc.text('Receipt Summary', 20, yPos); yPos += 10;
      doc.setFontSize(10);
      doc.text(`Grab Receipts: ${Number(p.grabReceiptCount || 0)}`, 20, yPos); yPos += 6;
      doc.text(`Cash Receipts: ${Number(p.cashReceiptCount || 0)}`, 20, yPos); yPos += 6;
      doc.text(`QR Receipts: ${Number(p.qrReceiptCount || 0)}`, 20, yPos); yPos += 6;
      doc.text(`Total: ${Number(p.grabReceiptCount || 0) + Number(p.cashReceiptCount || 0) + Number(p.qrReceiptCount || 0)}`, 20, yPos); yPos += 9;
      
      // Banking
      doc.setFontSize(14); doc.text('Banking', 20, yPos); yPos += 10;
      doc.setFontSize(10);
      doc.text(`Starting: ฿${(p.startingCash || 0).toLocaleString()}`, 20, yPos); yPos += 6;
      doc.text(`Closing: ฿${(p.closingCash || 0).toLocaleString()}`, 20, yPos); yPos += 6;
      doc.text(`Balanced: ${p.balanced ? 'YES' : 'NO'}`, 20, yPos); yPos += 15;
      
      // Stock
      doc.setFontSize(14); doc.text('Stock', 20, yPos); yPos += 10;
      doc.setFontSize(10);
      doc.text(`Rolls: ${p.rollsEnd || 'Not specified'}`, 20, yPos); yPos += 6;
      doc.text(`Meat: ${p.meatEnd ? `${p.meatEnd}g` : 'Not specified'}`, 20, yPos);
      
      // Save PDF
      doc.save(`daily-sales-${record.date}-${record.id.substring(0, 8)}.pdf`);
      
      console.log(`PDF generated with content length: ${JSON.stringify(p).length}`);
    } catch (err) {
      console.error('PDF generation failed:', err);
      setErrorDialog({ isOpen: true, message: 'Failed to generate PDF. Please try again.' });
    }
  }

  async function restoreRecord(id: string) {
    await fetch(`/api/forms/daily-sales/v2/${id}/restore`, { method: "PATCH" });
    fetchRecords();
  }

  async function viewRecord(id: string) {
    const res = await fetch(`/api/forms/daily-sales/v2/${id}`);
    const data = await res.json();
    if (data.ok) {
      const record = data.record;
      const p = record.payload || {};
      
      // Convert drinkStock object to array format for display
      let drinksArray: { name: string; quantity: number; unit: string }[] = [];
      if (p.drinkStock) {
        if (Array.isArray(p.drinkStock)) {
          // Already an array
          drinksArray = p.drinkStock;
        } else if (typeof p.drinkStock === 'object') {
          // Convert object to array - SHOW ALL DRINKS EVEN IF 0
          drinksArray = Object.entries(p.drinkStock).map(([name, quantity]) => ({
            name,
            quantity: typeof quantity === 'number' ? quantity : 0,
            unit: 'units'
          }));
        }
      }
      
      // Transform the data to match expected structure
      const transformedRecord = {
        id: record.id,
        date: record.date,
        staff: record.staff,
        sales: {
          cash: p.cashSales || 0,
          qr: p.qrSales || 0,
          grab: p.grabSales || 0,
          other: p.otherSales || 0,
          total: p.totalSales || 0
        },
        expenses: p.expenses || [],
        wages: p.wages || [],
        banking: {
          startingCash: p.startingCash || 0,
          closingCash: p.closingCash || 0,
          cashBanked: p.cashBanked || 0,
          qrTransfer: p.qrTransfer || 0
        },
        stock: {
          rolls: p.rollsEnd ?? 0,
          meat: p.meatEnd ?? 0,
          drinks: drinksArray,
          zeroConfirmation: p.zeroConfirmation || null
        },
        shoppingList: p.requisition || [],
        audit: Array.isArray(record.audit) ? record.audit : []
      };
      
      setSelected(transformedRecord);
    }
  }

  function editRecord(id: string) {
    window.location.href = `/operations/daily-sales/edit/${id}`;
  }

  function completeStockRecord(id: string) {
    window.location.href = `/operations/daily-stock?shift=${id}`;
  }

  const hasForm2Data = (rec: RecordType) => Boolean(rec.hasStock);


  const filteredRecords = showArchived
    ? records.filter((r) => r.deletedAt)
    : records.filter((r) => !r.deletedAt);

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm md:p-6">
        <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div>
            <h1 className="text-2xl font-semibold text-slate-900 font-[Poppins]">Daily Sales Library (V2)</h1>
            <p className="mt-1 text-sm text-slate-600">Full-width operations archive with cleaner spacing for tablet and desktop review.</p>
          </div>
          <button
            className="h-11 rounded-lg border border-slate-300 bg-slate-100 px-4 text-sm font-medium text-slate-700 hover:bg-slate-200"
            onClick={() => setShowArchived(!showArchived)}
          >
            {showArchived ? "Show Active" : "Show Archived"}
          </button>
        </div>
      </div>

      {loading && <p className="text-center py-4">Loading...</p>}
      {error && <p className="text-red-500 text-center py-4">{error}</p>}
      
      {/* Stacked 2-row library layout (tablet + desktop friendly) */}
      <div className="space-y-3">
        {filteredRecords.length === 0 ? (
          <div className="bg-white border border-gray-200 rounded-lg p-6 text-center text-gray-500">
            No records found
          </div>
        ) : (
          filteredRecords.map((rec) => (
            <div key={rec.id} className="bg-white border border-slate-200 rounded-[4px] p-4 shadow-sm space-y-3">
              <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-center">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-sm">
                  <div className="space-y-0.5">
                    <p className="text-[10px] uppercase tracking-wide text-slate-400 leading-tight">Date</p>
                    <p className="font-semibold text-slate-900 whitespace-nowrap leading-snug">{new Date(rec.date).toLocaleDateString()}</p>
                  </div>
                  <div className="space-y-0.5">
                    <p className="text-[10px] uppercase tracking-wide text-slate-400 leading-tight">Staff</p>
                    <p className="font-medium text-slate-800 truncate leading-snug">{rec.staff}</p>
                  </div>
                  <div className="space-y-0.5">
                    <p className="text-[10px] uppercase tracking-wide text-slate-400 leading-tight">Total Sales</p>
                    <p className="font-semibold text-slate-900 whitespace-nowrap leading-snug">{thb(rec.totalSales)}</p>
                  </div>
                </div>

                <div className="flex items-center gap-2 lg:justify-end">
                  {rec.deletedAt ? (
                    <span className="bg-red-100 text-red-800 px-2 py-1 rounded text-xs whitespace-nowrap font-medium">
                      Archived
                    </span>
                  ) : (
                    <span className="bg-green-100 text-green-800 px-2 py-1 rounded text-xs whitespace-nowrap font-medium">
                      {rec.status}
                    </span>
                  )}
                  {rec.payload?.balanced ? (
                    <span className="px-2 py-1 text-xs font-semibold rounded bg-green-100 text-green-700 whitespace-nowrap">Balanced</span>
                  ) : (
                    <span className="px-2 py-1 text-xs font-semibold rounded bg-red-100 text-red-700 whitespace-nowrap">Not Balanced</span>
                  )}
                  {(() => {
                    const refunds = (rec as any).payload?.refunds;
                    if (!refunds || refunds.status !== 'YES') {
                      return <span className="px-2 py-1 text-xs font-semibold rounded bg-slate-100 text-slate-500 whitespace-nowrap">Refunds: N</span>;
                    }
                    const count = Array.isArray(refunds.rows) ? refunds.rows.length : 0;
                    return <span className={`px-2 py-1 text-xs font-semibold rounded whitespace-nowrap ${count > 0 ? 'bg-amber-100 text-amber-700' : 'bg-slate-100 text-slate-500'}`}>Refunds: {count}</span>;
                  })()}
                </div>
              </div>

              <div className="border-t border-slate-100 pt-3 grid gap-3 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-center">
                {(() => {
                  const receipt = getReceiptCounts(rec);
                  const rollsZero = (rec.buns ?? null) !== null && Number(rec.buns) === 0;
                  const meatZero = (rec.meat ?? null) !== null && Number(rec.meat) === 0;
                  const hasZeroCount = hasForm2Data(rec) && (rollsZero || meatZero);
                  return (
                    <div className="text-sm text-slate-700">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="font-medium">Rolls: {rec.buns ?? "-"} | Meat: {rec.meat ?? "-"} | Receipts: {receipt.total}</p>
                        {hasZeroCount && (
                          <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-semibold bg-amber-100 text-amber-700 border border-amber-300 whitespace-nowrap">
                            <AlertTriangle className="h-2.5 w-2.5" />
                            Zero count logged
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-slate-500">Grab: {receipt.grab} | Cash: {receipt.cash} | QR: {receipt.qr}</p>
                    </div>
                  );
                })()}

                <div className="flex flex-wrap items-center gap-1.5 lg:justify-end">
                <button
                  className="p-1.5 hover:bg-slate-100 text-black rounded"
                  onClick={() => viewRecord(rec.id)}
                  title="View"
                >
                  <Eye size={14} />
                </button>
                <button
                  className="p-1.5 hover:bg-slate-100 text-black rounded"
                  onClick={() => printRecord(rec.id)}
                  title="Print"
                >
                  <Printer size={14} />
                </button>
                <button
                  className="p-1.5 hover:bg-slate-100 text-black rounded"
                  onClick={() => downloadRecord(rec)}
                  title="Download"
                >
                  <Download size={14} />
                </button>
                {!rec.deletedAt && (
                  <>
                    {!hasForm2Data(rec) && (
                      <button
                        className="px-2 py-1 bg-emerald-100 hover:bg-emerald-200 text-emerald-700 rounded text-[10px] sm:text-xs"
                        onClick={() => completeStockRecord(rec.id)}
                      >
                        Complete Stock (Form 2)
                      </button>
                    )}
                    <button
                      className="px-2 py-1 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded text-[10px] sm:text-xs"
                      onClick={() => editRecord(rec.id)}
                    >
                      Edit
                    </button>
                    <button
                      className="px-2 py-1 bg-red-100 hover:bg-red-200 text-red-700 rounded text-[10px] sm:text-xs"
                      onClick={() => confirmDeleteRecord(rec.id)}
                    >
                      Delete
                    </button>
                  </>
                )}
                {rec.deletedAt && (
                  <button
                    className="px-2 py-1 bg-green-100 hover:bg-green-200 text-green-700 rounded text-[10px] sm:text-xs"
                    onClick={() => restoreRecord(rec.id)}
                  >
                    Restore
                  </button>
                )}
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      {/* View Modal */}
      {selected && (
        <div className="fixed inset-0 bg-black bg-opacity-40 flex items-center justify-center z-50 p-2 sm:p-4">
          <div className="bg-white rounded-lg shadow-lg max-w-3xl w-full mx-auto p-4 md:p-6 overflow-y-auto max-h-[95vh] font-[Poppins]">
            <h2 className="text-xl font-bold mb-4">Complete Daily Sales & Stock Form</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              
              {/* FORM 1 - Daily Sales Data */}
              <div className="space-y-3">
                <h3 className="text-sm font-semibold text-emerald-700 border-b pb-2">Daily Sales (Form 1)</h3>
                
                <div className="bg-red-50 p-3 rounded text-xs">
                  <h4 className="text-xs font-semibold mb-2">Basic Info</h4>
                  <p className="text-xs"><strong>Date:</strong> {new Date(selected.date).toLocaleDateString()}</p>
                  <p className="text-xs"><strong>Completed By:</strong> {selected.staff}</p>
                </div>

                <div className="bg-red-50 p-3 rounded text-xs">
                  <h4 className="text-xs font-semibold mb-2">Sales Breakdown</h4>
                  <p className="text-xs"><strong>Cash Sales:</strong> ฿{selected.sales.cash.toLocaleString()}</p>
                  <p className="text-xs"><strong>QR Sales:</strong> ฿{selected.sales.qr.toLocaleString()}</p>
                  <p className="text-xs"><strong>Grab Sales:</strong> ฿{selected.sales.grab.toLocaleString()}</p>
                  <p className="text-xs"><strong>Other Sales:</strong> ฿{selected.sales.other.toLocaleString()}</p>
                  <p className="text-xs font-bold border-t pt-2 mt-1"><strong>Total Sales:</strong> ฿{selected.sales.total.toLocaleString()}</p>
                </div>

                <div className="bg-red-50 p-3 rounded text-xs">
                  <h4 className="text-xs font-semibold mb-2">Expenses & Wages</h4>
                  
                  {/* Regular Expenses */}
                  {selected.expenses.length > 0 && (
                    <div className="mb-3">
                      <h5 className="text-xs font-medium mb-1">Expenses</h5>
                      <ul className="space-y-1">
                        {selected.expenses.map((expense, idx) => (
                          <li key={idx} className="flex justify-between">
                            <span className="truncate mr-2">{expense.item} ({expense.shop})</span>
                            <span className="whitespace-nowrap">฿{expense.cost.toLocaleString()}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                  
                  {/* Staff Wages */}
                  {selected.wages && selected.wages.length > 0 && (
                    <div>
                      <h5 className="text-xs font-medium mb-1">Staff Wages</h5>
                      <ul className="space-y-1">
                        {selected.wages.map((wage, idx) => (
                          <li key={idx} className="flex justify-between">
                            <span>{wage.staff} (Wages)</span>
                            <span>฿{wage.amount.toLocaleString()}</span>
                          </li>
                        ))}
                      </ul>
                      <div className="border-t pt-2 mt-2">
                        <div className="flex justify-between font-semibold">
                          <span>Total Wages:</span>
                          <span>฿{(selected.wages ? selected.wages.reduce((sum, w) => sum + w.amount, 0) : 0).toLocaleString()}</span>
                        </div>
                      </div>
                    </div>
                  )}
                  
                  {selected.expenses.length === 0 && (!selected.wages || selected.wages.length === 0) && (
                    <p>No expenses or wages recorded</p>
                  )}
                </div>

                <div className="bg-red-50 p-3 rounded text-xs">
                  <h4 className="text-xs font-semibold mb-2">Banking & Cash</h4>
                  <p className="text-xs"><strong>Starting Cash:</strong> ฿{selected.banking.startingCash.toLocaleString()}</p>
                  <p className="text-xs"><strong>Closing Cash:</strong> ฿{selected.banking.closingCash.toLocaleString()}</p>
                  <p className="text-xs"><strong>Cash Banked:</strong> ฿{selected.banking.cashBanked.toLocaleString()}</p>
                  <p className="text-xs"><strong>QR Transfer:</strong> ฿{selected.banking.qrTransfer.toLocaleString()}</p>
                  
                  {(() => {
                    const startingCash = selected.banking.startingCash;
                    const cashSales = selected.sales.cash;
                    const totalExpenses = selected.expenses.reduce((sum, e) => sum + e.cost, 0);
                    const totalWages = selected.wages ? selected.wages.reduce((sum, w) => sum + w.amount, 0) : 0;
                    const cashBanked = selected.banking.cashBanked;
                    const closingCash = selected.banking.closingCash;
                    
                    const expectedClosing = startingCash + cashSales - totalExpenses - totalWages;
                    const difference = closingCash - expectedClosing;
                    const isBalanced = Math.abs(difference) <= 0.30;
                    
                    return (
                      <div className="border-t pt-2 mt-2">
                        <h5 className="text-xs font-medium mb-2">Balance Check</h5>
                        <div className="space-y-1 text-xs">
                          <p className="text-xs">Expected: ฿{startingCash.toLocaleString()} + ฿{cashSales.toLocaleString()} - ฿{totalExpenses.toLocaleString()} - ฿{totalWages.toLocaleString()} - ฿{cashBanked.toLocaleString()}</p>
                          <p className="text-xs"><strong>Expected Closing:</strong> ฿{expectedClosing.toLocaleString()}</p>
                          <p className="text-xs"><strong>Actual Closing:</strong> ฿{closingCash.toLocaleString()}</p>
                          <p className={`text-xs font-bold ${isBalanced ? 'text-green-600' : 'text-red-600'}`}>
                            <strong>Difference:</strong> ฿{difference.toLocaleString()} 
                            {isBalanced ? ' BALANCED' : ' NOT BALANCED'}
                          </p>
                        </div>
                      </div>
                    );
                  })()}
                </div>
              </div>

              {/* FORM 2 - Stock Data */}
              <div className="space-y-3">
                <h3 className="text-sm font-semibold text-purple-700 border-b pb-2">Stock Management (Form 2)</h3>
                
                <div className="bg-red-50 p-3 rounded text-xs">
                  <h4 className="text-xs font-semibold mb-2">End Count</h4>
                  <p className="text-xs"><strong>Rolls:</strong> {selected.stock.rolls ?? 0} pcs</p>
                  <p className="text-xs"><strong>Meat:</strong> {selected.stock.meat ?? 0} grams</p>

                  {selected.stock.zeroConfirmation ? (
                    <div className="mt-3 p-2 bg-amber-50 border border-amber-300 rounded">
                      <div className="flex items-center gap-1.5 text-amber-700 font-semibold mb-1">
                        <AlertTriangle className="h-3 w-3 flex-shrink-0" />
                        <span className="text-[11px]">Zero Count — Staff Confirmed</span>
                      </div>
                      <p className="text-[11px] text-amber-800">
                        <strong>Fields confirmed as zero:</strong>{' '}
                        {selected.stock.zeroConfirmation.fields.join(' & ')}
                      </p>
                      <p className="text-[11px] text-amber-700 mt-0.5">
                        <strong>Confirmed at:</strong>{' '}
                        {new Date(selected.stock.zeroConfirmation.confirmedAt).toLocaleString('en-GB', {
                          day: '2-digit', month: '2-digit', year: 'numeric',
                          hour: '2-digit', minute: '2-digit', second: '2-digit'
                        })}
                      </p>
                      <p className="text-[10px] text-amber-600 mt-1 italic">
                        Staff confirmed these counts were correct at time of submission.
                      </p>
                    </div>
                  ) : (selected.stock.rolls === 0 || selected.stock.meat === 0) && (selected.stock.rolls !== null && selected.stock.meat !== null) ? (
                    <div className="mt-3 p-2 bg-slate-100 border border-slate-300 rounded">
                      <p className="text-[10px] text-slate-500 italic">
                        ⚠️ One or more counts are zero — submitted without confirmation prompt (legacy record).
                      </p>
                    </div>
                  ) : null}
                </div>

                {/* Drinks Stock Section - ALWAYS SHOW ALL DRINKS EVEN IF 0 */}
                <div className="bg-red-50 p-3 rounded text-xs">
                  <h4 className="text-xs font-semibold mb-2">Drinks Count</h4>
                  {selected.stock.drinks && selected.stock.drinks.length > 0 ? (
                    <div className="space-y-1 text-xs">
                      {selected.stock.drinks.map((drink, idx) => (
                        <p key={idx} className="text-xs">
                          <strong>{drink.name}:</strong> {drink.quantity ?? 0} {drink.unit}
                        </p>
                      ))}
                    </div>
                  ) : (
                    <p className="text-xs text-gray-500">No drinks recorded</p>
                  )}
                </div>

                <div className="bg-red-50 p-3 rounded text-xs">
                  <h4 className="text-xs font-semibold mb-2">Shopping List / Requisition</h4>
                  {selected.shoppingList.length === 0 ? (
                    <p className="text-xs text-gray-500">No items to purchase</p>
                  ) : (
                    <div className="space-y-1">
                      {selected.shoppingList.map((item, idx) => (
                        <div key={idx} className="flex justify-between items-center bg-white p-1.5 rounded border border-slate-200 text-xs">
                          <div className="flex-1 min-w-0 mr-2">
                            <span className="text-xs font-medium truncate block">{item.name}</span>
                            <span className="text-xs text-gray-500">({item.category})</span>
                          </div>
                          <span className="text-xs font-bold whitespace-nowrap">{item.qty} {item.qty === 1 ? 'item' : 'items'}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Drinks Requisition Section */}
                <DrinksRequisitionSection requisition={selected.shoppingList} />
              </div>
            </div>


            <div className="mt-4 border-t pt-4">
              <details className="cursor-pointer">
                <summary className="font-semibold text-gray-700 text-xs">Audit</summary>
                <div className="mt-2 space-y-2">
                  {(selected.audit || []).length === 0 ? (
                    <p className="text-xs text-gray-500">No audit entries</p>
                  ) : (
                    (selected.audit || []).map((entry) => (
                      <div key={entry.id} className="bg-gray-50 border border-gray-200 rounded p-2 text-xs">
                        <p><strong>{entry.actionType}</strong> • {new Date(entry.createdAt).toLocaleString()} • {entry.actor}</p>
                        <ul className="list-disc ml-4 mt-1">
                          {(entry.changedFields || []).map((f, idx) => (
                            <li key={`${entry.id}-${idx}`}>{f.field}: {String(f.from ?? 'null')} → {String(f.to ?? 'null')}</li>
                          ))}
                        </ul>
                      </div>
                    ))
                  )}
                </div>
              </details>
            </div>

            {/* Raw Data Section (for debugging) */}
            <div className="mt-4 border-t pt-4">
              <details className="cursor-pointer">
                <summary className="font-semibold text-gray-600 text-xs">Raw Data (Debug)</summary>
                <div className="mt-2 bg-gray-100 p-3 rounded text-xs overflow-auto">
                  <pre>{JSON.stringify(selected, null, 2)}</pre>
                </div>
              </details>
            </div>

            <div className="mt-4 flex justify-end space-x-2">
              <button
                className="px-4 py-2 bg-gray-300 hover:bg-gray-400 rounded-[4px] text-xs font-medium"
                onClick={() => setSelected(null)}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Confirmation Dialogs */}
      <ConfirmDialog
        isOpen={deleteDialog.isOpen}
        onClose={() => setDeleteDialog({ isOpen: false, id: null })}
        onConfirm={deleteRecord}
        title="Delete Record"
        message="Are you sure you want to delete this daily sales record? This action cannot be undone."
        confirmText="Delete"
        cancelText="Cancel"
        variant="danger"
      />

      <SuccessDialog
        isOpen={successDialog.isOpen}
        onClose={() => setSuccessDialog({ isOpen: false, message: '' })}
        title="Success!"
        message={successDialog.message}
        buttonText="OK"
      />

      <SuccessDialog
        isOpen={errorDialog.isOpen}
        onClose={() => setErrorDialog({ isOpen: false, message: '' })}
        title="Error"
        message={errorDialog.message}
        buttonText="OK"
      />
    </div>
  );
}
