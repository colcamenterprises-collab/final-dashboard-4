import React, { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Edit, Trash2, Plus, ChevronDown, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { PurchaseTallyModal } from "./PurchaseTallyModal";

export function PurchaseTallyList() {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingEntry, setEditingEntry] = useState(null);
  const [search, setSearch] = useState("");
  const [month, setMonth] = useState(new Date().toISOString().slice(0, 7)); // YYYY-MM
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());
  
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Get purchase tally entries
  const { data: entriesData, isLoading } = useQuery({
    queryKey: ["/api/purchase-tally", { month, search }],
    queryFn: () => apiRequest("/api/purchase-tally?" + new URLSearchParams({
      month,
      ...(search && { search }),
      limit: "100"
    })),
  });

  // Get monthly summary  
  const { data: summaryData } = useQuery({
    queryKey: ["/api/purchase-tally/summary", { month }],
    queryFn: () => apiRequest("/api/purchase-tally/summary?" + new URLSearchParams({ month })),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => apiRequest(`/api/purchase-tally/${id}`, { method: "DELETE" }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/purchase-tally"] });
      queryClient.invalidateQueries({ queryKey: ["/api/purchase-tally/summary"] });
      toast({ title: "Purchase tally deleted successfully" });
    },
    onError: (error: any) => {
      toast({ 
        title: "Error deleting purchase tally", 
        description: error.message,
        variant: "destructive" 
      });
    },
  });

  const handleEdit = (entry: any) => {
    setEditingEntry(entry);
    setIsModalOpen(true);
  };

  const handleDelete = (id: string) => {
    if (confirm("Are you sure you want to delete this purchase tally?")) {
      deleteMutation.mutate(id);
    }
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setEditingEntry(null);
  };

  const toggleRowExpansion = (entryId: string) => {
    const newExpanded = new Set(expandedRows);
    if (newExpanded.has(entryId)) {
      newExpanded.delete(entryId);
    } else {
      newExpanded.add(entryId);
    }
    setExpandedRows(newExpanded);
  };

  const entries = entriesData?.entries || [];
  const summary = summaryData?.summary || {};

  return (
    <div className="space-y-6">
      {/* Header with Add Button */}
      <div className="flex justify-between items-center">
        <div>
          <h3 className="text-lg font-semibold">Purchase Tally</h3>
          <p className="text-sm text-gray-600">Track daily purchases separately from forms</p>
        </div>
        <Button onClick={() => setIsModalOpen(true)} className="gap-2">
          <Plus className="h-4 w-4" />
          Add Purchase
        </Button>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Total Amount</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-lg font-bold currency">
              ฿{Number(summary.totalAmount || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}
            </div>
            <div className="text-xs text-gray-500">{summary.entryCount || 0} entries</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Rolls</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-lg font-bold num">{summary.totalRolls || 0} pcs</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Meat</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-lg font-bold num">{Number(summary.totalMeat || 0).toLocaleString()} g</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Drinks</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-lg font-bold num">{summary.totalDrinks || 0} pcs</div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <div className="flex gap-4 items-center">
        <div>
          <label className="text-sm font-medium">Month</label>
          <Input
            type="month"
            value={month}
            onChange={(e) => setMonth(e.target.value)}
            className="w-40"
          />
        </div>
        <div className="flex-1">
          <label className="text-sm font-medium">Search</label>
          <Input
            placeholder="Search supplier, staff, or notes..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
      </div>

      {/* Entries Table */}
      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-8 text-center">Loading...</div>
          ) : entries.length === 0 ? (
            <div className="p-8 text-center text-gray-500">
              No purchase tallies found. Click "Add Purchase" to get started.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Supplier</TableHead>
                    <TableHead className="text-right">Rolls</TableHead>
                    <TableHead className="text-right">Meat (g)</TableHead>
                    <TableHead className="text-right">Drinks</TableHead>
                    <TableHead className="text-right">Amount</TableHead>
                    <TableHead>Notes</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {entries.map((entry: any) => (
                    <React.Fragment key={entry.id}>
                      <TableRow>
                        <TableCell>
                          {new Date(entry.date).toLocaleDateString()}
                        </TableCell>
                        <TableCell>
                          {entry.supplier ? (
                            <Badge variant="outline">{entry.supplier}</Badge>
                          ) : (
                            <span className="text-gray-400">-</span>
                          )}
                        </TableCell>
                        <TableCell className="text-right num">
                          {entry.rollsPcs || "-"}
                        </TableCell>
                        <TableCell className="text-right num">
                          {entry.meatGrams ? Number(entry.meatGrams).toLocaleString() : "-"}
                        </TableCell>
                        <TableCell className="text-right">
                          {entry.drinks && entry.drinks.length > 0 ? (
                            <div className="flex items-center justify-end gap-2">
                              <span className="num">{entry.drinks.reduce((sum: number, d: any) => sum + d.qty, 0)} pcs</span>
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => toggleRowExpansion(entry.id)}
                                className="h-6 w-6 p-0"
                              >
                                {expandedRows.has(entry.id) ? 
                                  <ChevronDown className="h-3 w-3" /> : 
                                  <ChevronRight className="h-3 w-3" />
                                }
                              </Button>
                            </div>
                          ) : (
                            <span className="text-gray-400">-</span>
                          )}
                        </TableCell>
                        <TableCell className="text-right currency">
                          {entry.amountTHB ? 
                            `฿${Number(entry.amountTHB).toLocaleString('en-US', { minimumFractionDigits: 2 })}` 
                            : "-"
                          }
                        </TableCell>
                        <TableCell className="max-w-xs truncate">
                          {entry.notes || "-"}
                        </TableCell>
                        <TableCell>
                          <div className="flex gap-1">
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => handleEdit(entry)}
                            >
                              <Edit className="h-3 w-3" />
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => handleDelete(entry.id)}
                              disabled={deleteMutation.isPending}
                            >
                              <Trash2 className="h-3 w-3" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                      
                      {/* Expanded drinks details row */}
                      {expandedRows.has(entry.id) && entry.drinks && entry.drinks.length > 0 && (
                        <TableRow>
                          <TableCell colSpan={8} className="bg-muted/30 p-0">
                            <div className="px-6 py-3">
                              <div className="text-sm font-medium mb-2">Drinks breakdown:</div>
                              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                                {entry.drinks.map((drink: any, idx: number) => (
                                  <div key={idx} className="flex justify-between text-sm">
                                    <span>{drink.itemName}</span>
                                    <span className="font-medium">{drink.qty} {drink.unit || 'pcs'}</span>
                                  </div>
                                ))}
                              </div>
                            </div>
                          </TableCell>
                        </TableRow>
                      )}
                    </React.Fragment>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Modal */}
      <PurchaseTallyModal
        open={isModalOpen}
        onClose={handleCloseModal}
        entry={editingEntry}
      />
    </div>
  );
}