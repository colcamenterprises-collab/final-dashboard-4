import { useEffect, useState } from 'react';
import { Card, CardHeader, CardContent, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableRow, TableCell, TableHead, TableHeader } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { FileText, Eye, Trash2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import type { DailyStockSales } from "@shared/schema";

const PastForms = () => {
  const [forms, setForms] = useState<DailyStockSales[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedForm, setSelectedForm] = useState<DailyStockSales | null>(null);
  const { toast } = useToast();

  useEffect(() => {
    fetchForms();
  }, []);

  const fetchForms = async () => {
    try {
      const response = await fetch('/api/daily-stock-sales');
      const data = await response.json();
      setForms(data);
    } catch (error) {
      console.error('Error fetching forms:', error);
      toast({
        title: "Error",
        description: "Failed to load past forms",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const deleteForm = async (id: number) => {
    if (!confirm('Are you sure you want to delete this form?')) return;
    
    try {
      const response = await fetch(`/api/daily-stock-sales/${id}`, {
        method: 'DELETE',
      });
      
      if (response.ok) {
        setForms(forms.filter(f => f.id !== id));
        if (selectedForm?.id === id) {
          setSelectedForm(null);
        }
        toast({
          title: "Success",
          description: "Form deleted successfully",
        });
      } else {
        throw new Error('Failed to delete');
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to delete form",
        variant: "destructive",
      });
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  const formatCurrency = (amount: string | number) => {
    const num = typeof amount === 'string' ? parseFloat(amount) : amount;
    return `฿${num.toLocaleString()}`;
  };

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Loading...</CardTitle>
        </CardHeader>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Past Forms ({forms.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {forms.length === 0 ? (
            <p className="text-gray-500 text-center py-8">No forms found.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Completed By</TableHead>
                  <TableHead>Shift Type</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Total Sales</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {forms.map((form) => (
                  <TableRow key={form.id}>
                    <TableCell>{formatDate(form.shiftDate)}</TableCell>
                    <TableCell>{form.completedBy}</TableCell>
                    <TableCell className="capitalize">{form.shiftType}</TableCell>
                    <TableCell>
                      <Badge variant={form.isDraft ? "secondary" : "default"}>
                        {form.isDraft ? 'Draft' : 'Complete'}
                      </Badge>
                    </TableCell>
                    <TableCell>{formatCurrency(form.totalSales || 0)}</TableCell>
                    <TableCell>
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => setSelectedForm(form)}
                        >
                          <Eye className="h-4 w-4" />
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => deleteForm(form.id)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Form Details Modal */}
      {selectedForm && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <span>Form Details - {formatDate(selectedForm.shiftDate)}</span>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setSelectedForm(null)}
              >
                Close
              </Button>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div>
                <strong>Completed By:</strong>
                <p>{selectedForm.completedBy}</p>
              </div>
              <div>
                <strong>Shift Type:</strong>
                <p className="capitalize">{selectedForm.shiftType}</p>
              </div>
              <div>
                <strong>Status:</strong>
                <Badge variant={selectedForm.isDraft ? "secondary" : "default"}>
                  {selectedForm.isDraft ? 'Draft' : 'Complete'}
                </Badge>
              </div>
              <div>
                <strong>Date Created:</strong>
                <p>{formatDate(selectedForm.createdAt)}</p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Sales Information */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Sales Information</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  <div className="flex justify-between">
                    <span>Grab Sales:</span>
                    <span>{formatCurrency(selectedForm.grabSales || 0)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>FoodPanda Sales:</span>
                    <span>{formatCurrency(selectedForm.foodPandaSales || 0)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Aroi Dee Sales:</span>
                    <span>{formatCurrency(selectedForm.aroiDeeSales || 0)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>QR Scan Sales:</span>
                    <span>{formatCurrency(selectedForm.qrScanSales || 0)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Cash Sales:</span>
                    <span>{formatCurrency(selectedForm.cashSales || 0)}</span>
                  </div>
                  <div className="flex justify-between border-t pt-2 font-semibold">
                    <span>Total Sales:</span>
                    <span>{formatCurrency(selectedForm.totalSales || 0)}</span>
                  </div>
                </CardContent>
              </Card>

              {/* Cash & Expenses */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Cash & Expenses</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  <div className="flex justify-between">
                    <span>Starting Cash:</span>
                    <span>{formatCurrency(selectedForm.startingCash || 0)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Ending Cash:</span>
                    <span>{formatCurrency(selectedForm.endingCash || 0)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Salary/Wages:</span>
                    <span>{formatCurrency(selectedForm.salaryWages || 0)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Shopping:</span>
                    <span>{formatCurrency(selectedForm.shopping || 0)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Gas Expense:</span>
                    <span>{formatCurrency(selectedForm.gasExpense || 0)}</span>
                  </div>
                  <div className="flex justify-between border-t pt-2 font-semibold">
                    <span>Total Expenses:</span>
                    <span>{formatCurrency(selectedForm.totalExpenses || 0)}</span>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Stock Counts */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Stock Information</CardTitle>
              </CardHeader>
              <CardContent className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div>
                  <strong>Burger Buns:</strong>
                  <p>{selectedForm.burgerBunsStock || 0}</p>
                </div>
                <div>
                  <strong>Rolls Ordered:</strong>
                  <p>{selectedForm.rollsOrderedCount || 0}</p>
                </div>
                <div>
                  <strong>Meat Weight:</strong>
                  <p>{selectedForm.meatWeight || 0} kg</p>
                </div>
                <div>
                  <strong>Drink Stock:</strong>
                  <p>{selectedForm.drinkStockCount || 0}</p>
                </div>
              </CardContent>
            </Card>

            {/* Notes */}
            {selectedForm.expenseDescription && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Notes</CardTitle>
                </CardHeader>
                <CardContent>
                  <p>{selectedForm.expenseDescription}</p>
                </CardContent>
              </Card>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default PastForms;