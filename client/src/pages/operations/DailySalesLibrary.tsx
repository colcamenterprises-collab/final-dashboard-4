/**
 * ⚠️ LOCKED FILE — Do not replace or refactor without Cam's written approval.
 * This is the FINAL implementation used in production. All alternatives were removed on purpose.
 */

import React, { useState, useEffect } from 'react';
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { Search, Eye, Trash2, Download } from "lucide-react";

const __LIB_ID__ = "LIBRARY: LEGACY (DailySalesLibrary.tsx)";

// ---------- SAFE HELPERS ----------
const toBahtNumber = (v: unknown): number => {
  if (v === null || v === undefined) return 0;
  if (typeof v === "number" && Number.isFinite(v)) return v / 100;
  if (typeof v === "string" && v.trim() !== "" && !isNaN(Number(v))) return Number(v) / 100;
  return 0;
};

const THB = (v: unknown): string =>
  "฿" + toBahtNumber(v).toLocaleString("en-TH", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const fromRow = (row: any, key: string, fallback: any = 0) =>
  row?.[key] ?? row?.payload?.[key] ?? fallback;

const getBunsStart = (row: any) => fromRow(row, "rollsStart", fromRow(row, "burgerBunsStart", null));
const getBunsEnd   = (row: any) => fromRow(row, "rollsEnd",   fromRow(row, "burgerBunsEnd",   null));
const getMeatStart = (row: any) => fromRow(row, "meatStartGrams", fromRow(row, "meatStart", null));
const getMeatEnd   = (row: any) => fromRow(row, "meatEndGrams",   fromRow(row, "meatEnd",   null));

const getStaff = (row: any) =>
  row?.completedBy ?? row?.staff ?? row?.payload?.staffName ?? "";
// ----------------------------------

interface DailySalesRecord {
  id: string;
  shiftDate: string;
  completedBy: string;
  cashStart: number;
  cashEnd: number;
  cashBanked: number;
  grabSales: number;
  aroiDeeSales: number;
  burgerBunsStart: number;
  burgerBunsEnd: number;
  meatCountStart: number;
  meatCountEnd: number;
  notes?: string;
  createdAt: string;
  status: 'submitted' | 'draft';
}

export default function DailySalesLibrary() {
  const [records, setRecords] = useState<DailySalesRecord[]>([]);
  const [filteredRecords, setFilteredRecords] = useState<DailySalesRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedRecord, setSelectedRecord] = useState<DailySalesRecord | null>(null);
  const { toast } = useToast();

  useEffect(() => {
    fetchRecords();
  }, []);

  useEffect(() => {
    // @ts-ignore
    if (records?.length) console.log("LIB data[0]:", records[0]);
  }, [records]);

  useEffect(() => {
    const filtered = records.filter(record => 
      record.shiftDate?.includes(searchTerm) ||
      record.completedBy?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      record.notes?.toLowerCase().includes(searchTerm.toLowerCase())
    );
    setFilteredRecords(filtered);
  }, [records, searchTerm]);

  const fetchRecords = async () => {
    try {
      const response = await fetch('/api/forms/daily-sales/v2');
      if (response.ok) {
        const data = await response.json();
        setRecords(data.rows || []);
      } else {
        toast({
          title: "Error",
          description: "Failed to fetch daily sales records",
          variant: "destructive"
        });
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "Network error occurred",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const deleteRecord = async (id: string) => {
    if (!confirm('Are you sure you want to delete this record?')) return;

    try {
      const response = await fetch(`/api/forms/daily-sales/v2/${id}`, {
        method: 'DELETE'
      });

      if (response.ok) {
        setRecords(records.filter(r => r.id !== id));
        toast({
          title: "Success",
          description: "Record deleted successfully"
        });
      } else {
        toast({
          title: "Error",
          description: "Failed to delete record",
          variant: "destructive"
        });
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "Network error occurred",
        variant: "destructive"
      });
    }
  };

  const exportToPDF = async (record: DailySalesRecord) => {
    try {
      const response = await fetch(`/api/forms/daily-sales/v2/${record.id}/pdf`);
      if (response.ok) {
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `daily-sales-${record.shiftDate}.pdf`;
        a.click();
        window.URL.revokeObjectURL(url);
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to export PDF",
        variant: "destructive"
      });
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('th-TH', {
      style: 'currency',
      currency: 'THB',
      maximumFractionDigits: 2
    }).format(amount);
  };

  if (loading) {
    return (
      <div className="max-w-6xl mx-auto p-6">
        <div className="text-center">Loading...</div>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto p-6">
      <div className="text-[10px] opacity-60 mb-1">{__LIB_ID__}</div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900 mb-2">Daily Sales Library</h1>
        <p className="text-gray-600">View and manage all daily sales submissions</p>
      </div>

      {/* Search and Filters */}
      <Card className="p-4 mb-6">
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
            <Input
              placeholder="Search by date, staff name, or notes..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>
          <Button onClick={() => window.location.href = '/daily-sales'}>
            + New Submission
          </Button>
        </div>
      </Card>

      {/* Records Table */}
      <Card>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Date</TableHead>
              <TableHead>Staff</TableHead>
              <TableHead>Cash Start</TableHead>
              <TableHead>Cash End</TableHead>
              <TableHead>Total Sales</TableHead>
              <TableHead>Buns (Start/End)</TableHead>
              <TableHead>Meat (Start/End)</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredRecords.length === 0 ? (
              <TableRow>
                <TableCell colSpan={9} className="text-center py-8 text-gray-500">
                  No records found
                </TableCell>
              </TableRow>
            ) : (
              filteredRecords.map((record) => (
                <TableRow key={record.id}>
                  <TableCell className="font-medium">
                    {new Date(record.shiftDate).toLocaleDateString()}
                  </TableCell>
                  <TableCell>{getStaff(record)}</TableCell>
                  <TableCell>{THB(fromRow(record, "startingCash"))}</TableCell>
                  <TableCell>{THB(fromRow(record, "endingCash"))}</TableCell>
                  <TableCell>{THB(fromRow(record, "totalSales"))}</TableCell>
                  <TableCell>{(() => {
                    const s = getBunsStart(record);
                    const e = getBunsEnd(record);
                    return (s ?? "/") + " / " + (e ?? "/");
                  })()}</TableCell>
                  <TableCell>{(() => {
                    const s = getMeatStart(record);
                    const e = getMeatEnd(record);
                    return (s ?? "/") + " / " + (e ?? "/") + " g";
                  })()}</TableCell>
                  <TableCell>
                    <Badge variant={record.status === 'submitted' ? 'default' : 'secondary'}>
                      {record.status}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <div className="flex gap-2">
                      <Dialog>
                        <DialogTrigger asChild>
                          <Button 
                            variant="outline" 
                            size="sm"
                            onClick={() => setSelectedRecord(record)}
                          >
                            <Eye className="h-4 w-4" />
                          </Button>
                        </DialogTrigger>
                        <DialogContent className="max-w-2xl">
                          <DialogHeader>
                            <DialogTitle>Daily Sales Details</DialogTitle>
                          </DialogHeader>
                          {selectedRecord && (
                            <div className="space-y-4">
                              <div className="grid grid-cols-2 gap-4">
                                <div>
                                  <label className="text-sm font-medium">Date:</label>
                                  <p>{new Date(selectedRecord.shiftDate).toLocaleDateString()}</p>
                                </div>
                                <div>
                                  <label className="text-sm font-medium">Completed By:</label>
                                  <p>{getStaff(selectedRecord)}</p>
                                </div>
                                <div>
                                  <label className="text-sm font-medium">Cash Start:</label>
                                  <p>{THB(fromRow(selectedRecord, "startingCash"))}</p>
                                </div>
                                <div>
                                  <label className="text-sm font-medium">Cash End:</label>
                                  <p>{THB(fromRow(selectedRecord, "endingCash"))}</p>
                                </div>
                                <div>
                                  <label className="text-sm font-medium">Cash Banked:</label>
                                  <p>{THB(fromRow(selectedRecord, "cashBanked"))}</p>
                                </div>
                                <div>
                                  <label className="text-sm font-medium">Grab Sales:</label>
                                  <p>{THB(fromRow(selectedRecord, "grabSales"))}</p>
                                </div>
                                <div>
                                  <label className="text-sm font-medium">Aroi Dee Sales:</label>
                                  <p>{THB(fromRow(selectedRecord, "aroiSales"))}</p>
                                </div>
                                <div>
                                  <label className="text-sm font-medium">Burger Buns (Start/End):</label>
                                  <p>{(() => {
                                    const s = getBunsStart(selectedRecord);
                                    const e = getBunsEnd(selectedRecord);
                                    return (s ?? "/") + " / " + (e ?? "/");
                                  })()}</p>
                                </div>
                                <div>
                                  <label className="text-sm font-medium">Meat Count (Start/End):</label>
                                  <p>{(() => {
                                    const s = getMeatStart(selectedRecord);
                                    const e = getMeatEnd(selectedRecord);
                                    return (s ?? "/") + " / " + (e ?? "/") + " g";
                                  })()}</p>
                                </div>
                                <div className="mt-4">
                                  <div className="font-semibold">Shopping List</div>
                                  {(() => {
                                    const list = fromRow(selectedRecord, "shoppingList", fromRow(selectedRecord, "shopping", [])) as Array<{ sku?: string; qty?: number }>;
                                    if (!Array.isArray(list) || list.length === 0) return <div className="text-sm text-gray-500">No items</div>;
                                    return (
                                      <ul className="list-disc pl-5 text-sm">
                                        {list.map((it, idx) => (
                                          <li key={idx}>
                                            {(it?.sku ?? "Item")} — {it?.qty ?? 0}
                                          </li>
                                        ))}
                                      </ul>
                                    );
                                  })()}
                                </div>
                              </div>
                              {selectedRecord.notes && (
                                <div>
                                  <label className="text-sm font-medium">Notes:</label>
                                  <p className="mt-1 p-2 bg-gray-50 rounded">{selectedRecord.notes}</p>
                                </div>
                              )}
                            </div>
                          )}
                        </DialogContent>
                      </Dialog>
                      
                      <Button 
                        variant="outline" 
                        size="sm"
                        onClick={() => exportToPDF(record)}
                      >
                        <Download className="h-4 w-4" />
                      </Button>
                      
                      <Button 
                        variant="outline" 
                        size="sm"
                        onClick={() => deleteRecord(record.id)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </Card>
    </div>
  );
}