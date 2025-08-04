import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQueryClient, useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { 
  Calculator, 
  Package, 
  User, 
  ShoppingCart, 
  DollarSign,
  ChefHat,
  Refrigerator,
  Coffee,
  ClipboardList,
  TrendingUp,
  Snowflake,
  Plus,
  Trash2
} from "lucide-react";
import { z } from "zod";

// Clean form schema - correct order and fields only
const formSchema = z.object({
  // 1. Shift Information
  completedBy: z.string().min(1, "Staff name is required"),
  shiftType: z.enum(['Evening', 'Morning'], { errorMap: () => ({ message: "Please select a shift type" }) }),
  shiftDate: z.string().min(1, "Shift date is required"),
  
  // 2. Sales Information  
  grabSales: z.coerce.number().optional().default(0),
  aroiDeeSales: z.coerce.number().optional().default(0),
  qrScanSales: z.coerce.number().optional().default(0),
  cashSales: z.coerce.number().optional().default(0),
  totalSales: z.coerce.number().optional().default(0),
  
  // 3. Wages & Staff Payments
  wageEntries: z.array(z.object({ 
    staffName: z.string().min(1, "Staff name required"), 
    amount: z.coerce.number().min(0).optional().default(0), 
    type: z.enum(['wages', 'overtime', 'other'], { errorMap: () => ({ message: "Select wage type" }) })
  })).optional().default([]),
  
  // 4. Shopping & Expenses
  shoppingEntries: z.array(z.object({ 
    item: z.string().min(1, "Item name required"), 
    amount: z.coerce.number().min(0).optional().default(0), 
    shop: z.string().optional().default(""),
    customShop: z.string().optional()
  })).optional().default([]),
  totalExpenses: z.coerce.number().optional().default(0),
  
  // 5. Cash Management
  startingCash: z.coerce.number().optional().default(0),
  endingCash: z.coerce.number().optional().default(0),
  bankedAmount: z.coerce.number().optional().default(0),
  
  // 6. Drink Stock
  drinkStock: z.record(z.coerce.number().optional().default(0)).optional().default({}),
  
  // 7. Fresh Food Stock
  freshFood: z.record(z.coerce.number().optional().default(0)).optional().default({}),
  
  // 8. Frozen Food
  frozenFood: z.record(z.coerce.number().optional().default(0)).optional().default({}),
  
  // 9. Shelf Items
  shelfItems: z.record(z.coerce.number().optional().default(0)).optional().default({}),
  
  // 10. Kitchen Items
  kitchenItems: z.record(z.coerce.number().optional().default(0)).optional().default({}),
  
  // 11. Packaging Items
  packagingItems: z.record(z.coerce.number().optional().default(0)).optional().default({}),
  
  // Key tracking fields
  burgerBunsStock: z.coerce.number().optional().default(0),
  meatWeight: z.coerce.number().optional().default(0),
  rollsOrderedCount: z.coerce.number().optional().default(0),
  
  isDraft: z.boolean().optional().default(false),
});

type FormData = z.infer<typeof formSchema>;

// Fresh Food items from CSV
const FRESH_FOOD_ITEMS = [
  'Salad', 'Tomatos', 'White Cabbage', 'Purple Cabbage', 'Onions', 
  'Milk', 'Butter'
];

// Frozen Food items from CSV
const FROZEN_FOOD_ITEMS = [
  'Sweet Potato Fries', 'Chicken Nuggets', 'Chicken Fillets', 'French Fries'
];

// Shelf Items from CSV
const SHELF_ITEMS = [
  'Ketchup', 'Mayonnaise', 'Mustard', 'BBQ Sauce', 'Cheese Slices', 'Cooking Oil'
];

// Kitchen Items from CSV
const KITCHEN_ITEMS = [
  'Paper Towels', 'Aluminum Foil', 'Plastic Gloves', 'Kitchen Cleaner', 'Sanitizer'
];

// Packaging items from CSV
const PACKAGING_ITEMS = [
  'French Fries Box', 'Small Bags', 'Large Bags', 'Paper Bags', 'Loaded Fries Boxes', 'Labels', 'Cutlery Sets'
];

// Drink items from CSV
const DRINK_ITEMS = [
  'Coke', 'Coke Zero', 'Sprite', 'Schweppes Manow', 'Fanta Orange', 'Fanta Strawberry', 'Soda Water', 'Water', 'Kids Orange', 'Kids Apple'
];

