import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { format } from "date-fns";
import { Calendar, Plus, DollarSign, FileText, TrendingUp, Receipt, Upload, Search, Filter, Download } from "lucide-react";
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

// Create a form-specific schema that uses string for date (from HTML input)
const expenseFormSchema = insertExpenseSchema.extend({
  date: z.string().min(1, "Date is required")
});

type ExpenseFormData = z.infer<typeof expenseFormSchema>;

interface BankStatement {
  id: number;
  filename: string;
  fileSize: number;
  mimeType: string;
  uploadDate: string;
  analysisStatus: string;
  aiAnalysis: any;
}

function ExpensesMerged() {
  const { toast } = useToast();
  const [isAddExpenseOpen, setIsAddExpenseOpen] = useState(false);
  const [isAddSupplierOpen, setIsAddSupplierOpen] = useState(false);
  const [isAddCategoryOpen, setIsAddCategoryOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedMonth, setSelectedMonth] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("");

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
      const transformedData = {
        ...data,
        date: new Date(data.date), // Convert string to Date object
      };
      return apiRequest("/api/expenses", "POST", transformedData);
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
    mutationFn: (data: any) => apiRequest("/api/expense-suppliers", "POST", data),
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
    mutationFn: (data: any) => apiRequest("/api/expense-categories", "POST", data),
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

  const onSubmit = (data: ExpenseFormData) => {
    addExpenseMutation.mutate(data);
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
        <Dialog open={isAddExpenseOpen} onOpenChange={setIsAddExpenseOpen}>
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
                          <Input type="number" step="0.01" placeholder="0.00" {...field} />
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
                            <SelectItem value="check">Check</SelectItem>
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

      {/* Summary Cards */}
      <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Expenses</CardTitle>
            <DollarSign className="w-4 h-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">฿{totalExpenses.toLocaleString()}</div>
            <p className="text-xs text-muted-foreground">{filteredExpenses.length} expenses</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Categories</CardTitle>
            <FileText className="w-4 h-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{Object.keys(expensesByCategory).length}</div>
            <p className="text-xs text-muted-foreground">Active categories</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Bank Statements</CardTitle>
            <Receipt className="w-4 h-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{bankStatements.length}</div>
            <p className="text-xs text-muted-foreground">Uploaded statements</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Month to Date</CardTitle>
            <TrendingUp className="w-4 h-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">฿{mtdData?.total?.toLocaleString() || 0}</div>
            <p className="text-xs text-muted-foreground">This month</p>
          </CardContent>
        </Card>
      </div>

      {/* Filters and Search */}
      <Card>
        <CardHeader>
          <CardTitle>Search and Filter</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
            <div className="flex-1">
              <div className="relative">
                <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search expenses..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>
            <div className="flex flex-col gap-2 sm:flex-row sm:gap-2">
              <Select value={selectedMonth} onValueChange={setSelectedMonth}>
                <SelectTrigger className="w-full sm:w-[150px]">
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
                <SelectTrigger className="w-full sm:w-[150px]">
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
        </CardContent>
      </Card>

      {/* Bank Statement Upload */}
      <Card>
        <CardHeader>
          <CardTitle>Bank Statement Analysis</CardTitle>
          <CardDescription>
            Upload bank statements for AI-powered expense analysis and matching
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
            <Input
              type="file"
              accept=".pdf,.csv,.xlsx"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) {
                  uploadBankStatementMutation.mutate(file);
                }
              }}
              className="flex-1"
            />
            <Button disabled={uploadBankStatementMutation.isPending}>
              <Upload className="w-4 h-4 mr-2" />
              {uploadBankStatementMutation.isPending ? "Uploading..." : "Upload"}
            </Button>
          </div>
          {bankStatements.length > 0 && (
            <div className="mt-4">
              <h4 className="font-semibold mb-2">Uploaded Statements</h4>
              <div className="space-y-2">
                {bankStatements.map((statement: any) => (
                  <div key={statement.id} className="flex items-center justify-between p-2 border rounded">
                    <div>
                      <p className="font-medium">{statement.filename}</p>
                      <p className="text-sm text-muted-foreground">
                        {new Date(statement.uploadDate).toLocaleDateString()} • {statement.analysisStatus}
                      </p>
                    </div>
                    <Badge variant={statement.analysisStatus === 'completed' ? 'default' : 'secondary'}>
                      {statement.analysisStatus}
                    </Badge>
                  </div>
                ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Expense List */}
      <Card>
        <CardHeader>
          <CardTitle>Expense List</CardTitle>
          <CardDescription>
            All recorded expenses with search and filter capabilities
          </CardDescription>
        </CardHeader>
        <CardContent>
          {filteredExpenses.length === 0 ? (
            <div className="text-center py-6">
              <p className="text-muted-foreground">No expenses found.</p>
            </div>
          ) : (
            <>
              {/* Desktop Table */}
              <div className="hidden md:block overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Date</TableHead>
                      <TableHead>Description</TableHead>
                      <TableHead>Category</TableHead>
                      <TableHead>Amount</TableHead>
                      <TableHead>Payment Method</TableHead>
                      <TableHead>Supplier</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredExpenses.map((expense: any) => (
                      <TableRow key={expense.id}>
                        <TableCell>
                          {format(new Date(expense.date), "MMM dd, yyyy")}
                        </TableCell>
                        <TableCell className="font-medium">{expense.description}</TableCell>
                        <TableCell>
                          <Badge variant="outline">{expense.category}</Badge>
                        </TableCell>
                        <TableCell className="font-mono">฿{parseFloat(expense.amount).toLocaleString()}</TableCell>
                        <TableCell>
                          <Badge variant="secondary">{expense.paymentMethod}</Badge>
                        </TableCell>
                        <TableCell>{expense.supplier || "—"}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              {/* Mobile Cards */}
              <div className="md:hidden space-y-4">
                {filteredExpenses.map((expense: any) => (
                  <Card key={expense.id}>
                    <CardContent className="p-4">
                      <div className="flex justify-between items-start mb-2">
                        <div className="flex-1">
                          <h4 className="font-medium text-sm">{expense.description}</h4>
                          <p className="text-xs text-muted-foreground">
                            {format(new Date(expense.date), "MMM dd, yyyy")}
                          </p>
                        </div>
                        <div className="text-right">
                          <div className="font-mono font-bold text-sm">
                            ฿{parseFloat(expense.amount).toLocaleString()}
                          </div>
                        </div>
                      </div>
                      <div className="flex flex-wrap gap-2 mt-3">
                        <Badge variant="outline" className="text-xs">
                          {expense.category}
                        </Badge>
                        <Badge variant="secondary" className="text-xs">
                          {expense.paymentMethod}
                        </Badge>
                        {expense.supplier && (
                          <Badge variant="outline" className="text-xs">
                            {expense.supplier}
                          </Badge>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* Quick Actions */}
      <div className="flex flex-col gap-2 sm:flex-row">
        <Dialog open={isAddSupplierOpen} onOpenChange={setIsAddSupplierOpen}>
          <DialogTrigger asChild>
            <Button variant="outline">
              <Plus className="w-4 h-4 mr-2" />
              Add Supplier
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Add New Supplier</DialogTitle>
            </DialogHeader>
            <Form {...supplierForm}>
              <form onSubmit={supplierForm.handleSubmit((data) => addSupplierMutation.mutate(data))} className="space-y-4">
                <FormField
                  control={supplierForm.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Supplier Name</FormLabel>
                      <FormControl>
                        <Input placeholder="Enter supplier name" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <div className="flex justify-end gap-2">
                  <Button type="button" variant="outline" onClick={() => setIsAddSupplierOpen(false)}>
                    Cancel
                  </Button>
                  <Button type="submit" disabled={addSupplierMutation.isPending}>
                    {addSupplierMutation.isPending ? "Adding..." : "Add Supplier"}
                  </Button>
                </div>
              </form>
            </Form>
          </DialogContent>
        </Dialog>

        <Dialog open={isAddCategoryOpen} onOpenChange={setIsAddCategoryOpen}>
          <DialogTrigger asChild>
            <Button variant="outline">
              <Plus className="w-4 h-4 mr-2" />
              Add Category
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Add New Category</DialogTitle>
            </DialogHeader>
            <Form {...categoryForm}>
              <form onSubmit={categoryForm.handleSubmit((data) => addCategoryMutation.mutate(data))} className="space-y-4">
                <FormField
                  control={categoryForm.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Category Name</FormLabel>
                      <FormControl>
                        <Input placeholder="Enter category name" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <div className="flex justify-end gap-2">
                  <Button type="button" variant="outline" onClick={() => setIsAddCategoryOpen(false)}>
                    Cancel
                  </Button>
                  <Button type="submit" disabled={addCategoryMutation.isPending}>
                    {addCategoryMutation.isPending ? "Adding..." : "Add Category"}
                  </Button>
                </div>
              </form>
            </Form>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}

export default ExpensesMerged;