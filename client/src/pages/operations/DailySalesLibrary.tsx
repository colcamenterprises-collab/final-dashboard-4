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
    const filtered = records.filter(record => 
      record.shiftDate?.includes(searchTerm) ||
      record.completedBy?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      record.notes?.toLowerCase().includes(searchTerm.toLowerCase())
    );
    setFilteredRecords(filtered);
  }, [records, searchTerm]);

  const fetchRecords = async () => {
    try {
      const response = await fetch('/api/daily-sales');
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
      const response = await fetch(`/api/daily-sales/${id}`, {
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
      const response = await fetch(`/api/daily-sales/${record.id}/pdf`);
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
              <TableHead>Status</TableHead>
              <TableHead>Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredRecords.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center py-8 text-gray-500">
                  No records found
                </TableCell>
              </TableRow>
            ) : (
              filteredRecords.map((record) => (
                <TableRow key={record.id}>
                  <TableCell className="font-medium">
                    {new Date(record.shiftDate).toLocaleDateString()}
                  </TableCell>
                  <TableCell>{record.completedBy}</TableCell>
                  <TableCell>{formatCurrency(record.cashStart)}</TableCell>
                  <TableCell>{formatCurrency(record.cashEnd)}</TableCell>
                  <TableCell>{formatCurrency(record.grabSales + record.aroiDeeSales)}</TableCell>
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
                                  <p>{selectedRecord.completedBy}</p>
                                </div>
                                <div>
                                  <label className="text-sm font-medium">Cash Start:</label>
                                  <p>{formatCurrency(selectedRecord.cashStart)}</p>
                                </div>
                                <div>
                                  <label className="text-sm font-medium">Cash End:</label>
                                  <p>{formatCurrency(selectedRecord.cashEnd)}</p>
                                </div>
                                <div>
                                  <label className="text-sm font-medium">Cash Banked:</label>
                                  <p>{formatCurrency(selectedRecord.cashBanked)}</p>
                                </div>
                                <div>
                                  <label className="text-sm font-medium">Grab Sales:</label>
                                  <p>{formatCurrency(selectedRecord.grabSales)}</p>
                                </div>
                                <div>
                                  <label className="text-sm font-medium">Aroi Dee Sales:</label>
                                  <p>{formatCurrency(selectedRecord.aroiDeeSales)}</p>
                                </div>
                                <div>
                                  <label className="text-sm font-medium">Burger Buns (Start/End):</label>
                                  <p>{selectedRecord.burgerBunsStart} / {selectedRecord.burgerBunsEnd}</p>
                                </div>
                                <div>
                                  <label className="text-sm font-medium">Meat Count (Start/End):</label>
                                  <p>{selectedRecord.meatCountStart} / {selectedRecord.meatCountEnd}</p>
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