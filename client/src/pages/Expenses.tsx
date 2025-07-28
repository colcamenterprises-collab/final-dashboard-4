import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { format } from "date-fns";
import { Calendar, Plus, DollarSign, FileText, TrendingUp, Package } from "lucide-react";
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
import { useToast } from "@/hooks/use-toast";
import { insertExpenseSchema, insertExpenseSupplierSchema, insertExpenseCategorySchema } from "@shared/schema";
import type { Expense, ExpenseSupplier, ExpenseCategory } from "@shared/schema";
import { apiRequest, queryClient } from "@/lib/queryClient";

export default function Expenses() {
  const { toast } = useToast();
  const [isAddExpenseOpen, setIsAddExpenseOpen] = useState(false);
  const [isAddSupplierOpen, setIsAddSupplierOpen] = useState(false);
  const [isAddCategoryOpen, setIsAddCategoryOpen] = useState(false);

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

  const { data: monthlyStockSummary, isLoading: monthlyStockLoading, error: monthlyStockError } = useQuery<{
    rolls: Array<{ quantity: number; totalCost: string; date: string }>;
    drinks: Array<{ drinkName: string; quantity: number; totalCost: string; date: string }>;
    meat: Array<{ meatType: string; weight: string; totalCost: string; date: string }>;
  }>({
    queryKey: ["/api/stock-purchase/monthly-summary"],
  });

  // Debug logging
  console.log("Monthly stock summary data:", monthlyStockSummary);
  console.log("Monthly stock loading:", monthlyStockLoading);
  console.log("Monthly stock error:", monthlyStockError);

  // Forms
  const expenseForm = useForm({
    resolver: zodResolver(insertExpenseSchema),
    defaultValues: {
      date: new Date(),
      amount: "",
      category: "",
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
    mutationFn: (data: any) => apiRequest("/api/expenses", "POST", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/expenses"] });
      queryClient.invalidateQueries({ queryKey: ["/api/expenses/month-to-date"] });
      queryClient.invalidateQueries({ queryKey: ["/api/expenses/by-category"] });
      setIsAddExpenseOpen(false);
      expenseForm.reset();
      toast({
        title: "Success",
        description: "Expense added successfully",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to add expense",
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
        title: "Success",
        description: "Supplier added successfully",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to add supplier",
        variant: "destructive",
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
        title: "Success",
        description: "Category added successfully",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to add category",
        variant: "destructive",
      });
    },
  });

  const onSubmitExpense = (data: any) => {
    addExpenseMutation.mutate(data);
  };

  const onSubmitSupplier = (data: any) => {
    addSupplierMutation.mutate(data);
  };

  const onSubmitCategory = (data: any) => {
    addCategoryMutation.mutate(data);
  };

  const formatCurrency = (amount: string | number) => {
    const num = typeof amount === 'string' ? parseFloat(amount) : amount;
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(num);
  };

  const currentMonth = format(new Date(), 'MMMM yyyy');
  const mtdTotal = mtdData?.total || 0;

  return (
    <div className="space-y-6 p-4 md:p-6">
      {/* Header Section */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-gray-900 dark:text-white">
            Expenses
          </h1>
          <p className="text-gray-600 dark:text-gray-400 mt-1">
            Track and manage business expenses
          </p>
        </div>
        <Dialog open={isAddExpenseOpen} onOpenChange={setIsAddExpenseOpen}>
          <DialogTrigger asChild>
            <Button className="w-full sm:w-auto">
              <Plus className="h-4 w-4 mr-2" />
              Add Expense
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-md mx-auto max-h-screen overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Add New Expense</DialogTitle>
            </DialogHeader>
            <Form {...expenseForm}>
              <form onSubmit={expenseForm.handleSubmit(onSubmitExpense)} className="space-y-4">
                <FormField
                  control={expenseForm.control}
                  name="date"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Date</FormLabel>
                      <FormControl>
                        <Input
                          type="date"
                          value={field.value ? format(field.value, 'yyyy-MM-dd') : ''}
                          onChange={(e) => field.onChange(new Date(e.target.value))}
                        />
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
                        <Input
                          type="number"
                          step="0.01"
                          placeholder="0.00"
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={expenseForm.control}
                  name="category"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Category</FormLabel>
                      <FormControl>
                        <Select onValueChange={field.onChange} value={field.value}>
                          <SelectTrigger>
                            <SelectValue placeholder="Select category" />
                          </SelectTrigger>
                          <SelectContent>
                            {categories.map((category) => (
                              <SelectItem key={category.id} value={category.name}>
                                {category.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </FormControl>
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
                      <FormControl>
                        <Select onValueChange={field.onChange} value={field.value}>
                          <SelectTrigger>
                            <SelectValue placeholder="Select supplier" />
                          </SelectTrigger>
                          <SelectContent>
                            {suppliers.map((supplier) => (
                              <SelectItem key={supplier.id} value={supplier.name}>
                                {supplier.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={expenseForm.control}
                  name="items"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Items (Optional)</FormLabel>
                      <FormControl>
                        <Input
                          placeholder="Item description"
                          {...field}
                          value={field.value || ''}
                        />
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
                      <FormLabel>Notes (Optional)</FormLabel>
                      <FormControl>
                        <Textarea
                          placeholder="Additional notes"
                          {...field}
                          value={field.value || ''}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <div className="flex gap-2 pt-4">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setIsAddExpenseOpen(false)}
                    className="flex-1"
                  >
                    Cancel
                  </Button>
                  <Button
                    type="submit"
                    disabled={addExpenseMutation.isPending}
                    className="flex-1"
                  >
                    {addExpenseMutation.isPending ? "Adding..." : "Add Expense"}
                  </Button>
                </div>
              </form>
            </Form>
          </DialogContent>
        </Dialog>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Month to Date</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(mtdTotal)}</div>
            <p className="text-xs text-muted-foreground">{currentMonth}</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Expenses</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{expenses.length}</div>
            <p className="text-xs text-muted-foreground">All time</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Categories</CardTitle>
            <FileText className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{Object.keys(expensesByCategory).length}</div>
            <p className="text-xs text-muted-foreground">Active categories</p>
          </CardContent>
        </Card>
      </div>

      {/* Quick Actions */}
      <div className="flex flex-wrap gap-2">
        <Dialog open={isAddSupplierOpen} onOpenChange={setIsAddSupplierOpen}>
          <DialogTrigger asChild>
            <Button variant="outline" size="sm">
              <Plus className="h-4 w-4 mr-2" />
              Add Supplier
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-md mx-auto">
            <DialogHeader>
              <DialogTitle>Add New Supplier</DialogTitle>
            </DialogHeader>
            <Form {...supplierForm}>
              <form onSubmit={supplierForm.handleSubmit(onSubmitSupplier)} className="space-y-4">
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
                <div className="flex gap-2 pt-4">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setIsAddSupplierOpen(false)}
                    className="flex-1"
                  >
                    Cancel
                  </Button>
                  <Button
                    type="submit"
                    disabled={addSupplierMutation.isPending}
                    className="flex-1"
                  >
                    {addSupplierMutation.isPending ? "Adding..." : "Add Supplier"}
                  </Button>
                </div>
              </form>
            </Form>
          </DialogContent>
        </Dialog>

        <Dialog open={isAddCategoryOpen} onOpenChange={setIsAddCategoryOpen}>
          <DialogTrigger asChild>
            <Button variant="outline" size="sm">
              <Plus className="h-4 w-4 mr-2" />
              Add Category
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-md mx-auto">
            <DialogHeader>
              <DialogTitle>Add New Category</DialogTitle>
            </DialogHeader>
            <Form {...categoryForm}>
              <form onSubmit={categoryForm.handleSubmit(onSubmitCategory)} className="space-y-4">
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
                <div className="flex gap-2 pt-4">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setIsAddCategoryOpen(false)}
                    className="flex-1"
                  >
                    Cancel
                  </Button>
                  <Button
                    type="submit"
                    disabled={addCategoryMutation.isPending}
                    className="flex-1"
                  >
                    {addCategoryMutation.isPending ? "Adding..." : "Add Category"}
                  </Button>
                </div>
              </form>
            </Form>
          </DialogContent>
        </Dialog>
      </div>

      {/* Recent Expenses */}
      <Card>
        <CardHeader>
          <CardTitle>Recent Expenses</CardTitle>
          <CardDescription>
            Latest expense entries sorted by date
          </CardDescription>
        </CardHeader>
        <CardContent>
          {expensesLoading ? (
            <div className="space-y-3">
              {[...Array(5)].map((_, i) => (
                <div key={i} className="animate-pulse flex items-center justify-between p-3 bg-gray-100 dark:bg-gray-800 rounded">
                  <div className="space-y-2">
                    <div className="h-4 bg-gray-300 dark:bg-gray-600 rounded w-24"></div>
                    <div className="h-3 bg-gray-300 dark:bg-gray-600 rounded w-16"></div>
                  </div>
                  <div className="h-4 bg-gray-300 dark:bg-gray-600 rounded w-16"></div>
                </div>
              ))}
            </div>
          ) : expenses.length === 0 ? (
            <div className="text-center py-8 text-gray-500 dark:text-gray-400">
              <DollarSign className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>No expenses recorded yet</p>
              <p className="text-sm">Start by adding your first expense</p>
            </div>
          ) : (
            <div className="space-y-3">
              {expenses
                .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
                .slice(0, 10)
                .map((expense) => (
                  <div
                    key={expense.id}
                    className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-800 rounded-lg"
                  >
                    <div className="space-y-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <Badge variant="secondary">{expense.category}</Badge>
                        <span className="text-sm text-gray-600 dark:text-gray-400">
                          {expense.supplier}
                        </span>
                      </div>
                      <p className="text-sm text-gray-600 dark:text-gray-400">
                        {format(new Date(expense.date), 'MMM dd, yyyy')}
                      </p>
                      {expense.items && (
                        <p className="text-xs text-gray-500 dark:text-gray-500">
                          {expense.items}
                        </p>
                      )}
                    </div>
                    <div className="text-right">
                      <p className="font-semibold">{formatCurrency(expense.amount)}</p>
                    </div>
                  </div>
                ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Monthly Stock Purchases Summary - VISIBLE SECTION */}
      <Card className="border-2 border-blue-200 bg-blue-50 dark:bg-blue-900/20 dark:border-blue-800">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-blue-900 dark:text-blue-100">
            <Package className="h-5 w-5" />
            📦 Monthly Stock Purchases (NEW FEATURE)
          </CardTitle>
          <CardDescription className="text-blue-700 dark:text-blue-200">
            Summary of drinks, rolls, and meat lodged this month from Stock Count section
          </CardDescription>
        </CardHeader>
        <CardContent>
          {monthlyStockLoading ? (
            <div className="animate-pulse space-y-4">
              <div className="h-4 bg-gray-300 dark:bg-gray-600 rounded w-1/4"></div>
              <div className="space-y-2">
                {[...Array(3)].map((_, i) => (
                  <div key={i} className="h-3 bg-gray-300 dark:bg-gray-600 rounded"></div>
                ))}
              </div>
            </div>
          ) : monthlyStockError ? (
            <div className="text-center py-8 text-red-500">
              <p>Error loading monthly stock summary</p>
              <p className="text-sm">{monthlyStockError.message}</p>
            </div>
          ) : !monthlyStockSummary ? (
            <div className="text-center py-8 text-gray-500">
              <p>No monthly stock data available</p>
            </div>
          ) : (
            <div className="space-y-6">
              {/* Rolls Section */}
              <div>
                <h4 className="font-semibold text-sm mb-3 text-gray-900 dark:text-gray-100">Rolls Purchased</h4>
                {monthlyStockSummary.rolls.length === 0 ? (
                  <p className="text-sm text-gray-500 dark:text-gray-400">No rolls purchased this month</p>
                ) : (
                  <div className="space-y-2">
                    {monthlyStockSummary.rolls.map((roll, index) => (
                      <div key={index} className="flex justify-between items-center p-2 bg-gray-50 dark:bg-gray-800 rounded">
                        <div>
                          <span className="text-sm font-medium">{roll.quantity} rolls</span>
                          <span className="text-xs text-gray-500 dark:text-gray-400 block">
                            {format(new Date(roll.date), 'MMM dd, yyyy')}
                          </span>
                        </div>
                        <span className="text-sm font-semibold">{formatCurrency(roll.totalCost)}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <Separator />

              {/* Drinks Section */}
              <div>
                <h4 className="font-semibold text-sm mb-3 text-gray-900 dark:text-gray-100">Drinks Purchased</h4>
                {monthlyStockSummary.drinks.length === 0 ? (
                  <p className="text-sm text-gray-500 dark:text-gray-400">No drinks purchased this month</p>
                ) : (
                  <div className="space-y-2">
                    {monthlyStockSummary.drinks.map((drink, index) => (
                      <div key={index} className="flex justify-between items-center p-2 bg-gray-50 dark:bg-gray-800 rounded">
                        <div>
                          <span className="text-sm font-medium">{drink.drinkName}</span>
                          <span className="text-xs text-gray-500 dark:text-gray-400 block">
                            {drink.quantity} units • {format(new Date(drink.date), 'MMM dd, yyyy')}
                          </span>
                        </div>
                        <span className="text-sm font-semibold">{formatCurrency(drink.totalCost)}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <Separator />

              {/* Meat Section */}
              <div>
                <h4 className="font-semibold text-sm mb-3 text-gray-900 dark:text-gray-100">Meat Purchased</h4>
                {monthlyStockSummary.meat.length === 0 ? (
                  <p className="text-sm text-gray-500 dark:text-gray-400">No meat purchased this month</p>
                ) : (
                  <div className="space-y-2">
                    {monthlyStockSummary.meat.map((meat, index) => (
                      <div key={index} className="flex justify-between items-center p-2 bg-gray-50 dark:bg-gray-800 rounded">
                        <div>
                          <span className="text-sm font-medium">{meat.meatType}</span>
                          <span className="text-xs text-gray-500 dark:text-gray-400 block">
                            {meat.weight}kg • {format(new Date(meat.date), 'MMM dd, yyyy')}
                          </span>
                        </div>
                        <span className="text-sm font-semibold">{formatCurrency(meat.totalCost)}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}