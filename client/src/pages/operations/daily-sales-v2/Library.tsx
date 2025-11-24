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
import { Eye, Printer, Download } from 'lucide-react';
import { ConfirmDialog, SuccessDialog } from '@/components/ui/confirm-dialog';

// MEGA PATCH V3: Safe number helpers
const safeNumber = (v: any) => (v === 0 || typeof v === "number") ? v : (Number(v) || 0);
const sumDrinks = (m: any) => Object.values(m || {}).map(Number).reduce((a, b) => a + (b || 0), 0);

// THB formatting helper
const thb = (v: unknown): string => {
  const n = typeof v === "number" && Number.isFinite(v) ? v : Number(v) || 0;
  return "฿" + n.toLocaleString("en-TH", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
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
  banking: any;
  stock: any;
  shoppingList: { name: string; qty: number; unit: string }[];
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
    <div className="bg-blue-50 p-3 rounded">
      <h4 className="font-semibold mb-2">Drinks Requisition</h4>
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b">
            <th className="text-left p-1">Item</th>
            <th className="text-right p-1">Qty</th>
            <th className="text-right p-1">Cost</th>
          </tr>
        </thead>
        <tbody>
          {drinksRequisition.map((r, idx) => {
            const ingredient = ingredients.data.find(i => i.id === r.id || i.name.toLowerCase() === r.name.toLowerCase());
            const cost = r.qty * (ingredient?.unitCost || 0);
            return (
              <tr key={idx}>
                <td className="p-1">{ingredient?.name || r.name}</td>
                <td className="text-right p-1">{r.qty}</td>
                <td className="text-right p-1 font-semibold">{thb(cost)}</td>
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
      doc.text(`Total: ฿${(p.totalSales || 0).toLocaleString()}`, 20, yPos); yPos += 15;
      
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
          rolls: p.rollsEnd || 0,
          meat: p.meatEnd || 0,
          drinks: p.drinkStock || []
        },
        shoppingList: p.requisition || []
      };
      
      setSelected(transformedRecord);
    }
  }

  function editRecord(id: string) {
    window.location.href = `/operations/daily-sales/edit/${id}`;
  }

  const filteredRecords = showArchived
    ? records.filter((r) => r.deletedAt)
    : records.filter((r) => !r.deletedAt);

  return (
    <div className="p-3 md:p-6">
      {/* Header - Mobile Responsive */}
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center mb-4 gap-2">
        <h1 className="text-xl md:text-2xl font-extrabold font-[Poppins]">
          Daily Sales Library (V2)
        </h1>
        <button
          className="px-2 py-1 sm:px-3 sm:py-2 bg-gray-200 hover:bg-gray-300 rounded text-xs sm:text-sm"
          onClick={() => setShowArchived(!showArchived)}
        >
          {showArchived ? "Show Active" : "Show Archived"}
        </button>
      </div>

      {loading && <p className="text-center py-4">Loading...</p>}
      {error && <p className="text-red-500 text-center py-4">{error}</p>}
      
      {/* Desktop Table - Hidden on Mobile */}
      <div className="hidden lg:block overflow-x-auto">
        <table className="min-w-full bg-white border border-gray-200 rounded-lg">
          <thead>
            <tr className="bg-gray-100 text-left text-xs md:text-sm font-semibold font-[Poppins]">
              <th className="px-2 py-1 border-b">Date</th>
              <th className="px-2 py-1 border-b">Staff</th>
              <th className="px-2 py-1 border-b">Total Sales</th>
              <th className="px-2 py-1 border-b">Rolls</th>
              <th className="px-2 py-1 border-b">Meat</th>
              <th className="px-2 py-1 border-b">Drinks</th>
              <th className="px-2 py-1 border-b">Balanced</th>
              <th className="px-2 py-1 border-b">Status</th>
              <th className="px-2 py-1 border-b">Actions</th>
            </tr>
          </thead>
          <tbody>
            {filteredRecords.length === 0 ? (
              <tr>
                <td colSpan={9} className="p-4 text-center text-gray-500">
                  No records found
                </td>
              </tr>
            ) : (
              filteredRecords.map((rec) => (
                <tr key={rec.id} className="text-xs md:text-sm font-[Poppins] hover:bg-gray-50">
                  <td className="px-2 py-1 border-b whitespace-nowrap">
                    {new Date(rec.date).toLocaleDateString()}
                  </td>
                  <td className="px-2 py-1 border-b">{rec.staff}</td>
                  <td className="px-2 py-1 border-b whitespace-nowrap">{thb(rec.totalSales)}</td>
                  <td className="px-2 py-1 border-b">{rec.buns ?? "-"}</td>
                  <td className="px-2 py-1 border-b">{rec.meat ?? "-"}</td>
                  <td className="px-2 py-1 border-b">
                    {(rec.drinksCount ?? 0) > 0 
                      ? `${rec.drinksCount} items`
                      : "-"}
                  </td>
                  <td className="px-2 py-1 border-b">
                    {rec.payload?.balanced ? (
                      <span className="px-1.5 py-0.5 text-[10px] md:text-xs font-semibold rounded bg-green-100 text-green-700">
                        Balanced
                      </span>
                    ) : (
                      <span className="px-1.5 py-0.5 text-[10px] md:text-xs font-semibold rounded bg-red-100 text-red-700">
                        Not Balanced
                      </span>
                    )}
                  </td>
                  <td className="px-2 py-1 border-b">
                    {rec.deletedAt ? (
                      <span className="bg-red-100 text-red-800 px-1.5 py-0.5 rounded text-[10px] md:text-xs whitespace-nowrap">
                        Archived
                      </span>
                    ) : (
                      <span className="bg-green-100 text-green-800 px-1.5 py-0.5 rounded text-[10px] md:text-xs whitespace-nowrap">
                        {rec.status}
                      </span>
                    )}
                  </td>
                  <td className="px-2 py-1 border-b">
                    <div className="flex flex-wrap gap-0.5">
                      <button
                        className="p-1 hover:bg-gray-100 text-black rounded"
                        onClick={() => viewRecord(rec.id)}
                        title="View"
                      >
                        <Eye size={14} />
                      </button>
                      <button
                        className="p-1 hover:bg-gray-100 text-black rounded"
                        onClick={() => printRecord(rec.id)}
                        title="Print"
                      >
                        <Printer size={14} />
                      </button>
                      <button
                        className="p-1 hover:bg-gray-100 text-black rounded"
                        onClick={() => downloadRecord(rec)}
                        title="Download"
                      >
                        <Download size={14} />
                      </button>
                      {!rec.deletedAt && (
                        <>
                          <button
                            className="px-1.5 py-0.5 bg-gray-100 hover:bg-gray-200 text-black font-[Poppins] rounded text-[10px] md:text-xs"
                            onClick={() => editRecord(rec.id)}
                          >
                            Edit
                          </button>
                          <button
                            className="px-1.5 py-0.5 bg-red-100 hover:bg-red-200 text-red-700 font-[Poppins] rounded text-[10px] md:text-xs"
                            onClick={() => confirmDeleteRecord(rec.id)}
                          >
                            Delete
                          </button>
                        </>
                      )}
                      {rec.deletedAt && (
                        <button
                          className="px-1.5 py-0.5 bg-green-100 hover:bg-green-200 text-green-700 font-[Poppins] rounded text-[10px] md:text-xs"
                          onClick={() => restoreRecord(rec.id)}
                        >
                          Restore
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Mobile Card Layout - Shown on Small Screens */}
      <div className="lg:hidden space-y-2">
        {filteredRecords.length === 0 ? (
          <div className="bg-white border border-gray-200 rounded-lg p-6 text-center text-gray-500">
            No records found
          </div>
        ) : (
          filteredRecords.map((rec) => (
            <div key={rec.id} className="bg-white border border-gray-200 rounded-lg p-2 sm:p-3 shadow-sm">
              {/* Compact Info Row */}
              <div className="flex items-center justify-between gap-2 mb-2">
                <div className="flex items-center gap-1.5 sm:gap-2 flex-1 min-w-0">
                  <span className="font-semibold text-xs sm:text-sm whitespace-nowrap">
                    {new Date(rec.date).toLocaleDateString('en-US', { month: 'numeric', day: 'numeric' })}
                  </span>
                  <span className="text-gray-600 text-xs truncate">{rec.staff}</span>
                  <span className="font-semibold text-xs sm:text-sm whitespace-nowrap">{thb(rec.totalSales)}</span>
                  <span className="text-gray-500 text-[10px] sm:text-xs whitespace-nowrap">R:{rec.buns ?? "-"}</span>
                  <span className="text-gray-500 text-[10px] sm:text-xs whitespace-nowrap">M:{rec.meat ?? "-"}</span>
                </div>
                <div className="flex items-center gap-1.5">
                  {/* Balance Status - Styled Badge like Home Screen */}
                  {rec.payload?.balanced ? (
                    <span className="px-2 py-1 text-[10px] sm:text-xs font-semibold rounded-full bg-green-500 text-white whitespace-nowrap w-[85px] sm:w-[95px] text-center">Balanced</span>
                  ) : (
                    <span className="px-2 py-1 text-[10px] sm:text-xs font-semibold rounded-full bg-red-500 text-white whitespace-nowrap w-[85px] sm:w-[95px] text-center">Unbalanced</span>
                  )}
                  {/* Only show Draft status - submitted is default */}
                  {rec.deletedAt ? (
                    <span className="bg-red-100 text-red-800 px-1.5 py-0.5 rounded text-[10px] whitespace-nowrap">Arc</span>
                  ) : rec.status === 'Draft' ? (
                    <span className="bg-amber-100 text-amber-800 px-1.5 py-0.5 rounded text-[10px] whitespace-nowrap">Draft</span>
                  ) : null}
                </div>
              </div>

              {/* Compact Actions Row */}
              <div className="flex items-center gap-1">
                <button
                  className="p-1 hover:bg-gray-100 text-black rounded"
                  onClick={() => viewRecord(rec.id)}
                  title="View"
                >
                  <Eye size={14} />
                </button>
                <button
                  className="p-1 hover:bg-gray-100 text-black rounded"
                  onClick={() => window.open(`/api/forms/daily-sales/v2/${rec.id}/print-full`, "_blank")}
                  title="Print"
                >
                  <Printer size={14} />
                </button>
                <button
                  className="p-1 hover:bg-gray-100 text-black rounded"
                  onClick={() => {
                    const link = document.createElement("a");
                    link.href = `/api/forms/daily-sales/v2/${rec.id}/pdf`;
                    link.download = `daily-sales-${rec.id}.pdf`;
                    link.click();
                  }}
                  title="Download"
                >
                  <Download size={14} />
                </button>
                {!rec.deletedAt && (
                  <>
                    <button
                      className="px-2 py-1 bg-gray-100 hover:bg-gray-200 text-black rounded text-[10px] sm:text-xs"
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
                
                <div className="bg-gray-50 p-3 rounded text-xs">
                  <h4 className="font-semibold mb-2">Basic Info</h4>
                  <p><strong>Date:</strong> {new Date(selected.date).toLocaleDateString()}</p>
                  <p><strong>Completed By:</strong> {selected.staff}</p>
                </div>

                <div className="bg-blue-50 p-3 rounded text-xs">
                  <h4 className="font-semibold mb-2">Sales Breakdown</h4>
                  <p><strong>Cash Sales:</strong> ฿{selected.sales.cash.toLocaleString()}</p>
                  <p><strong>QR Sales:</strong> ฿{selected.sales.qr.toLocaleString()}</p>
                  <p><strong>Grab Sales:</strong> ฿{selected.sales.grab.toLocaleString()}</p>
                  <p><strong>Other Sales:</strong> ฿{selected.sales.other.toLocaleString()}</p>
                  <p className="font-bold border-t pt-2 mt-1"><strong>Total Sales:</strong> ฿{selected.sales.total.toLocaleString()}</p>
                </div>

                <div className="bg-red-50 p-3 rounded text-xs">
                  <h4 className="font-semibold mb-2">Expenses & Wages</h4>
                  
                  {/* Regular Expenses */}
                  {selected.expenses.length > 0 && (
                    <div className="mb-3">
                      <h5 className="font-medium mb-1">Expenses</h5>
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
                      <h5 className="font-medium mb-1">Staff Wages</h5>
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

                <div className="bg-green-50 p-3 rounded text-xs">
                  <h4 className="font-semibold mb-2">Banking & Cash</h4>
                  <p><strong>Starting Cash:</strong> ฿{selected.banking.startingCash.toLocaleString()}</p>
                  <p><strong>Closing Cash:</strong> ฿{selected.banking.closingCash.toLocaleString()}</p>
                  <p><strong>Cash Banked:</strong> ฿{selected.banking.cashBanked.toLocaleString()}</p>
                  <p><strong>QR Transfer:</strong> ฿{selected.banking.qrTransfer.toLocaleString()}</p>
                  
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
                        <h5 className="font-medium mb-2">Balance Check</h5>
                        <div className="space-y-1">
                          <p>Expected: ฿{startingCash.toLocaleString()} + ฿{cashSales.toLocaleString()} - ฿{totalExpenses.toLocaleString()} - ฿{totalWages.toLocaleString()} - ฿{cashBanked.toLocaleString()}</p>
                          <p><strong>Expected Closing:</strong> ฿{expectedClosing.toLocaleString()}</p>
                          <p><strong>Actual Closing:</strong> ฿{closingCash.toLocaleString()}</p>
                          <p className={`font-bold ${isBalanced ? 'text-green-600' : 'text-red-600'}`}>
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
                
                <div className="bg-purple-50 p-3 rounded text-xs">
                  <h4 className="font-semibold mb-2">End Count</h4>
                  <p><strong>Rolls:</strong> {selected.stock.rolls ?? 0} pcs</p>
                  <p><strong>Meat:</strong> {selected.stock.meat ?? 0} grams</p>
                </div>

                {/* Drinks Stock Section - ALWAYS SHOW ALL DRINKS EVEN IF 0 */}
                <div className="bg-blue-50 p-3 rounded text-xs">
                  <h4 className="font-semibold mb-2">Drinks Count</h4>
                  {selected.stock.drinks && selected.stock.drinks.length > 0 ? (
                    <div className="space-y-1">
                      {selected.stock.drinks.map((drink, idx) => (
                        <p key={idx}>
                          <strong>{drink.name}:</strong> {drink.quantity ?? 0} {drink.unit}
                        </p>
                      ))}
                    </div>
                  ) : (
                    <p className="text-gray-500">No drinks recorded</p>
                  )}
                </div>

                <div className="bg-orange-50 p-3 rounded text-xs">
                  <h4 className="font-semibold mb-2">Shopping List / Requisition</h4>
                  {selected.shoppingList.length === 0 ? (
                    <p className="text-gray-500">No items to purchase</p>
                  ) : (
                    <div className="space-y-2">
                      {selected.shoppingList.map((item, idx) => (
                        <div key={idx} className="flex justify-between items-center bg-white p-2 rounded border">
                          <div className="flex-1 min-w-0 mr-2">
                            <span className="font-medium truncate block">{item.name}</span>
                            <span className="text-gray-500">({item.category})</span>
                          </div>
                          <span className="font-bold whitespace-nowrap">{item.qty} {item.qty === 1 ? 'item' : 'items'}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Drinks Requisition Section */}
                <DrinksRequisitionSection requisition={selected.shoppingList} />
              </div>
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