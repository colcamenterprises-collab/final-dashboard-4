import { useState, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { format } from "date-fns";
import { 
  Card, CardContent, CardDescription, CardHeader, CardTitle 
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { 
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue 
} from "@/components/ui/select";
import { 
  Form, FormControl, FormField, FormItem, FormLabel, FormMessage 
} from "@/components/ui/form";
import { 
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow 
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { 
  Calendar, DollarSign, FileText, Upload, Search, 
  Plus, TrendingUp, Receipt, AlertCircle 
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { insertExpenseSchema } from "@shared/schema";

const expenseFormSchema = insertExpenseSchema.extend({
  date: z.date(),
  amount: z.string().min(1, "Amount is required")
});

type ExpenseFormData = z.infer<typeof expenseFormSchema>;

interface Expense {
  id: number;
  description: string;
  amount: string;
  category: string;
  date: string;
  paymentMethod: string;
  supplier: string | null;
  items: string | null;
  notes: string | null;
  month: number;
  year: number;
  createdAt: string;
}

interface BankStatement {
  id: number;
  filename: string;
  fileSize: number;
  mimeType: string;
  uploadDate: string;
  analysisStatus: string;
  aiAnalysis: any;
}

interface ExpenseCategory {
  id: number;
  name: string;
  isDefault: boolean;
}

interface ExpenseSupplier {
  id: number;
  name: string;
  isDefault: boolean;
}

export default function EnhancedExpenses() {
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedMonth, setSelectedMonth] = useState<string>("");
  const [selectedCategory, setSelectedCategory] = useState<string>("");
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: expenses = [], isLoading: expensesLoading } = useQuery({
    queryKey: ["/api/expensesV2"],
  });

  const { data: monthToDateTotal = { total: "0" } } = useQuery({
    queryKey: ["/api/expensesV2/month-to-date"],
  });

  const { data: expensesByCategory = {} } = useQuery({
    queryKey: ["/api/expensesV2/by-category"],
  });

  const { data: categories = [] } = useQuery({
    queryKey: ["/api/expense-categories"],
  });

  const { data: suppliers = [] } = useQuery({
    queryKey: ["/api/expense-suppliers"],
  });

  const { data: bankStatements = [] } = useQuery({
    queryKey: ["/api/bank-statements"],
  });

  const form = useForm<ExpenseFormData>({
    resolver: zodResolver(expenseFormSchema),
    defaultValues: {
      description: "",
      amount: "",
      category: "",
      date: new Date(),
      paymentMethod: "cash",
      supplier: "",
      items: "",
      notes: "",
    },
  });

  const createExpenseMutation = useMutation({
    mutationFn: async (data: ExpenseFormData) => {
      const expenseData = {
        ...data,
        date: data.date.toISOString(),
        month: data.date.getMonth() + 1,
        year: data.date.getFullYear(),
      };
      return apiRequest("/api/expensesV2", {
        method: "POST",
        body: JSON.stringify(expenseData),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/expensesV2"] });
      queryClient.invalidateQueries({ queryKey: ["/api/expensesV2/month-to-date"] });
      queryClient.invalidateQueries({ queryKey: ["/api/expensesV2/by-category"] });
      form.reset();
      toast({
        title: "Success",
        description: "Expense created successfully",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to create expense",
        variant: "destructive",
      });
    },
  });

  const uploadBankStatementMutation = useMutation({
    mutationFn: async (file: File) => {
      const base64Data = await new Promise<string>((resolve) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result as string);
        reader.readAsDataURL(file);
      });

      return apiRequest("/api/bank-statements", {
        method: "POST",
        body: JSON.stringify({
          filename: file.name,
          fileData: base64Data,
          fileSize: file.size,
          mimeType: file.type,
        }),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/bank-statements"] });
      toast({
        title: "Success",
        description: "Bank statement uploaded successfully. AI analysis in progress...",
      });
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to upload bank statement",
        variant: "destructive",
      });
    },
  });

  const onSubmit = (data: ExpenseFormData) => {
    createExpenseMutation.mutate(data);
  };

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      uploadBankStatementMutation.mutate(file);
    }
  };

  const filteredExpenses = expenses.filter((expense: Expense) => {
    const matchesSearch = expense.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         expense.supplier?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         expense.category.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesMonth = !selectedMonth || selectedMonth === "all-months" || 
                        `${expense.year}-${expense.month.toString().padStart(2, '0')}` === selectedMonth;
    
    const matchesCategory = !selectedCategory || selectedCategory === "all-categories" || expense.category === selectedCategory;
    
    return matchesSearch && matchesMonth && matchesCategory;
  });

  const totalExpenses = filteredExpenses.reduce((sum, expense) => sum + parseFloat(expense.amount), 0);

  const months = Array.from(new Set(
    expenses.map((expense: Expense) => `${expense.year}-${expense.month.toString().padStart(2, '0')}`)
  )).sort().reverse();

  const uniqueCategories = Array.from(new Set(expenses.map((expense: Expense) => expense.category)));

  return (
    <div className="container mx-auto p-4 space-y-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-3xl font-bold">Enhanced Expenses</h1>
          <p className="text-muted-foreground">
            Comprehensive expense tracking with AI-powered bank statement analysis
          </p>
        </div>
        
        <div className="flex items-center gap-2">
          <Button
            onClick={() => fileInputRef.current?.click()}
            variant="outline"
            className="flex items-center gap-2"
          >
            <Upload className="w-4 h-4" />
            Upload Bank Statement
          </Button>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*,.pdf"
            onChange={handleFileUpload}
            className="hidden"
          />
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Month to Date</CardTitle>
            <DollarSign className="w-4 h-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">฿{parseFloat(monthToDateTotal.total).toLocaleString()}</div>
            <p className="text-xs text-muted-foreground">Total expenses this month</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Filtered Total</CardTitle>
            <TrendingUp className="w-4 h-4 text-muted-foreground" />
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
            <p className="text-xs text-muted-foreground">Uploaded & analyzed</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Add Expense Form */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Plus className="w-5 h-5" />
              Add New Expense
            </CardTitle>
            <CardDescription>
              Record a new business expense with detailed information
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                <div className="grid gap-4 md:grid-cols-2">
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
                            {categories.map((category: ExpenseCategory) => (
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
                    control={form.control}
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
                            <SelectItem value="bank_transfer">Bank Transfer</SelectItem>
                            <SelectItem value="card">Card</SelectItem>
                            <SelectItem value="prompta">PromptPay</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
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
                            {suppliers.map((supplier: ExpenseSupplier) => (
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

                  <FormField
                    control={form.control}
                    name="date"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Date</FormLabel>
                        <FormControl>
                          <Input
                            type="date"
                            value={field.value ? format(field.value, "yyyy-MM-dd") : ""}
                            onChange={(e) => field.onChange(new Date(e.target.value))}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <FormField
                  control={form.control}
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
                  control={form.control}
                  name="notes"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Notes</FormLabel>
                      <FormControl>
                        <Textarea placeholder="Additional notes..." {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <Button
                  type="submit"
                  className="w-full"
                  disabled={createExpenseMutation.isPending}
                >
                  {createExpenseMutation.isPending ? "Creating..." : "Add Expense"}
                </Button>
              </form>
            </Form>
          </CardContent>
        </Card>

        {/* Bank Statement Analysis */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Receipt className="w-5 h-5" />
              Bank Statement Analysis
            </CardTitle>
            <CardDescription>
              AI-powered analysis of uploaded bank statements
            </CardDescription>
          </CardHeader>
          <CardContent>
            {bankStatements.length === 0 ? (
              <div className="text-center py-6">
                <Upload className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
                <p className="text-muted-foreground">No bank statements uploaded yet</p>
                <p className="text-sm text-muted-foreground">Upload a statement to get AI analysis</p>
              </div>
            ) : (
              <div className="space-y-4">
                {bankStatements.map((statement: BankStatement) => (
                  <div key={statement.id} className="p-4 border rounded-lg">
                    <div className="flex items-center justify-between mb-2">
                      <h4 className="font-medium">{statement.filename}</h4>
                      <Badge variant={statement.analysisStatus === 'completed' ? 'default' : 'secondary'}>
                        {statement.analysisStatus}
                      </Badge>
                    </div>
                    <p className="text-sm text-muted-foreground mb-2">
                      Uploaded: {format(new Date(statement.uploadDate), "PPP")}
                    </p>
                    
                    {statement.aiAnalysis && !statement.aiAnalysis.error && (
                      <div className="mt-3 p-3 bg-muted rounded">
                        <p className="text-sm font-medium">AI Analysis:</p>
                        <p className="text-sm">{statement.aiAnalysis.summary}</p>
                        {statement.aiAnalysis.totalAmount && (
                          <p className="text-sm mt-1">
                            <span className="font-medium">Total Amount:</span> ฿{statement.aiAnalysis.totalAmount}
                          </p>
                        )}
                        {statement.aiAnalysis.transactionCount && (
                          <p className="text-sm">
                            <span className="font-medium">Transactions:</span> {statement.aiAnalysis.transactionCount}
                          </p>
                        )}
                      </div>
                    )}

                    {statement.aiAnalysis?.error && (
                      <div className="mt-3 p-3 bg-destructive/10 rounded flex items-center gap-2">
                        <AlertCircle className="w-4 h-4 text-destructive" />
                        <p className="text-sm text-destructive">Analysis failed</p>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Search className="w-5 h-5" />
            Search & Filter Expenses
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-3">
            <div className="space-y-2">
              <Label htmlFor="search">Search</Label>
              <Input
                id="search"
                placeholder="Search expenses..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="month">Month</Label>
              <Select value={selectedMonth} onValueChange={setSelectedMonth}>
                <SelectTrigger>
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
            </div>

            <div className="space-y-2">
              <Label htmlFor="category">Category</Label>
              <Select value={selectedCategory} onValueChange={setSelectedCategory}>
                <SelectTrigger>
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

      {/* Expenses Table */}
      <Card>
        <CardHeader>
          <CardTitle>Expense Records</CardTitle>
          <CardDescription>
            {filteredExpenses.length} expenses • Total: ฿{totalExpenses.toLocaleString()}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {expensesLoading ? (
            <div className="text-center py-6">Loading expenses...</div>
          ) : filteredExpenses.length === 0 ? (
            <div className="text-center py-6">
              <FileText className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
              <p className="text-muted-foreground">No expenses found</p>
              <p className="text-sm text-muted-foreground">Try adjusting your filters</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Description</TableHead>
                    <TableHead>Category</TableHead>
                    <TableHead>Supplier</TableHead>
                    <TableHead>Amount</TableHead>
                    <TableHead>Payment</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredExpenses.map((expense: Expense) => (
                    <TableRow key={expense.id}>
                      <TableCell>
                        {format(new Date(expense.date), "MMM d, yyyy")}
                      </TableCell>
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
                      <TableCell className="font-medium">
                        ฿{parseFloat(expense.amount).toLocaleString()}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">{expense.paymentMethod}</Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}