// Shop options
const SHOP_OPTIONS = [
  'Makro', '7/11', 'Supercheap', 'Lotus', 'Big C', 'Printing Shop', 'Bakery', 'GO Wholesale', 'Gas Supply', '*Other'
];

export default function DailyStockSalesNew() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [activeNavTab, setActiveNavTab] = useState('daily-sales-stock');
  const [activeTab, setActiveTab] = useState('new-form');

  const form = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      completedBy: "",
      shiftType: "Evening",
      shiftDate: new Date().toISOString().split('T')[0],
      grabSales: 0,
      aroiDeeSales: 0,
      qrScanSales: 0,
      cashSales: 0,
      totalSales: 0,
      wageEntries: [],
      shoppingEntries: [],
      totalExpenses: 0,
      startingCash: 0,
      endingCash: 0,
      bankedAmount: 0,
      burgerBunsStock: 0,
      meatWeight: 0,
      rollsOrderedCount: 0,
      freshFood: {},
      frozenFood: {},
      shelfItems: {},
      drinkStock: {},
      kitchenItems: {},
      packagingItems: {},
      isDraft: false
    }
  });

  // Watch form values for calculations
  const watchedValues = form.watch();
  
  // Auto-calculate total sales
  useEffect(() => {
    const total = (watchedValues.grabSales || 0) + 
                  (watchedValues.aroiDeeSales || 0) + 
                  (watchedValues.qrScanSales || 0) + 
                  (watchedValues.cashSales || 0);
    form.setValue('totalSales', total);
  }, [watchedValues.grabSales, watchedValues.aroiDeeSales, watchedValues.qrScanSales, watchedValues.cashSales, form]);

  // Auto-calculate total expenses
  useEffect(() => {
    const shoppingTotal = (watchedValues.shoppingEntries || []).reduce((sum, entry) => sum + (entry.amount || 0), 0);
    form.setValue('totalExpenses', shoppingTotal);
  }, [watchedValues.shoppingEntries, form]);

  const createMutation = useMutation({
    mutationFn: async (data: FormData) => {
      return apiRequest('/api/daily-stock-sales', 'POST', data);
    },
    onSuccess: () => {
      toast({
        title: "Success",
        description: "Form submitted successfully"
      });
      form.reset();
      queryClient.invalidateQueries({ queryKey: ['/api/daily-stock-sales'] });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: "Failed to submit form",
        variant: "destructive"
      });
    }
  });

  const onSubmit = (data: FormData) => {
    createMutation.mutate(data);
  };

  return (
    <div style={{ 
      minHeight: '100vh', 
      backgroundColor: '#ffffff', 
      fontFamily: "'Poppins', sans-serif", 
      padding: '40px',
      color: '#1a1a1a'
    }}>
      <div style={{ maxWidth: '1200px', margin: '0 auto' }}>
        
        {/* Breadcrumb */}
        <div style={{ fontSize: '13px', color: '#666', marginBottom: '10px' }}>
          Home / Operations & Sales / Daily Sales & Stock
        </div>

        {/* Page Title */}
        <h1 style={{ 
          fontSize: '28px', 
          fontWeight: '700', 
          margin: '0 0 20px', 
          color: '#1a1a1a' 
        }}>
          Operations & Sales
        </h1>

        {/* Navigation Tabs */}
        <div style={{ 
          display: 'flex', 
          gap: '20px', 
          marginBottom: '30px', 
          borderBottom: '1px solid #ddd', 
          paddingBottom: '10px' 
        }}>
          <button
            onClick={() => setActiveNavTab('daily-sales-stock')}
            style={{
              fontSize: '16px',
              padding: '8px 0',
              cursor: 'pointer',
              textDecoration: 'none',
              color: '#1a1a1a',
              borderBottom: activeNavTab === 'daily-sales-stock' ? '3px solid #000' : '3px solid transparent',
              fontWeight: activeNavTab === 'daily-sales-stock' ? '600' : '400',
              background: 'none',
              border: 'none'
            }}
          >
            Daily Sales & Stock
          </button>
          <button
            onClick={() => window.location.href = '/purchasing'}
            style={{
              fontSize: '16px',
              padding: '8px 0',
              cursor: 'pointer',
              textDecoration: 'none',
              color: '#1a1a1a',
              borderBottom: '3px solid transparent',
              fontWeight: '400',
              background: 'none',
              border: 'none'
            }}
          >
            Purchasing
          </button>
          <button
            onClick={() => window.location.href = '/expenses'}
            style={{
              fontSize: '16px',
              padding: '8px 0',
              cursor: 'pointer',
              textDecoration: 'none',
              color: '#1a1a1a',
              borderBottom: '3px solid transparent',
              fontWeight: '400',
              background: 'none',
              border: 'none'
            }}
          >
            Expenses
          </button>
          <button
            onClick={() => window.location.href = '/reports-analysis'}
            style={{
              fontSize: '16px',
              padding: '8px 0',
              cursor: 'pointer',
              textDecoration: 'none',
              color: '#1a1a1a',
              borderBottom: '3px solid transparent',
              fontWeight: '400',
              background: 'none',
              border: 'none'
            }}
          >
            Reports & Analysis
          </button>
        </div>

        {/* Content Section */}
        <div>
          <div style={{ 
            fontSize: '22px', 
            fontWeight: '600', 
            margin: '0 0 10px' 
          }}>
            Daily Sales & Stock Form
          </div>
          <div style={{ 
            fontSize: '14px', 
            color: '#444', 
            marginBottom: '30px' 
          }}>
            Complete daily shift reporting with full inventory tracking.
          </div>
          
          <hr style={{ 
            border: 'none', 
            borderTop: '1px solid #ddd', 
            margin: '40px 0' 
          }} />

          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
              
              {/* 1. Shift Information */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <User className="h-5 w-5" />
                    1. Shift Information
                  </CardTitle>
                </CardHeader>
                <CardContent className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <FormField
                    control={form.control}
                    name="completedBy"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Staff Name</FormLabel>
                        <FormControl>
                          <Input {...field} placeholder="Enter your name" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  
                  <FormField
                    control={form.control}
                    name="shiftType"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Shift Type</FormLabel>
                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="Evening">Evening Shift</SelectItem>
                            <SelectItem value="Morning">Morning Shift</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="shiftDate"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Shift Date</FormLabel>
                        <FormControl>
                          <Input type="date" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </CardContent>
              </Card>

              {/* 2. Sales Information */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <TrendingUp className="h-5 w-5" />
                    2. Sales Information
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                    <FormField
                      control={form.control}
                      name="grabSales"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Grab Sales</FormLabel>
                          <FormControl>
                            <Input {...field} type="number" step="0.01" placeholder="0.00" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="aroiDeeSales"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Aroi Dee Sales</FormLabel>
                          <FormControl>
                            <Input {...field} type="number" step="0.01" placeholder="0.00" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="qrScanSales"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>QR Scan Sales</FormLabel>
                          <FormControl>
                            <Input {...field} type="number" step="0.01" placeholder="0.00" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="cashSales"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Cash Sales</FormLabel>
                          <FormControl>
                            <Input {...field} type="number" step="0.01" placeholder="0.00" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                  
                  <div className="p-4 bg-gray-50 rounded-lg">
                    <p className="font-medium">Total Sales: ฿{(watchedValues.totalSales || 0).toFixed(2)}</p>
                  </div>
                </CardContent>
              </Card>

              {/* 3. Wages & Staff Payments */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <User className="h-5 w-5" />
                    3. Wages & Staff Payments
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {form.watch('wageEntries')?.map((_, index) => (
                      <div key={index} className="grid grid-cols-1 sm:grid-cols-4 gap-4 p-4 border rounded">
                        <FormField
                          control={form.control}
                          name={`wageEntries.${index}.staffName`}
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Staff Name</FormLabel>
                              <FormControl>
                                <Input {...field} placeholder="Staff name" />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        <FormField
                          control={form.control}
                          name={`wageEntries.${index}.amount`}
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Amount (฿)</FormLabel>
                              <FormControl>
                                <Input {...field} type="number" step="0.01" placeholder="0.00" />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        <FormField
                          control={form.control}
                          name={`wageEntries.${index}.type`}
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Type</FormLabel>
                              <Select onValueChange={field.onChange} defaultValue={field.value}>
                                <FormControl>
                                  <SelectTrigger>
                                    <SelectValue />
                                  </SelectTrigger>
                                </FormControl>
                                <SelectContent>
                                  <SelectItem value="wages">Wages</SelectItem>
                                  <SelectItem value="overtime">Overtime</SelectItem>
                                  <SelectItem value="other">Other</SelectItem>
                                </SelectContent>
                              </Select>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        <div className="flex items-end">
                          <Button
                            type="button"
                            variant="destructive"
                            size="sm"
                            onClick={() => {
                              const entries = form.getValues('wageEntries') || [];
                              entries.splice(index, 1);
                              form.setValue('wageEntries', entries);
                            }}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    ))}
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => {
                        const entries = form.getValues('wageEntries') || [];
                        entries.push({ staffName: '', amount: 0, type: 'wages' });
                        form.setValue('wageEntries', entries);
                      }}
                    >
                      <Plus className="h-4 w-4 mr-2" />
                      Add Wage Entry
                    </Button>
                  </div>
                </CardContent>
              </Card>

              {/* 4. Shopping & Expenses */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <ShoppingCart className="h-5 w-5" />
                    4. Shopping & Expenses
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {form.watch('shoppingEntries')?.map((_, index) => (
                      <div key={index} className="grid grid-cols-1 sm:grid-cols-4 gap-4 p-4 border rounded">
                        <FormField
                          control={form.control}
                          name={`shoppingEntries.${index}.item`}
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Item</FormLabel>
                              <FormControl>
                                <Input {...field} placeholder="Item name" />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        <FormField
                          control={form.control}
                          name={`shoppingEntries.${index}.amount`}
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Amount (฿)</FormLabel>
                              <FormControl>
                                <Input {...field} type="number" step="0.01" placeholder="0.00" />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        <FormField
                          control={form.control}
                          name={`shoppingEntries.${index}.shop`}
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Shop</FormLabel>
                              <Select onValueChange={field.onChange} defaultValue={field.value}>
                                <FormControl>
                                  <SelectTrigger>
                                    <SelectValue />
                                  </SelectTrigger>
                                </FormControl>
                                <SelectContent>
                                  {SHOP_OPTIONS.map(shop => (
                                    <SelectItem key={shop} value={shop}>{shop}</SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        <div className="flex items-end">
                          <Button
                            type="button"
                            variant="destructive"
                            size="sm"
                            onClick={() => {
                              const entries = form.getValues('shoppingEntries') || [];
                              entries.splice(index, 1);
                              form.setValue('shoppingEntries', entries);
                            }}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    ))}
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => {
                        const entries = form.getValues('shoppingEntries') || [];
                        entries.push({ item: '', amount: 0, shop: '', customShop: '' });
                        form.setValue('shoppingEntries', entries);
                      }}
                    >
                      <Plus className="h-4 w-4 mr-2" />
                      Add Shopping Entry
                    </Button>
                    
                    <div className="p-4 bg-gray-50 rounded-lg">
                      <p className="font-medium">Total Expenses: ฿{(watchedValues.totalExpenses || 0).toFixed(2)}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* 5. Cash Management */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <DollarSign className="h-5 w-5" />
                    5. Cash Management
                  </CardTitle>
                </CardHeader>
                <CardContent className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <FormField
                    control={form.control}
                    name="startingCash"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Starting Cash</FormLabel>
                        <FormControl>
                          <Input {...field} type="number" step="0.01" placeholder="0.00" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="endingCash"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Ending Cash</FormLabel>
                        <FormControl>
                          <Input {...field} type="number" step="0.01" placeholder="0.00" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="bankedAmount"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Banked Amount</FormLabel>
                        <FormControl>
                          <Input {...field} type="number" step="0.01" placeholder="0.00" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </CardContent>
              </Card>

              {/* 6. Drink Stock */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Coffee className="h-5 w-5" />
                    6. Drink Stock
                  </CardTitle>
                </CardHeader>
                <CardContent className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
                  {DRINK_ITEMS.map(item => (
                    <FormField
                      key={item}
                      control={form.control}
                      name={`drinkStock.${item}`}
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-sm">{item}</FormLabel>
                          <FormControl>
                            <Input {...field} type="number" placeholder="0" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  ))}
                </CardContent>
              </Card>

              {/* 7. Fresh Food Stock */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <ChefHat className="h-5 w-5" />
                    7. Fresh Food Stock
                  </CardTitle>
                </CardHeader>
                <CardContent className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
                  {FRESH_FOOD_ITEMS.map(item => (
                    <FormField
                      key={item}
                      control={form.control}
                      name={`freshFood.${item}`}
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-sm">{item}</FormLabel>
                          <FormControl>
                            <Input {...field} type="number" placeholder="0" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  ))}
                </CardContent>
              </Card>

              {/* 8. Frozen Food */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Snowflake className="h-5 w-5" />
                    8. Frozen Food
                  </CardTitle>
                </CardHeader>
                <CardContent className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
                  {FROZEN_FOOD_ITEMS.map(item => (
                    <FormField
                      key={item}
                      control={form.control}
                      name={`frozenFood.${item}`}
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-sm">{item}</FormLabel>
                          <FormControl>
                            <Input {...field} type="number" placeholder="0" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  ))}
                </CardContent>
              </Card>

              {/* 9. Shelf Items */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Package className="h-5 w-5" />
                    9. Shelf Items
                  </CardTitle>
                </CardHeader>
                <CardContent className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
                  {SHELF_ITEMS.map(item => (
                    <FormField
                      key={item}
                      control={form.control}
                      name={`shelfItems.${item}`}
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-sm">{item}</FormLabel>
                          <FormControl>
                            <Input {...field} type="number" placeholder="0" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  ))}
                </CardContent>
              </Card>

              {/* 10. Kitchen Items */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <ChefHat className="h-5 w-5" />
                    10. Kitchen Items
                  </CardTitle>
                </CardHeader>
                <CardContent className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
                  {KITCHEN_ITEMS.map(item => (
                    <FormField
                      key={item}
                      control={form.control}
                      name={`kitchenItems.${item}`}
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-sm">{item}</FormLabel>
                          <FormControl>
                            <Input {...field} type="number" placeholder="0" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  ))}
                </CardContent>
              </Card>

              {/* 11. Packaging Items */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Package className="h-5 w-5" />
                    11. Packaging Items
                  </CardTitle>
                </CardHeader>
                <CardContent className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
                  {PACKAGING_ITEMS.map(item => (
                    <FormField
                      key={item}
                      control={form.control}
                      name={`packagingItems.${item}`}
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-sm">{item}</FormLabel>
                          <FormControl>
                            <Input {...field} type="number" placeholder="0" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  ))}
                </CardContent>
              </Card>

              {/* 12. Total Summary */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Calculator className="h-5 w-5" />
                    12. Total Summary
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 p-4 bg-gray-50 rounded-lg">
                    <div>
                      <p className="font-medium text-gray-700">Total Sales</p>
                      <p className="text-2xl font-bold text-green-600">฿{(watchedValues.totalSales || 0).toFixed(2)}</p>
                    </div>
                    <div>
                      <p className="font-medium text-gray-700">Total Expenses</p>
                      <p className="text-2xl font-bold text-red-600">฿{(watchedValues.totalExpenses || 0).toFixed(2)}</p>
                    </div>
                    <div>
                      <p className="font-medium text-gray-700">Net Revenue</p>
                      <p className="text-2xl font-bold text-blue-600">
                        ฿{((watchedValues.totalSales || 0) - (watchedValues.totalExpenses || 0)).toFixed(2)}
                      </p>
                    </div>
                    <div>
                      <p className="font-medium text-gray-700">Starting Cash</p>
                      <p className="text-lg font-semibold">฿{(watchedValues.startingCash || 0).toFixed(2)}</p>
                    </div>
                    <div>
                      <p className="font-medium text-gray-700">Ending Cash</p>
                      <p className="text-lg font-semibold">฿{(watchedValues.endingCash || 0).toFixed(2)}</p>
                    </div>
                    <div>
                      <p className="font-medium text-gray-700">Banked Amount</p>
                      <p className="text-lg font-semibold">฿{(watchedValues.bankedAmount || 0).toFixed(2)}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Submit Button */}
              <div className="flex justify-end gap-4">
                <Button type="submit" disabled={createMutation.isPending}>
                  {createMutation.isPending ? 'Submitting...' : 'Submit Form'}
                </Button>
              </div>

            </form>
          </Form>
        </div>
      </div>
    </div>
  );
}