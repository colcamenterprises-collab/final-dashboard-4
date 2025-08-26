import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { format } from "date-fns";
import { Plus, DollarSign, Receipt, Search, Filter, TrendingUp } from "lucide-react";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import BankUploadCard from "@/components/BankUploadCard";
import { BankTransactionReview } from "@/components/BankTransactionReview";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { z } from "zod";

import { EXPENSE_TYPE_OPTIONS, SHOP_NAME_OPTIONS, ExpenseType, ShopName } from "@shared/expenseMappings";

const expenseFormSchema = z.object({
  description: z.string().min(1, "Description is required"),
  amount: z.string().min(1, "Amount is required").refine((val) => {
    const num = parseFloat(val);
    return !isNaN(num) && num > 0;
  }, "Amount must be a positive number"),
  typeOfExpense: z.nativeEnum(ExpenseType, { required_error: "Expense type is required" }),
  shopName: z.nativeEnum(ShopName).optional(),
  date: z.string().min(1, "Date is required"),
  paymentMethod: z.string().min(1, "Payment method is required"),
  supplier: z.string().optional(),
  items: z.string().optional(),
  notes: z.string().optional(),
});

type ExpenseFormData = z.infer<typeof expenseFormSchema>;

export function BusinessExpenses() {
  const { toast } = useToast();
  const [isAddExpenseOpen, setIsAddExpenseOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedMonth, setSelectedMonth] = useState("all");
  const [selectedCategory, setSelectedCategory] = useState("all");
  const [showBankReview, setShowBankReview] = useState(false);
  const [currentBatchId, setCurrentBatchId] = useState<string | null>(null);

  // Fetch business expenses only (DIRECT source)
  const { data: expenses = [], isLoading } = useQuery({
    queryKey: ['/api/expensesV2', { source: 'DIRECT' }],
    queryFn: () => apiRequest('/api/expensesV2?source=DIRECT'),
  });

  const { data: categories = [] } = useQuery({
    queryKey: ['/api/expense-categories'],
    queryFn: () => apiRequest('/api/expense-categories'),
  });

  const { data: suppliers = [] } = useQuery({
    queryKey: ['/api/expense-suppliers'],
    queryFn: () => apiRequest('/api/expense-suppliers'),
  });

  const form = useForm<ExpenseFormData>({
    resolver: zodResolver(expenseFormSchema),
    defaultValues: {
      description: "",
      amount: "",
      typeOfExpense: undefined,
      shopName: undefined,
      date: format(new Date(), "yyyy-MM-dd"),
      paymentMethod: "Cash",
      supplier: "",
      items: "",
      notes: "",
    },
  });

  const createExpense = useMutation({
    mutationFn: (data: ExpenseFormData) => 
      apiRequest('/api/expensesV2', {
        method: 'POST',
        body: JSON.stringify({
          ...data,
          amount: parseFloat(data.amount),
          source: 'DIRECT', // Always set as business expense
          category: data.typeOfExpense, // Map typeOfExpense to category for backward compatibility
          supplier: data.shopName || data.supplier // Use shopName as primary, fallback to manual supplier
        }),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/expensesV2'] });
      toast({ title: "Success", description: "Business expense added successfully" });
      setIsAddExpenseOpen(false);
      form.reset();
    },
    onError: (error: any) => {
      toast({ 
        title: "Error", 
        description: error.message || "Failed to add expense",
        variant: "destructive" 
      });
    },
  });

  const filteredExpenses = expenses.filter((expense: any) => {
    const matchesSearch = expense.description?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         expense.supplier?.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesMonth = selectedMonth === "all" || !selectedMonth || expense.month === parseInt(selectedMonth);
    const matchesCategory = selectedCategory === "all" || !selectedCategory || expense.category === selectedCategory;
    
    return matchesSearch && matchesMonth && matchesCategory;
  });

  const totalAmount = filteredExpenses.reduce((sum: number, expense: any) => sum + (expense.amount || 0), 0);

  const handleUploadComplete = (result: any) => {
    setCurrentBatchId(result.batchId);
    setShowBankReview(true);
  };

  if (showBankReview && currentBatchId) {
    return (
      <BankTransactionReview 
        batchId={currentBatchId} 
        onClose={() => {
          setShowBankReview(false);
          setCurrentBatchId(null);
        }} 
      />
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center gap-6 mb-6">
        <p className="text-sm text-[var(--muted)]">
          Out-of-shift expenses (Makro, fuel, director costs)
        </p>
        <div className="flex gap-4 items-center">
          {/* Bank Upload Card */}
          <div className="w-80">
            <BankUploadCard 
              onImported={() => {
                setShowBankReview(true);
                queryClient.invalidateQueries({ queryKey: ['/api/expensesV2'] });
              }}
            />
          </div>
          
          <Dialog open={isAddExpenseOpen} onOpenChange={setIsAddExpenseOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="mr-2 h-4 w-4" />
                Add Business Expense
              </Button>
            </DialogTrigger>
          <DialogContent className="sm:max-w-[500px]">
            <DialogHeader>
              <DialogTitle>Add Business Expense</DialogTitle>
            </DialogHeader>
            <Form {...form}>
              <form onSubmit={form.handleSubmit((data) => createExpense.mutate(data))} className="space-y-4">
                <FormField
                  control={form.control}
                  name="description"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Description</FormLabel>
                      <FormControl>
                        <Input placeholder="Enter expense description" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                
                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="amount"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Amount (฿)</FormLabel>
                        <FormControl>
                          <Input type="number" step="0.01" placeholder="0.00" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  
                  <FormField
                    control={form.control}
                    name="typeOfExpense"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Type of Expense</FormLabel>
                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Select expense type" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {EXPENSE_TYPE_OPTIONS.map((type) => (
                              <SelectItem key={type} value={type}>{type}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
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
                  
                  <FormField
                    control={form.control}
                    name="shopName"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Shop Name</FormLabel>
                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Select shop" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {SHOP_NAME_OPTIONS.map((shop) => (
                              <SelectItem key={shop} value={shop}>{shop}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <FormField
                  control={form.control}
                  name="supplier"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Supplier (Optional)</FormLabel>
                      <FormControl>
                        <Input placeholder="Enter supplier name if different from shop" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="notes"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Notes (Optional)</FormLabel>
                      <FormControl>
                        <Textarea placeholder="Additional notes" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <Button type="submit" className="w-full" disabled={createExpense.isPending}>
                  {createExpense.isPending ? "Adding..." : "Add Business Expense"}
                </Button>
              </form>
            </Form>
          </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-6">
        <div className="card">
          <div className="card-inner">
            <div className="flex flex-row items-center justify-between space-y-0 pb-2">
              <h3 className="text-sm font-medium">Total Business Expenses</h3>
              <DollarSign className="h-4 w-4 text-muted-foreground" />
            </div>
            <div className="text-2xl font-bold">฿{totalAmount.toLocaleString()}</div>
          </div>
        </div>
        
        <div className="card">
          <div className="card-inner">
            <div className="flex flex-row items-center justify-between space-y-0 pb-2">
              <h3 className="text-sm font-medium">Total Entries</h3>
              <Receipt className="h-4 w-4 text-muted-foreground" />
            </div>
            <div className="text-2xl font-bold">{filteredExpenses.length}</div>
          </div>
        </div>
        
        <div className="card">
          <div className="card-inner">
            <div className="flex flex-row items-center justify-between space-y-0 pb-2">
              <h3 className="text-sm font-medium">Average Expense</h3>
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
            </div>
            <div className="text-2xl font-bold">
              ฿{filteredExpenses.length > 0 ? (totalAmount / filteredExpenses.length).toLocaleString() : '0'}
            </div>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="card mt-6">
        <div className="card-inner">
          <h3 className="text-[18px] font-semibold text-[var(--heading)] mb-4">Filters</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label htmlFor="search">Search</Label>
              <div className="relative">
                <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                <Input
                  id="search"
                  placeholder="Search expenses..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="month">Month</Label>
              <Select value={selectedMonth} onValueChange={setSelectedMonth}>
                <SelectTrigger>
                  <SelectValue placeholder="All months" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All months</SelectItem>
                  <SelectItem value="8">August 2025</SelectItem>
                  <SelectItem value="7">July 2025</SelectItem>
                  <SelectItem value="6">June 2025</SelectItem>
                </SelectContent>
              </Select>
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="category">Expense Type</Label>
              <Select value={selectedCategory} onValueChange={setSelectedCategory}>
                <SelectTrigger>
                  <SelectValue placeholder="All expense types" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All expense types</SelectItem>
                  {EXPENSE_TYPE_OPTIONS.map((type) => (
                    <SelectItem key={type} value={type}>{type}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>
      </div>

      {/* Expenses List */}
      <div className="card mt-6">
        <div className="card-inner">
          <h3 className="text-[18px] font-semibold text-[var(--heading)] mb-2">Business Expenses List</h3>
          <p className="text-xs text-[var(--muted)] mb-4">
            Showing {filteredExpenses.length} business expenses
          </p>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date</TableHead>
                <TableHead>Description</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Supplier</TableHead>
                <TableHead>Amount</TableHead>
                <TableHead>Source</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center">Loading...</TableCell>
                </TableRow>
              ) : filteredExpenses.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center">No business expenses found</TableCell>
                </TableRow>
              ) : (
                filteredExpenses.map((expense: any) => (
                  <TableRow key={expense.id}>
                    <TableCell>
                      {format(new Date(expense.date), "MMM dd, yyyy")}
                    </TableCell>
                    <TableCell className="font-medium">{expense.description}</TableCell>
                    <TableCell>{expense.typeOfExpense || expense.category}</TableCell>
                    <TableCell>{expense.supplier || '-'}</TableCell>
                    <TableCell>฿{expense.amount.toLocaleString()}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className="bg-blue-50 text-blue-700">
                        Business
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </div>
    </div>
  );
}