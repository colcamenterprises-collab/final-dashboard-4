import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { format, startOfMonth, endOfMonth, startOfYear, endOfYear, subMonths, subYears } from "date-fns";
import { Calendar, Plus, DollarSign, FileText, TrendingUp, Receipt, Upload, Search, Filter, Download, BarChart3 } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";
import { insertExpenseSchema, insertExpenseSupplierSchema, insertExpenseCategorySchema } from "@shared/schema";
import type { Expense, ExpenseSupplier, ExpenseCategory } from "@shared/schema";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { z } from "zod";

// BankStatement interface for type safety
interface BankStatement {
  id: number;
  filename: string;
  fileSize: number;
  mimeType: string;
  uploadDate: string;
  analysisStatus: string;
  aiAnalysis: any;
}

// Create a fresh form schema without the problematic month/year fields
const expenseFormSchema = z.object({
  description: z.string().min(1, "Description is required"),
  amount: z.string().min(1, "Amount is required").refine((val) => {
    const num = parseFloat(val);
    return !isNaN(num) && num > 0;
  }, "Amount must be a positive number"),
  category: z.string().min(1, "Category is required"),
  date: z.string().min(1, "Date is required"),
  paymentMethod: z.string().min(1, "Payment method is required"),
  supplier: z.string().optional(),
  items: z.string().optional(),
  notes: z.string().optional(),
});

type ExpenseFormData = z.infer<typeof expenseFormSchema>;

function ExpensesMerged() {
  const { toast } = useToast();
  const [editingExpense, setEditingExpense] = useState<number | null>(null);
  const [editForm, setEditForm] = useState<Partial<Expense>>({});
  const [isAddExpenseOpen, setIsAddExpenseOpen] = useState(false);
  const [isAddSupplierOpen, setIsAddSupplierOpen] = useState(false);
  const [isAddCategoryOpen, setIsAddCategoryOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedMonth, setSelectedMonth] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("");
  const [reportGenerating, setReportGenerating] = useState(false);

  // Queries
  const { data: expenses = [], isLoading: expensesLoading } = useQuery<Expense[]>({
    queryKey: ["/api/expenses"],
  });

  const { data: suppliers = [], isLoading: suppliersLoading } = useQuery<ExpenseSupplier[]>({
    queryKey: ["/api/expense-suppliers"],
  });

  const { data: categories = [], isLoading: categoriesLoading } = useQuery<ExpenseCategory[]>({
    queryKey: ["/api/expense-categories"],
  });

  const { data: mtdData } = useQuery<{ total: number }>({
    queryKey: ["/api/expenses/month-to-date"],
  });

  const { data: expensesByCategory = {} } = useQuery<Record<string, number>>({
    queryKey: ["/api/expenses/by-category"],
  });

  const { data: bankStatements = [] } = useQuery<BankStatement[]>({
    queryKey: ["/api/bank-statements"],
  });

  // Forms
  const expenseForm = useForm<ExpenseFormData>({
    resolver: zodResolver(expenseFormSchema),
    mode: 'onChange',
    defaultValues: {
      description: "",
      amount: "",
      category: "",
      date: format(new Date(), "yyyy-MM-dd"),
      paymentMethod: "",
      supplier: "",
      items: "",
      notes: "",
    },
  });

  const supplierForm = useForm({
    resolver: zodResolver(insertExpenseSupplierSchema),
    defaultValues: {
      name: "",
      isDefault: false,
    },
  });

  const categoryForm = useForm({
    resolver: zodResolver(insertExpenseCategorySchema),
    defaultValues: {
      name: "",
      isDefault: false,
    },
  });

  // Mutations
  const addExpenseMutation = useMutation({
    mutationFn: (data: ExpenseFormData) => {
      console.log("Frontend mutation data:", data);
      // Keep date as string - server will handle conversion
      return apiRequest("POST", "/api/expenses", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/expenses"] });
      queryClient.invalidateQueries({ queryKey: ["/api/expenses/month-to-date"] });
      queryClient.invalidateQueries({ queryKey: ["/api/expenses/by-category"] });
      setIsAddExpenseOpen(false);
      expenseForm.reset();
      toast({
        title: "Expense added successfully",
        description: "The expense has been recorded.",
      });
    },
    onError: (error: any) => {
      console.error("Error adding expense:", error);
      toast({
        title: "Error adding expense",
        description: error.message || "Failed to add expense. Please try again.",
        variant: "destructive",
      });
    },
  });

  const addSupplierMutation = useMutation({
    mutationFn: (data: any) => apiRequest("POST", "/api/expense-suppliers", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/expense-suppliers"] });
      setIsAddSupplierOpen(false);
      supplierForm.reset();
      toast({
        title: "Supplier added successfully",
        description: "The supplier has been added to your list.",
      });
    },
  });

  const addCategoryMutation = useMutation({
    mutationFn: (data: any) => apiRequest("POST", "/api/expense-categories", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/expense-categories"] });
      setIsAddCategoryOpen(false);
      categoryForm.reset();
      toast({
        title: "Category added successfully",
        description: "The category has been added to your list.",
      });
    },
  });

  const uploadBankStatementMutation = useMutation({
    mutationFn: (file: File) => {
      const formData = new FormData();
      formData.append("file", file);
      return fetch("/api/bank-statements/upload", {
        method: "POST",
        body: formData,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/bank-statements"] });
      toast({
        title: "Bank statement uploaded",
        description: "The statement is being analyzed with AI.",
      });
    },
  });

  const updateExpenseMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: Partial<Expense> }) => {
      return apiRequest(`/api/expenses/${id}`, {
        method: "PUT",
        body: JSON.stringify(data),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/expenses"] });
      queryClient.invalidateQueries({ queryKey: ["/api/expenses/month-to-date"] });
      queryClient.invalidateQueries({ queryKey: ["/api/expenses/by-category"] });
      setEditingExpense(null);
      setEditForm({});
      toast({
        title: "Success",
        description: "Expense has been updated successfully.",
      });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: "Failed to update expense. Please try again.",
        variant: "destructive",
      });
    },
  });

  const deleteExpenseMutation = useMutation({
    mutationFn: (id: number) => {
      return apiRequest(`/api/expenses/${id}`, {
        method: "DELETE",
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/expenses"] });
      queryClient.invalidateQueries({ queryKey: ["/api/expenses/month-to-date"] });
      queryClient.invalidateQueries({ queryKey: ["/api/expenses/by-category"] });
      toast({
        title: "Success",
        description: "Expense has been deleted successfully.",
      });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: "Failed to delete expense. Please try again.",
        variant: "destructive",
      });
    },
  });

  const onSubmit = (data: ExpenseFormData) => {
    console.log("Form data being submitted:", data);
    console.log("Form errors:", expenseForm.formState.errors);
    addExpenseMutation.mutate(data);
  };

  // Force clear form validation state
  const handleOpenChange = (open: boolean) => {
    if (open) {
      // Reset form when opening dialog
      expenseForm.reset({
        description: "",
        amount: "",
        category: "",
        date: format(new Date(), "yyyy-MM-dd"),
        paymentMethod: "",
        supplier: "",
        items: "",
        notes: "",
      });
      expenseForm.clearErrors();
    }
    setIsAddExpenseOpen(open);
  };

  // Report generation function
  const generateExpenseReport = async (reportType: 'monthly' | 'quarterly' | 'annual' | 'custom') => {
    setReportGenerating(true);
    
    try {
      let startDate: Date;
      let endDate: Date;
      let reportTitle: string;
      
      const now = new Date();
      
      switch (reportType) {
        case 'monthly':
          startDate = startOfMonth(now);
          endDate = endOfMonth(now);
          reportTitle = `Monthly Expense Report - ${format(now, 'MMMM yyyy')}`;
          break;
        case 'quarterly':
          const quarterStart = new Date(now.getFullYear(), Math.floor(now.getMonth() / 3) * 3, 1);
          startDate = quarterStart;
          endDate = endOfMonth(new Date(quarterStart.getFullYear(), quarterStart.getMonth() + 2, 1));
          reportTitle = `Quarterly Expense Report - Q${Math.floor(now.getMonth() / 3) + 1} ${now.getFullYear()}`;
          break;
        case 'annual':
          startDate = startOfYear(now);
          endDate = endOfYear(now);
          reportTitle = `Annual Expense Report - ${now.getFullYear()}`;
          break;
        default:
          startDate = startOfMonth(now);
          endDate = endOfMonth(now);
          reportTitle = `Expense Report - ${format(now, 'MMMM yyyy')}`;
      }

      // Filter expenses by date range
      const reportExpenses = expenses.filter((expense: any) => {
        const expenseDate = new Date(expense.date);
        return expenseDate >= startDate && expenseDate <= endDate;
      });

      // Calculate summary statistics
      const totalAmount = reportExpenses.reduce((sum: number, expense: any) => sum + parseFloat(expense.amount), 0);
      const categorySummary = reportExpenses.reduce((acc: any, expense: any) => {
        acc[expense.category] = (acc[expense.category] || 0) + parseFloat(expense.amount);
        return acc;
      }, {});

      const supplierSummary = reportExpenses.reduce((acc: any, expense: any) => {
        const supplier = expense.supplier || 'No Supplier';
        acc[supplier] = (acc[supplier] || 0) + parseFloat(expense.amount);
        return acc;
      }, {});

      const paymentMethodSummary = reportExpenses.reduce((acc: any, expense: any) => {
        acc[expense.paymentMethod] = (acc[expense.paymentMethod] || 0) + parseFloat(expense.amount);
        return acc;
      }, {});

      // Generate HTML report
      const reportHTML = generateReportHTML({
        title: reportTitle,
        period: `${format(startDate, 'MMM dd, yyyy')} - ${format(endDate, 'MMM dd, yyyy')}`,
        totalAmount,
        expenseCount: reportExpenses.length,
        expenses: reportExpenses,
        categorySummary,
        supplierSummary,
        paymentMethodSummary,
        generatedAt: new Date()
      });

      // Create and download the report
      const blob = new Blob([reportHTML], { type: 'text/html' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `${reportTitle.replace(/\s+/g, '_')}_${format(now, 'yyyyMMdd')}.html`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      toast({
        title: "Report Generated",
        description: `${reportTitle} has been downloaded successfully.`,
      });
    } catch (error) {
      console.error('Error generating report:', error);
      toast({
        title: "Error",
        description: "Failed to generate expense report. Please try again.",
        variant: "destructive",
      });
    } finally {
      setReportGenerating(false);
    }
  };

  // HTML report template
  const generateReportHTML = (data: any) => {
    return `
    <!DOCTYPE html>
    <html>
    <head>
      <title>${data.title}</title>
      <style>
        body { font-family: Arial, sans-serif; margin: 40px; background: #f5f5f5; }
        .container { max-width: 800px; margin: 0 auto; background: white; padding: 40px; border-radius: 8px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
        .header { text-align: center; margin-bottom: 40px; border-bottom: 2px solid #e5e5e5; padding-bottom: 20px; }
        .title { color: #333; font-size: 28px; margin-bottom: 10px; }
        .period { color: #666; font-size: 16px; }
        .summary { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 20px; margin-bottom: 40px; }
        .summary-card { background: #f8f9fa; padding: 20px; border-radius: 8px; text-align: center; border-left: 4px solid #007bff; }
        .summary-value { font-size: 24px; font-weight: bold; color: #007bff; margin-bottom: 5px; }
        .summary-label { color: #666; font-size: 14px; }
        .section { margin-bottom: 40px; }
        .section-title { font-size: 20px; font-weight: bold; margin-bottom: 20px; color: #333; border-bottom: 1px solid #ddd; padding-bottom: 10px; }
        table { width: 100%; border-collapse: collapse; margin-bottom: 20px; }
        th, td { padding: 12px; text-align: left; border-bottom: 1px solid #ddd; }
        th { background-color: #f8f9fa; font-weight: bold; color: #333; }
        tr:hover { background-color: #f8f9fa; }
        .amount { font-weight: bold; color: #d63384; }
        .category-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(250px, 1fr)); gap: 15px; }
        .category-item { background: #f8f9fa; padding: 15px; border-radius: 8px; display: flex; justify-content: space-between; align-items: center; }
        .footer { text-align: center; margin-top: 40px; padding-top: 20px; border-top: 1px solid #ddd; color: #666; font-size: 14px; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1 class="title">${data.title}</h1>
          <p class="period">${data.period}</p>
        </div>
        
        <div class="summary">
          <div class="summary-card">
            <div class="summary-value">฿${data.totalAmount.toLocaleString()}</div>
            <div class="summary-label">Total Expenses</div>
          </div>
          <div class="summary-card">
            <div class="summary-value">${data.expenseCount}</div>
            <div class="summary-label">Total Transactions</div>
          </div>
          <div class="summary-card">
            <div class="summary-value">฿${(data.totalAmount / data.expenseCount || 0).toFixed(2)}</div>
            <div class="summary-label">Average Transaction</div>
          </div>
          <div class="summary-card">
            <div class="summary-value">${Object.keys(data.categorySummary).length}</div>
            <div class="summary-label">Categories Used</div>
          </div>
        </div>

        <div class="section">
          <h2 class="section-title">Expense Breakdown by Category</h2>
          <div class="category-grid">
            ${Object.entries(data.categorySummary)
              .sort(([,a], [,b]) => (b as number) - (a as number))
              .map(([category, amount]) => `
                <div class="category-item">
                  <span>${category}</span>
                  <span class="amount">฿${(amount as number).toLocaleString()}</span>
                </div>
              `).join('')}
          </div>
        </div>

        <div class="section">
          <h2 class="section-title">Payment Method Summary</h2>
          <div class="category-grid">
            ${Object.entries(data.paymentMethodSummary)
              .sort(([,a], [,b]) => (b as number) - (a as number))
              .map(([method, amount]) => `
                <div class="category-item">
                  <span>${method}</span>
                  <span class="amount">฿${(amount as number).toLocaleString()}</span>
                </div>
              `).join('')}
          </div>
        </div>

        <div class="section">
          <h2 class="section-title">Detailed Expense List</h2>
          <table>
            <thead>
              <tr>
                <th>Date</th>
                <th>Description</th>
                <th>Category</th>
                <th>Supplier</th>
                <th>Payment Method</th>
                <th>Amount</th>
              </tr>
            </thead>
            <tbody>
              ${data.expenses.map((expense: any) => `
                <tr>
                  <td>${format(new Date(expense.date), 'MMM dd, yyyy')}</td>
                  <td>${expense.description}</td>
                  <td>${expense.category}</td>
                  <td>${expense.supplier || '—'}</td>
                  <td>${expense.paymentMethod}</td>
                  <td class="amount">฿${parseFloat(expense.amount).toLocaleString()}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>

        <div class="footer">
          <p>Report generated on ${format(data.generatedAt, 'PPpp')}</p>
          <p>Restaurant Management Dashboard - Expense Report</p>
        </div>
      </div>
    </body>
    </html>
    `;
  };

  // Filter expenses based on search and filters
  const filteredExpenses = expenses.filter((expense: any) => {
    const matchesSearch = expense.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         expense.supplier?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         expense.category.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesMonth = !selectedMonth || selectedMonth === "all-months" || 
                        `${expense.year}-${expense.month.toString().padStart(2, '0')}` === selectedMonth;
    
    const matchesCategory = !selectedCategory || selectedCategory === "all-categories" || expense.category === selectedCategory;
    
    return matchesSearch && matchesMonth && matchesCategory;
  });

  const totalExpenses = filteredExpenses.reduce((sum: number, expense: any) => sum + parseFloat(expense.amount), 0);

  const months = Array.from(new Set(
    expenses.map((expense: any) => `${expense.year}-${expense.month.toString().padStart(2, '0')}`)
  )).sort().reverse();

  const uniqueCategories = Array.from(new Set(expenses.map((expense: any) => expense.category)));

  if (expensesLoading || suppliersLoading || categoriesLoading) {
    return <div className="flex justify-center items-center h-64">Loading...</div>;
  }

  return (
    <div className="container mx-auto p-4 space-y-6 max-w-7xl">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold">Expense Management</h1>
          <p className="text-sm sm:text-base text-muted-foreground">
            Comprehensive expense tracking with AI-powered bank statement analysis
          </p>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row sm:gap-3">
          <div className="flex gap-2">
            <Button 
              variant="outline" 
              size="sm"
              onClick={() => generateExpenseReport('monthly')}
              disabled={reportGenerating}
              className="text-xs"
            >
              <BarChart3 className="w-3 h-3 mr-1" />
              {reportGenerating ? 'Generating...' : 'Monthly'}
            </Button>
            <Button 
              variant="outline" 
              size="sm"
              onClick={() => generateExpenseReport('quarterly')}
              disabled={reportGenerating}
              className="text-xs"
            >
              <BarChart3 className="w-3 h-3 mr-1" />
              {reportGenerating ? 'Generating...' : 'Quarterly'}
            </Button>
            <Button 
              variant="outline" 
              size="sm"
              onClick={() => generateExpenseReport('annual')}
              disabled={reportGenerating}
              className="text-xs"
            >
              <BarChart3 className="w-3 h-3 mr-1" />
              {reportGenerating ? 'Generating...' : 'Annual'}
            </Button>
          </div>
          <Dialog open={isAddExpenseOpen} onOpenChange={handleOpenChange}>
            <DialogTrigger asChild>
              <Button className="w-full sm:w-auto">
                <Plus className="w-4 h-4 mr-2" />
                Add Expense
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>Add New Expense</DialogTitle>
              </DialogHeader>
              <Form {...expenseForm}>
                <form onSubmit={expenseForm.handleSubmit(onSubmit)} className="space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <FormField
                      control={expenseForm.control}
                      name="description"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Description</FormLabel>
                          <FormControl>
                            <Input placeholder="Expense description" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={expenseForm.control}
                      name="amount"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Amount</FormLabel>
                          <FormControl>
                            <Input type="number" step="0.01" min="0" placeholder="0.00" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <FormField
                      control={expenseForm.control}
                      name="category"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Category</FormLabel>
                          <Select onValueChange={field.onChange} defaultValue={field.value}>
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue placeholder="Select category" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              {categories.map((category: any) => (
                                <SelectItem key={category.id} value={category.name}>
                                  {category.name}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={expenseForm.control}
                      name="date"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Date</FormLabel>
                          <FormControl>
                            <Input type="date" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <FormField
                      control={expenseForm.control}
                      name="paymentMethod"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Payment Method</FormLabel>
                          <Select onValueChange={field.onChange} defaultValue={field.value}>
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue placeholder="Select payment method" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              <SelectItem value="cash">Cash</SelectItem>
                              <SelectItem value="card">Card</SelectItem>
                              <SelectItem value="transfer">Bank Transfer</SelectItem>
                              <SelectItem value="qr">QR Code</SelectItem>
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={expenseForm.control}
                      name="supplier"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Supplier</FormLabel>
                          <Select onValueChange={field.onChange} defaultValue={field.value}>
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue placeholder="Select supplier" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              {suppliers.map((supplier: any) => (
                                <SelectItem key={supplier.id} value={supplier.name}>
                                  {supplier.name}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                  <FormField
                    control={expenseForm.control}
                    name="items"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Items</FormLabel>
                        <FormControl>
                          <Input placeholder="List of items purchased" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={expenseForm.control}
                    name="notes"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Notes</FormLabel>
                        <FormControl>
                          <Textarea placeholder="Additional notes" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <div className="flex justify-end gap-2">
                    <Button type="button" variant="outline" onClick={() => setIsAddExpenseOpen(false)}>
                      Cancel
                    </Button>
                    <Button type="submit" disabled={addExpenseMutation.isPending}>
                      {addExpenseMutation.isPending ? "Adding..." : "Add Expense"}
                    </Button>
                  </div>
                </form>
              </Form>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Overview Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Month to Date</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-xl sm:text-2xl font-bold">
              ฿{mtdData?.total ? parseFloat(mtdData.total.toString()).toLocaleString() : '0'}
            </div>
            <p className="text-xs text-muted-foreground">Total expenses this month</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Transactions</CardTitle>
            <Receipt className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-xl sm:text-2xl font-bold">{filteredExpenses.length}</div>
            <p className="text-xs text-muted-foreground">Expense entries recorded</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Categories</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-xl sm:text-2xl font-bold">{Object.keys(expensesByCategory).length}</div>
            <p className="text-xs text-muted-foreground">Active expense categories</p>
          </CardContent>
        </Card>

        <Card className="border-blue-200 bg-blue-50">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-blue-700">Quick Reports</CardTitle>
            <BarChart3 className="h-4 w-4 text-blue-600" />
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <Button 
                variant="ghost" 
                size="sm" 
                className="w-full justify-start text-blue-700 hover:text-blue-800 hover:bg-blue-100 h-7 text-xs"
                onClick={() => generateExpenseReport('monthly')}
                disabled={reportGenerating}
              >
                <Download className="w-3 h-3 mr-2" />
                {reportGenerating ? 'Generating...' : 'This Month'}
              </Button>
              <Button 
                variant="ghost" 
                size="sm" 
                className="w-full justify-start text-blue-700 hover:text-blue-800 hover:bg-blue-100 h-7 text-xs"
                onClick={() => generateExpenseReport('annual')}
                disabled={reportGenerating}
              >
                <Download className="w-3 h-3 mr-2" />
                {reportGenerating ? 'Generating...' : 'This Year'}
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Expenses Table */}
      <Card>
        <CardHeader>
          <CardTitle>Expense Records</CardTitle>
          <CardDescription>
            Manage and track all expense transactions
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {/* Search and Filters */}
            <div className="flex flex-col gap-4">
              <div className="relative">
                <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search expenses..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
              
              <div className="flex flex-col gap-2 sm:flex-row sm:gap-2">
                <Select value={selectedMonth} onValueChange={setSelectedMonth}>
                  <SelectTrigger className="w-full sm:w-[180px]">
                    <SelectValue placeholder="All months" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all-months">All months</SelectItem>
                    {months.map((month) => (
                      <SelectItem key={month} value={month}>
                        {format(new Date(month + "-01"), "MMMM yyyy")}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                <Select value={selectedCategory} onValueChange={setSelectedCategory}>
                  <SelectTrigger className="w-full sm:w-[180px]">
                    <SelectValue placeholder="All categories" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all-categories">All categories</SelectItem>
                    {uniqueCategories.map((category) => (
                      <SelectItem key={category} value={category}>
                        {category}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Summary */}
            <div className="flex justify-between items-center text-sm text-muted-foreground">
              <span>Showing {filteredExpenses.length} expenses</span>
              <span className="font-semibold">Total: ฿{totalExpenses.toLocaleString()}</span>
            </div>

            {/* Responsive Table/Cards */}
            <div className="space-y-4">
              {/* Desktop Table */}
              <div className="hidden md:block border rounded-md">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Date</TableHead>
                      <TableHead>Description</TableHead>
                      <TableHead>Category</TableHead>
                      <TableHead>Supplier</TableHead>
                      <TableHead>Payment</TableHead>
                      <TableHead className="text-right">Amount</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredExpenses.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                          No expenses found. Start by adding your first expense.
                        </TableCell>
                      </TableRow>
                    ) : (
                      filteredExpenses.map((expense: any) => (
                        <TableRow key={expense.id}>
                          {editingExpense === expense.id ? (
                            <>
                              <TableCell>
                                <Input
                                  type="date"
                                  value={editForm.date ? format(new Date(editForm.date), 'yyyy-MM-dd') : format(new Date(expense.date), 'yyyy-MM-dd')}
                                  onChange={(e) => setEditForm({...editForm, date: e.target.value})}
                                  className="w-full"
                                />
                              </TableCell>
                              <TableCell>
                                <Input
                                  value={editForm.description || expense.description}
                                  onChange={(e) => setEditForm({...editForm, description: e.target.value})}
                                  className="w-full"
                                />
                              </TableCell>
                              <TableCell>
                                <Select 
                                  value={editForm.category || expense.category}
                                  onValueChange={(value) => setEditForm({...editForm, category: value})}
                                >
                                  <SelectTrigger className="w-full">
                                    <SelectValue />
                                  </SelectTrigger>
                                  <SelectContent>
                                    {categories.map((category: any) => (
                                      <SelectItem key={category.id} value={category.name}>
                                        {category.name}
                                      </SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                              </TableCell>
                              <TableCell>
                                <Select 
                                  value={editForm.supplier || expense.supplier || ""}
                                  onValueChange={(value) => setEditForm({...editForm, supplier: value})}
                                >
                                  <SelectTrigger className="w-full">
                                    <SelectValue />
                                  </SelectTrigger>
                                  <SelectContent>
                                    {suppliers.map((supplier: any) => (
                                      <SelectItem key={supplier.id} value={supplier.name}>
                                        {supplier.name}
                                      </SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                              </TableCell>
                              <TableCell>
                                <Select 
                                  value={editForm.paymentMethod || expense.paymentMethod}
                                  onValueChange={(value) => setEditForm({...editForm, paymentMethod: value})}
                                >
                                  <SelectTrigger className="w-full">
                                    <SelectValue />
                                  </SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value="Cash">Cash</SelectItem>
                                    <SelectItem value="Card">Card</SelectItem>
                                    <SelectItem value="Bank Transfer">Bank Transfer</SelectItem>
                                    <SelectItem value="QR Code">QR Code</SelectItem>
                                  </SelectContent>
                                </Select>
                              </TableCell>
                              <TableCell>
                                <Input
                                  type="number"
                                  min="0"
                                  step="0.01"
                                  value={editForm.amount || expense.amount}
                                  onChange={(e) => setEditForm({...editForm, amount: e.target.value})}
                                  className="w-full text-right"
                                />
                              </TableCell>
                              <TableCell className="text-right">
                                <div className="flex gap-1">
                                  <Button
                                    size="sm"
                                    onClick={() => {
                                      updateExpenseMutation.mutate({
                                        id: expense.id,
                                        data: {
                                          ...editForm,
                                          date: editForm.date || expense.date,
                                          description: editForm.description || expense.description,
                                          category: editForm.category || expense.category,
                                          supplier: editForm.supplier || expense.supplier,
                                          paymentMethod: editForm.paymentMethod || expense.paymentMethod,
                                          amount: editForm.amount || expense.amount
                                        }
                                      });
                                    }}
                                  >
                                    Save
                                  </Button>
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={() => {
                                      setEditingExpense(null);
                                      setEditForm({});
                                    }}
                                  >
                                    Cancel
                                  </Button>
                                </div>
                              </TableCell>
                            </>
                          ) : (
                            <>
                              <TableCell>{format(new Date(expense.date), "MMM dd, yyyy")}</TableCell>
                              <TableCell>
                                <div>
                                  <p className="font-medium">{expense.description}</p>
                                  {expense.items && (
                                    <p className="text-sm text-muted-foreground">{expense.items}</p>
                                  )}
                                </div>
                              </TableCell>
                              <TableCell>
                                <Badge variant="secondary">{expense.category}</Badge>
                              </TableCell>
                              <TableCell>{expense.supplier || "—"}</TableCell>
                              <TableCell>
                                <Badge variant="outline">{expense.paymentMethod}</Badge>
                              </TableCell>
                              <TableCell className="text-right font-medium">
                                ฿{parseFloat(expense.amount).toLocaleString()}
                              </TableCell>
                              <TableCell className="text-right">
                                <div className="flex gap-1">
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={() => {
                                      setEditingExpense(expense.id);
                                      setEditForm({
                                        date: expense.date,
                                        description: expense.description,
                                        category: expense.category,
                                        supplier: expense.supplier,
                                        paymentMethod: expense.paymentMethod,
                                        amount: expense.amount
                                      });
                                    }}
                                  >
                                    Edit
                                  </Button>
                                  <Button
                                    size="sm"
                                    variant="destructive"
                                    onClick={() => {
                                      if (confirm('Are you sure you want to delete this expense?')) {
                                        deleteExpenseMutation.mutate(expense.id);
                                      }
                                    }}
                                  >
                                    Delete
                                  </Button>
                                </div>
                              </TableCell>
                            </>
                          )}
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>

              {/* Mobile Cards */}
              <div className="md:hidden space-y-3">
                {filteredExpenses.length === 0 ? (
                  <Card>
                    <CardContent className="text-center py-8 text-muted-foreground">
                      No expenses found. Start by adding your first expense.
                    </CardContent>
                  </Card>
                ) : (
                  filteredExpenses.map((expense: any) => (
                    <Card key={expense.id} className="p-4">
                      <div className="space-y-3">
                        <div className="flex justify-between items-start">
                          <div className="flex-1">
                            <h3 className="font-medium text-sm leading-tight">{expense.description}</h3>
                            <p className="text-xs text-muted-foreground mt-1">
                              {format(new Date(expense.date), "MMM dd, yyyy")}
                            </p>
                          </div>
                          <div className="text-right">
                            <p className="font-bold text-lg">฿{parseFloat(expense.amount).toLocaleString()}</p>
                          </div>
                        </div>
                        
                        {expense.items && (
                          <p className="text-xs text-muted-foreground border-l-2 border-gray-200 pl-2">
                            {expense.items}
                          </p>
                        )}
                        
                        <div className="flex flex-wrap gap-2 items-center text-xs">
                          <Badge variant="secondary" className="text-xs">{expense.category}</Badge>
                          <Badge variant="outline" className="text-xs">{expense.paymentMethod}</Badge>
                          {expense.supplier && (
                            <span className="text-muted-foreground">• {expense.supplier}</span>
                          )}
                        </div>
                        
                        <div className="flex gap-2 pt-2">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => {
                              setEditingExpense(expense.id);
                              setEditForm({
                                date: expense.date,
                                description: expense.description,
                                category: expense.category,
                                supplier: expense.supplier,
                                paymentMethod: expense.paymentMethod,
                                amount: expense.amount
                              });
                            }}
                            className="flex-1"
                          >
                            Edit
                          </Button>
                          <Button
                            size="sm"
                            variant="destructive"
                            onClick={() => {
                              if (confirm('Are you sure you want to delete this expense?')) {
                                deleteExpenseMutation.mutate(expense.id);
                              }
                            }}
                            className="flex-1"
                          >
                            Delete
                          </Button>
                        </div>
                      </div>
                    </Card>
                  ))
                )}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

export default ExpensesMerged;