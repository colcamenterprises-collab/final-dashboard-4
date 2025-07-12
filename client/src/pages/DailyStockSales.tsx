import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQueryClient, useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { insertDailyStockSalesSchema } from "@shared/schema";
import { apiRequest } from "@/lib/queryClient";
import { 
  Calculator, 
  Package, 
  User, 
  ShoppingCart, 
  Wrench, 
  Box, 
  Search, 
  Eye, 
  FileText, 
  Users, 
  Camera, 
  ImageIcon, 
  Save,
  DollarSign,
  ChefHat,
  Refrigerator,
  Coffee,
  ClipboardList,
  TrendingUp,
  Snowflake,
  Edit
} from "lucide-react";
import { z } from "zod";
import type { DailyStockSales } from "@shared/schema";

// Fresh Food items 
const FRESH_FOOD_ITEMS = [
  'Salad', 'Tomatos', 'White Cabbage', 'Purple Cabbage', 'Onions', 
  'Milk', 'Butter'
];

// Frozen Food items
const FROZEN_FOOD_ITEMS = [
  'Sweet Potato Fries', 'Chicken Nuggets', 'Chicken Fillets', 'French Fries'
];

// Shelf Items (non-perishable items)
const SHELF_ITEMS = [
  'Mayonnaise', 'Mustard', 'Cajun Spice', 'Dill Pickles', 'Sweet Pickles', 
  'Crispy Fried Onions', 'BBQ Sauce (Smokey)', 'Jalapenos', 'Ketchup',
  'Chili Sauce (Sriracha)', 'Oil (Fryer)', 'Pepper', 'Salt'
];

// Legacy food items (empty - all items moved to appropriate sections)
const LEGACY_FOOD_ITEMS: string[] = [];

// Drink items with current requirements (matching backend requirements)
const DRINK_ITEMS = [
  'Coke', 'Schweppes Manow', 'Coke Zero', 'Fanta Strawberry', 'Fanta Orange',
  'Kids Apple Juice', 'Kids Orange', 'Soda Water', 'Bottle Water', 'Sprite'
];

// Shop options for shopping entries
const SHOP_OPTIONS = [
  'Makro',
  '7/11', 
  'Supercheap',
  'Lotus',
  'Big C',
  'Printing Shop',
  'Bakery',
  'GO Wholesale',
  'Gas Supply',
  '*Other'
];

// Kitchen supplies
const KITCHEN_ITEMS = [
  'Clear Food Wrap', 'Aluminum Foil', 'Plastic Hand Gloves (Meat)', 'Rubber Gloves (Small)',
  'Rubber Gloves (Medium)', 'Rubber Gloves (Large)', 'Alcohol Sanitiser',
  'Dish Washing Liquid', 'Paper Towel (Long)', 'Sponge (dish washing)',
  'Paper Towel (Short)', 'Rolls Sticky Tape'
];

// Packaging supplies
const PACKAGING_ITEMS = [
  'French Fries Box', 'French Fries Paper', 'Paper Food Bags', 'Fork & Knife Set',
  'Loaded Fries Boxes', 'Burger Paper (12 x 14)', 'Wooden Flag Skewers',
  'Printer Rolls', 'Takeaway Sauce Containers', 'Coleslaw Container',
  'Plastic Carry Bags', 'Packaging Labels'
];

// Wage categories for dropdown
const WAGE_CATEGORIES = ['Wages', 'Over Time', 'Cleaning', 'Bonus'];

// Define line item types
const wageEntrySchema = z.object({
  name: z.string(),
  amount: z.number().min(0),
  notes: z.enum(['Wages', 'Over Time', 'Cleaning', 'Bonus']).default('Wages')
});

const shoppingEntrySchema = z.object({
  item: z.string(),
  amount: z.number().min(0),
  notes: z.string().optional(),
  shop: z.string(),
  customShop: z.string().optional()
});

const formSchema = insertDailyStockSalesSchema.extend({
  foodItems: z.record(z.number().min(0)).optional(),
  drinkStock: z.record(z.number().min(0)).optional(),
  kitchenItems: z.record(z.number().min(0)).optional(),
  packagingItems: z.record(z.number().min(0)).optional(),
  wageEntries: z.array(wageEntrySchema).default([]),
  shoppingEntries: z.array(shoppingEntrySchema).default([])
}).partial({
  // Make most fields optional except for the essential ones
  startingCash: true,
  endingCash: true,
  grabSales: true,
  foodPandaSales: true,
  aroiDeeSales: true,
  qrScanSales: true,
  cashSales: true,
  totalSales: true,
  salaryWages: true,
  shopping: true,
  gasExpense: true,
  totalExpenses: true,
  burgerBunsStock: true,
  rollsOrderedCount: true,
  meatWeight: true,
  drinkStockCount: true,
  rollsOrderedConfirmed: true,
  expenseDescription: true
});

type FormData = z.infer<typeof formSchema>;
type WageEntry = z.infer<typeof wageEntrySchema>;
type ShoppingEntry = z.infer<typeof shoppingEntrySchema>;

export default function DailyStockSales() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedForm, setSelectedForm] = useState<DailyStockSales | null>(null);
  
  // Receipt photo functionality removed
  
  // Draft functionality state
  const [isDraft, setIsDraft] = useState(false);
  const [editingFormId, setEditingFormId] = useState<number | null>(null);
  const [activeTab, setActiveTab] = useState('new-form');
  
  // Item management state
  const [showItemManager, setShowItemManager] = useState(false);
  const [customItems, setCustomItems] = useState<{
    freshFood: string[];
    frozenFood: string[];
    drinkItems: string[];
    kitchenItems: string[];
    packagingItems: string[];
  }>({
    freshFood: [...FRESH_FOOD_ITEMS],
    frozenFood: [...FROZEN_FOOD_ITEMS],
    drinkItems: [...DRINK_ITEMS],
    kitchenItems: [...KITCHEN_ITEMS],
    packagingItems: [...PACKAGING_ITEMS]
  });

  // Search query for completed forms
  const { data: completedForms = [], isLoading: searchLoading } = useQuery({
    queryKey: ['/api/daily-stock-sales/search', searchQuery],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (searchQuery.trim()) params.append('q', searchQuery);
      
      const response = await fetch(`/api/daily-stock-sales/search?${params}`);
      if (!response.ok) throw new Error('Failed to search forms');
      return response.json();
    }
  });
  
  const form = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      completedBy: "",
      shiftType: "Night Shift",
      shiftDate: new Date(),
      startingCash: "0",
      endingCash: "0",
      grabSales: "0",
      foodPandaSales: "0",
      aroiDeeSales: "0",
      qrScanSales: "0",
      cashSales: "0",
      totalSales: "0",
      salaryWages: "0",
      shopping: "0",
      gasExpense: "0",
      totalExpenses: "0",
      expenseDescription: "",
      wageEntries: [],
      shoppingEntries: [],
      burgerBunsStock: 0,
      rollsOrderedCount: 0,
      meatWeight: "0",
      rollsOrderedConfirmed: false,
      freshFood: Object.fromEntries(FRESH_FOOD_ITEMS.map(item => [item, 0])),
      frozenFood: Object.fromEntries(FROZEN_FOOD_ITEMS.map(item => [item, 0])),
      shelfItems: Object.fromEntries(SHELF_ITEMS.map(item => [item, 0])),
      foodItems: {},
      drinkStock: Object.fromEntries(DRINK_ITEMS.map(item => [item, 0])),
      kitchenItems: Object.fromEntries(KITCHEN_ITEMS.map(item => [item, 0])),
      packagingItems: Object.fromEntries(PACKAGING_ITEMS.map(item => [item, 0]))
    }
  });

  const createMutation = useMutation({
    mutationFn: (data: FormData) => {
      console.log('📝 Submitting form with data:', data);
      
      // Format the data properly like the draft mutation
      const formattedData = {
        ...data,
        shiftDate: new Date(data.shiftDate).toISOString().split('T')[0], // Format as YYYY-MM-DD
        receiptPhotos: receiptPhotos || [],
        isDraft: false
      };
      
      console.log('📤 Sending formatted data:', formattedData);
      
      // If editing an existing form, use PUT instead of POST
      const method = editingFormId ? 'PUT' : 'POST';
      const url = editingFormId ? `/api/daily-stock-sales/${editingFormId}` : '/api/daily-stock-sales';
      
      return apiRequest(url, {
        method: method,
        body: JSON.stringify(formattedData)
      });
    },
    onSuccess: (response) => {
      console.log('✅ Form submitted successfully:', response);
      toast({
        title: editingFormId ? "Form Updated Successfully" : "Form Submitted Successfully",
        description: editingFormId ? "The form has been updated with your changes." : "Daily stock and sales data has been saved and shopping list generated."
      });
      queryClient.invalidateQueries({ queryKey: ['/api/shopping-list'] });
      queryClient.invalidateQueries({ queryKey: ['/api/daily-stock-sales'] });
      queryClient.invalidateQueries({ queryKey: ['/api/daily-stock-sales/search'] });
      form.reset();
      setReceiptPhotos([]);
      setIsDraft(false);
      setEditingFormId(null);
    },
    onError: (error) => {
      console.error('❌ Error submitting form:', error);
      console.error('Error details:', {
        message: error.message,
        name: error.name,
        stack: error.stack
      });
      toast({
        title: "Error", 
        description: `Failed to submit form: ${error.message || 'Network error. Please try again.'}`,
        variant: "destructive"
      });
    }
  });

  // Auto-calculate total sales
  const calculateTotalSales = () => {
    const grab = parseFloat(form.getValues('grabSales') || '0');
    const foodPanda = parseFloat(form.getValues('foodPandaSales') || '0');
    const aroiDee = parseFloat(form.getValues('aroiDeeSales') || '0');
    const qrScan = parseFloat(form.getValues('qrScanSales') || '0');
    const cash = parseFloat(form.getValues('cashSales') || '0');
    
    const total = grab + foodPanda + aroiDee + qrScan + cash;
    form.setValue('totalSales', total.toFixed(2));
  };

  // Auto-calculate total expenses
  const formatCurrency = (value: string | number) => {
    return `$${parseFloat(value.toString()).toFixed(2)}`;
  };

  const calculateTotalExpenses = () => {
    const salary = parseFloat(form.getValues('salaryWages') || '0');
    const shopping = parseFloat(form.getValues('shopping') || '0');
    const gas = parseFloat(form.getValues('gasExpense') || '0');
    
    const total = salary + shopping + gas;
    form.setValue('totalExpenses', total.toFixed(2));
  };

  // Photo functions removed - no longer required
  
  // Draft saving mutation
  const saveDraftMutation = useMutation({
    mutationFn: (data: FormData) => {
      const formattedData = {
        ...data,
        shiftDate: new Date(data.shiftDate).toISOString().split('T')[0],
        receiptPhotos: receiptPhotos || [],
        isDraft: true
      };
      
      // If editing an existing form, use PUT instead of POST
      const method = editingFormId ? 'PUT' : 'POST';
      const url = editingFormId ? `/api/daily-stock-sales/${editingFormId}` : '/api/daily-stock-sales/draft';
      
      return apiRequest(url, {
        method: method,
        body: JSON.stringify(formattedData)
      });
    },
    onSuccess: () => {
      toast({
        title: editingFormId ? "Draft Updated" : "Draft Saved",
        description: editingFormId ? "Your draft has been updated." : "Your form has been saved as a draft."
      });
      setIsDraft(true);
      queryClient.invalidateQueries({ queryKey: ['/api/daily-stock-sales'] });
      queryClient.invalidateQueries({ queryKey: ['/api/daily-stock-sales/search'] });
    },
    onError: (error) => {
      console.error('Error saving draft:', error);
      toast({
        title: "Error",
        description: "Failed to save draft. Please try again.",
        variant: "destructive"
      });
    }
  });
  
  const saveDraft = () => {
    const formData = form.getValues();
    console.log("Saving draft with data:", formData);
    saveDraftMutation.mutate(formData);
  };

  const onSubmit = (data: FormData) => {
    console.log("Form submission attempt:", data);
    console.log("Form validation errors:", form.formState.errors);
    console.log("Shopping entries:", data.shoppingEntries);
    
    // Only check critical validation for non-draft submissions
    const validationErrors: string[] = [];
    
    // Check required fields
    if (!data.completedBy || data.completedBy.trim() === "") {
      validationErrors.push("Staff member name is required");
    }
    if (!data.shiftType || data.shiftType.trim() === "") {
      validationErrors.push("Shift type must be selected");
    }
    
    // Photo validation removed - photos are now optional
    
    // If critical validation fails, show error and don't submit
    if (validationErrors.length > 0) {
      toast({
        title: "Required Fields Missing",
        description: validationErrors.join(". "),
        variant: "destructive"
      });
      return;
    }
    
    console.log("All validation checks passed, proceeding with form submission");
    const submissionData = { ...data, isDraft: false };
    createMutation.mutate(submissionData);
  };

  return (
    <div className="container mx-auto p-2 sm:p-4 lg:p-6 space-y-3 sm:space-y-4 lg:space-y-6 max-w-7xl">
      <div className="flex items-center justify-between gap-2 mb-3 sm:mb-4 lg:mb-6">
        <div className="flex items-center gap-2">
          <Calculator className="h-5 w-5 sm:h-6 sm:w-6" />
          <h1 className="text-lg sm:text-xl lg:text-2xl font-bold">Daily Stock and Sales</h1>
        </div>
        <Button 
          variant="outline" 
          onClick={() => setShowItemManager(!showItemManager)}
          className="flex items-center gap-2"
        >
          <Wrench className="h-4 w-4" />
          Manage Items
        </Button>
      </div>

      {/* Item Management Panel */}
      {showItemManager && (
        <Card className="mb-6 shadow-lg hover:shadow-xl transition-shadow duration-300 border-0 bg-white">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Wrench className="h-5 w-5" />
              Form Items Management
            </CardTitle>
            <p className="text-sm text-gray-600">Add or remove items from the form sections</p>
          </CardHeader>
          <CardContent className="space-y-4">
            {Object.entries(customItems).map(([category, items]) => (
              <div key={category} className="border rounded-lg p-4">
                <h4 className="font-medium mb-2 capitalize">
                  {category.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase())}
                </h4>
                <div className="flex flex-wrap gap-2 mb-3">
                  {items.map((item, index) => (
                    <div key={index} className="flex items-center gap-1 bg-gray-100 px-2 py-1 rounded">
                      <span className="text-sm">{item}</span>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-4 w-4 p-0 text-red-500 hover:text-red-700"
                        onClick={() => {
                          setCustomItems(prev => ({
                            ...prev,
                            [category]: prev[category as keyof typeof prev].filter((_, i) => i !== index)
                          }));
                        }}
                      >
                        ×
                      </Button>
                    </div>
                  ))}
                </div>
                <div className="flex gap-2">
                  <Input
                    placeholder="Add new item"
                    onKeyPress={(e) => {
                      if (e.key === 'Enter' && e.currentTarget.value.trim()) {
                        setCustomItems(prev => ({
                          ...prev,
                          [category]: [...prev[category as keyof typeof prev], e.currentTarget.value.trim()]
                        }));
                        e.currentTarget.value = '';
                      }
                    }}
                    className="flex-1"
                  />
                  <Button
                    size="sm"
                    onClick={(e) => {
                      const input = e.currentTarget.previousElementSibling as HTMLInputElement;
                      if (input.value.trim()) {
                        setCustomItems(prev => ({
                          ...prev,
                          [category]: [...prev[category as keyof typeof prev], input.value.trim()]
                        }));
                        input.value = '';
                      }
                    }}
                  >
                    Add
                  </Button>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full grid-cols-3 h-auto">
          <TabsTrigger value="new-form" className="text-xs sm:text-sm lg:text-base py-2 px-2 sm:px-4">New Form</TabsTrigger>
          <TabsTrigger value="draft" className="text-xs sm:text-sm lg:text-base py-2 px-2 sm:px-4">Load Draft</TabsTrigger>
          <TabsTrigger value="search" className="text-xs sm:text-sm lg:text-base py-2 px-2 sm:px-4">Search Forms</TabsTrigger>
        </TabsList>
        
        <TabsContent value="new-form" className="space-y-6">
          {editingFormId && (
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-4">
              <div className="flex items-center gap-2">
                <Edit className="h-5 w-5 text-blue-600" />
                <h3 className="font-medium text-blue-900">Editing Form</h3>
              </div>
              <p className="text-sm text-blue-700 mt-1">
                You are currently editing an existing form. Changes will update the original form.
              </p>
              <Button 
                variant="outline" 
                size="sm" 
                onClick={() => {
                  setEditingFormId(null);
                  form.reset();
                  setIsDraft(false);
                }}
                className="mt-2"
              >
                Cancel Edit
              </Button>
            </div>
          )}
          <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit, (errors) => {
          console.log("Form validation errors:", errors);
          toast({
            title: "Form Validation Error",
            description: "Please check all required fields and fix any errors before submitting.",
            variant: "destructive"
          });
        })} className="space-y-6">
          
          {/* Who is Completing Form */}
          <Card className="shadow-lg hover:shadow-xl transition-shadow duration-300 border-0 bg-white">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <User className="h-5 w-5" />
                Who is Completing Form
              </CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
              <FormField
                control={form.control}
                name="completedBy"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Who is Completing Form?</FormLabel>
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
                        <SelectItem value="Night Shift">Night Shift</SelectItem>
                        <SelectItem value="Day Shift">Day Shift</SelectItem>
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
                    <FormLabel>Today's Date</FormLabel>
                    <FormControl>
                      <Input 
                        type="date" 
                        {...field} 
                        value={field.value instanceof Date ? field.value.toISOString().split('T')[0] : field.value}
                        onChange={(e) => field.onChange(new Date(e.target.value))}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </CardContent>
          </Card>

          {/* Cash Management */}
          <Card className="shadow-lg hover:shadow-xl transition-shadow duration-300 border-0 bg-white">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <DollarSign className="h-5 w-5" />
                Cash Management
              </CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-1 gap-4">
              <FormField
                control={form.control}
                name="startingCash"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Cash in Register at Start of Shift</FormLabel>
                    <FormControl>
                      <Input {...field} type="number" step="0.01" placeholder="0.00" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />


            </CardContent>
          </Card>

          {/* Sales Data */}
          <Card className="shadow-lg hover:shadow-xl transition-shadow duration-300 border-0 bg-white">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <TrendingUp className="h-5 w-5" />
                Sales Data
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                <FormField
                  control={form.control}
                  name="grabSales"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Grab Sales</FormLabel>
                      <FormControl>
                        <Input 
                          {...field} 
                          type="number" 
                          step="0.01" 
                          placeholder="0.00"
                          onChange={(e) => {
                            field.onChange(e);
                            setTimeout(calculateTotalSales, 100);
                          }}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="foodPandaSales"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Direct Sales</FormLabel>
                      <FormControl>
                        <Input 
                          {...field} 
                          type="number" 
                          step="0.01" 
                          placeholder="0.00"
                          onChange={(e) => {
                            field.onChange(e);
                            setTimeout(calculateTotalSales, 100);
                          }}
                        />
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
                        <Input 
                          {...field} 
                          type="number" 
                          step="0.01" 
                          placeholder="0.00"
                          onChange={(e) => {
                            field.onChange(e);
                            setTimeout(calculateTotalSales, 100);
                          }}
                        />
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
                      <FormLabel>QR / Scan Sales</FormLabel>
                      <FormControl>
                        <Input 
                          {...field} 
                          type="number" 
                          step="0.01" 
                          placeholder="0.00"
                          onChange={(e) => {
                            field.onChange(e);
                            setTimeout(calculateTotalSales, 100);
                          }}
                        />
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
                        <Input 
                          {...field} 
                          type="number" 
                          step="0.01" 
                          placeholder="0.00"
                          onChange={(e) => {
                            field.onChange(e);
                            setTimeout(calculateTotalSales, 100);
                          }}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="totalSales"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Total Sales Amount</FormLabel>
                      <FormControl>
                        <Input {...field} type="number" step="0.01" placeholder="0.00" readOnly className="bg-gray-50" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            </CardContent>
          </Card>

          {/* Expenses */}
          <Card className="shadow-lg hover:shadow-xl transition-shadow duration-300 border-0 bg-white">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Calculator className="h-5 w-5" />
                Expenses
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Wages Section */}
              <div>
                <h3 className="text-lg font-medium mb-3">Salary / Wages</h3>
                <p className="text-sm text-gray-600 mb-3">Please list each staff member individually</p>
                
                <div className="space-y-3">
                  <div className="hidden md:grid grid-cols-12 gap-3 text-sm font-medium text-gray-700">
                    <div className="col-span-4">Name</div>
                    <div className="col-span-3">Amount</div>
                    <div className="col-span-4">Notes</div>
                    <div className="col-span-1">Action</div>
                  </div>
                  
                  {(form.watch('wageEntries') || []).map((_, index) => (
                    <div key={index} className="grid grid-cols-1 md:grid-cols-12 gap-3 p-4 md:p-0 border md:border-0 rounded-lg md:rounded-none">
                      <FormField
                        control={form.control}
                        name={`wageEntries.${index}.name`}
                        render={({ field }) => (
                          <FormItem className="md:col-span-4">
                            <FormLabel className="md:hidden text-sm font-medium">Name</FormLabel>
                            <FormControl>
                              <Input {...field} placeholder="Staff Name" />
                            </FormControl>
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={form.control}
                        name={`wageEntries.${index}.amount`}
                        render={({ field }) => (
                          <FormItem className="md:col-span-3">
                            <FormLabel className="md:hidden text-sm font-medium">Amount</FormLabel>
                            <FormControl>
                              <Input 
                                {...field} 
                                type="number" 
                                step="0.01" 
                                placeholder="1000"
                                onChange={(e) => field.onChange(parseFloat(e.target.value) || 0)}
                              />
                            </FormControl>
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={form.control}
                        name={`wageEntries.${index}.notes`}
                        render={({ field }) => (
                          <FormItem className="md:col-span-4">
                            <FormLabel className="md:hidden text-sm font-medium">Notes</FormLabel>
                            <Select onValueChange={field.onChange} value={field.value}>
                              <FormControl>
                                <SelectTrigger>
                                  <SelectValue placeholder="Select wage category" />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent>
                                {WAGE_CATEGORIES.map((category) => (
                                  <SelectItem key={category} value={category}>
                                    {category}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </FormItem>
                        )}
                      />
                      <div className="md:col-span-1 flex justify-end md:justify-center">
                        <Button 
                          type="button" 
                          variant="outline" 
                          size="sm"
                          onClick={() => {
                            const current = form.getValues('wageEntries');
                            form.setValue('wageEntries', current.filter((_, i) => i !== index));
                          }}
                        >
                          ×
                        </Button>
                      </div>
                    </div>
                  ))}
                  
                  <Button 
                    type="button" 
                    variant="outline" 
                    onClick={() => {
                      const current = form.getValues('wageEntries');
                      form.setValue('wageEntries', [...current, { name: '', amount: 0, notes: 'Wages' }]);
                    }}
                  >
                    Add Wage Entry
                  </Button>
                  
                  <div className="text-right">
                    <strong>Total Wages: ${(form.watch('wageEntries') || []).reduce((sum, entry) => sum + (entry.amount || 0), 0).toFixed(2)}</strong>
                  </div>
                </div>
              </div>

              {/* Shopping Section */}
              <div>
                <h3 className="text-lg font-medium mb-3 flex items-center gap-2">
                  <ShoppingCart className="h-5 w-5" />
                  Shopping & Other Expenses
                </h3>
                <p className="text-sm text-gray-600 mb-3">Please list each item individually</p>
                
                {/* Photo Receipt Section - REMOVED */}
                
                <div className="space-y-3">
                  <div className="grid grid-cols-12 gap-3 text-sm font-medium text-gray-700">
                    <div className="col-span-3">Item</div>
                    <div className="col-span-2">Amount</div>
                    <div className="col-span-2">Shop</div>
                    <div className="col-span-3">Notes</div>
                    <div className="col-span-1">Action</div>
                  </div>
                  
                  {(form.watch('shoppingEntries') || []).map((entry, index) => {
                    const selectedShop = form.watch(`shoppingEntries.${index}.shop`);
                    const isOtherShop = selectedShop === '*Other';
                    
                    return (
                      <div key={index} className="grid grid-cols-12 gap-3">
                        <FormField
                          control={form.control}
                          name={`shoppingEntries.${index}.item`}
                          render={({ field }) => (
                            <FormItem className="col-span-3">
                              <FormControl>
                                <Input {...field} placeholder="Bin Bags" />
                              </FormControl>
                            </FormItem>
                          )}
                        />
                        <FormField
                          control={form.control}
                          name={`shoppingEntries.${index}.amount`}
                          render={({ field }) => (
                            <FormItem className="col-span-2">
                              <FormControl>
                                <Input 
                                  {...field} 
                                  type="number" 
                                  step="0.01" 
                                  placeholder="200"
                                  onChange={(e) => field.onChange(parseFloat(e.target.value) || 0)}
                                />
                              </FormControl>
                            </FormItem>
                          )}
                        />
                        <FormField
                          control={form.control}
                          name={`shoppingEntries.${index}.shop`}
                          render={({ field }) => (
                            <FormItem className="col-span-2">
                              <Select onValueChange={field.onChange} defaultValue={field.value}>
                                <FormControl>
                                  <SelectTrigger>
                                    <SelectValue placeholder="Select shop" />
                                  </SelectTrigger>
                                </FormControl>
                                <SelectContent>
                                  {SHOP_OPTIONS.map((shop) => (
                                    <SelectItem key={shop} value={shop}>
                                      {shop}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </FormItem>
                          )}
                        />
                        {isOtherShop && (
                          <FormField
                            control={form.control}
                            name={`shoppingEntries.${index}.customShop`}
                            render={({ field }) => (
                              <FormItem className="col-span-2">
                                <FormControl>
                                  <Input {...field} placeholder="Enter shop name" />
                                </FormControl>
                              </FormItem>
                            )}
                          />
                        )}
                        <FormField
                          control={form.control}
                          name={`shoppingEntries.${index}.notes`}
                          render={({ field }) => (
                            <FormItem className={isOtherShop ? "col-span-1" : "col-span-3"}>
                              <FormControl>
                                <Input {...field} placeholder="Garbage Bags" />
                              </FormControl>
                            </FormItem>
                          )}
                        />
                        <div className="col-span-1">
                          <Button 
                            type="button" 
                            variant="outline" 
                            size="sm"
                            onClick={() => {
                              const current = form.getValues('shoppingEntries');
                              form.setValue('shoppingEntries', current.filter((_, i) => i !== index));
                            }}
                          >
                            ×
                          </Button>
                        </div>
                      </div>
                    );
                  })}
                  
                  <Button 
                    type="button" 
                    variant="outline" 
                    onClick={() => {
                      const current = form.getValues('shoppingEntries');
                      form.setValue('shoppingEntries', [...current, { item: '', amount: 0, notes: '', shop: '', customShop: '' }]);
                    }}
                  >
                    Add Shopping Item
                  </Button>
                  
                  <div className="text-right">
                    <strong>Total Shopping & Other: ฿{(form.watch('shoppingEntries') || []).reduce((sum, entry) => sum + (entry.amount || 0), 0).toFixed(2)}</strong>
                  </div>
                </div>
              </div>

              {/* Total Expenses */}
              <div className="flex justify-end">
                <FormField
                  control={form.control}
                  name="totalExpenses"
                  render={({ field }) => (
                    <FormItem className="w-full md:w-1/2">
                      <FormLabel>Total Expenses</FormLabel>
                      <FormControl>
                        <Input 
                          {...field} 
                          type="number" 
                          step="0.01" 
                          placeholder="0.00" 
                          readOnly 
                          className="bg-gray-50"
                          value={
                            (form.watch('wageEntries') || []).reduce((sum, entry) => sum + (entry.amount || 0), 0) +
                            (form.watch('shoppingEntries') || []).reduce((sum, entry) => sum + (entry.amount || 0), 0)
                          }
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            </CardContent>
          </Card>

          {/* Sales and Expenses Summary */}
          <Card className="shadow-lg hover:shadow-xl transition-shadow duration-300 border-0 bg-white">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Calculator className="h-5 w-5" />
                Sales and Expenses Summary
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                <FormField
                  control={form.control}
                  name="totalSales"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Total Sales Amount</FormLabel>
                      <FormControl>
                        <Input {...field} type="number" step="0.01" placeholder="0.00" readOnly className="bg-gray-50" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="totalExpenses"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Total Expenses</FormLabel>
                      <FormControl>
                        <Input 
                          {...field} 
                          type="number" 
                          step="0.01" 
                          placeholder="0.00" 
                          readOnly 
                          className="bg-gray-50"
                          value={
                            (form.watch('wageEntries') || []).reduce((sum, entry) => sum + (entry.amount || 0), 0) +
                            (form.watch('shoppingEntries') || []).reduce((sum, entry) => sum + (entry.amount || 0), 0)
                          }
                        />
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
                      <FormLabel>Cash in Register at End of Shift</FormLabel>
                      <FormControl>
                        <Input {...field} type="number" step="0.01" placeholder="0.00" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            </CardContent>
          </Card>

          {/* Cash Balance Status */}
          <Card className="shadow-lg hover:shadow-xl transition-shadow duration-300 border-0 bg-white">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Calculator className="h-5 w-5" />
                Cash Balance Status
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {(() => {
                  const startingCash = parseFloat(form.watch('startingCash') || '0');
                  const cashSales = parseFloat(form.watch('cashSales') || '0');
                  const totalExpenses = (form.watch('wageEntries') || []).reduce((sum, entry) => sum + (entry.amount || 0), 0) +
                                      (form.watch('shoppingEntries') || []).reduce((sum, entry) => sum + (entry.amount || 0), 0);
                  const expectedCash = startingCash + cashSales - totalExpenses;
                  const actualCash = parseFloat(form.watch('endingCash') || '0');
                  const variance = Math.abs(expectedCash - actualCash);
                  const isBalanced = variance <= 20; // 20 baht variance tolerance
                  const cashToBeBanked = Math.max(0, actualCash - startingCash); // Cash to bank = Total cash - Starting float

                  return (
                    <>
                      {/* Balance Status */}
                      <div className="p-4 bg-blue-50 rounded-lg">
                        <div className="text-center">
                          <p className="text-sm text-gray-600 mb-2">Cash Balance Status</p>
                          <span className={`inline-flex px-4 py-2 rounded-full text-lg font-medium ${
                            isBalanced 
                              ? 'bg-green-100 text-green-800' 
                              : 'bg-red-100 text-red-800'
                          }`}>
                            {isBalanced ? 'Balanced' : 'Not Balanced'}
                          </span>
                          <p className="text-xs text-gray-500 mt-2">
                            Detailed calculations available to management after form submission
                          </p>
                        </div>
                      </div>

                      {/* Two Result Boxes */}
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                        {/* Total Cash Balance */}
                        <div className="p-4 bg-green-50 rounded-lg border border-green-200">
                          <div className="text-center">
                            <p className="text-sm text-gray-600 mb-1">Total Cash in Register</p>
                            <p className="text-2xl font-bold text-green-700">
                              ฿{actualCash.toFixed(2)}
                            </p>
                            <p className="text-xs text-gray-500 mt-1">
                              Includes starting float of ฿{startingCash.toFixed(2)}
                            </p>
                          </div>
                        </div>

                        {/* Cash to be Banked */}
                        <div className="p-4 bg-yellow-50 rounded-lg border border-yellow-200">
                          <div className="text-center">
                            <p className="text-sm text-gray-600 mb-1">Cash to be Banked</p>
                            <p className="text-2xl font-bold text-yellow-700">
                              ฿{cashToBeBanked.toFixed(2)}
                            </p>
                            <p className="text-xs text-gray-500 mt-1">
                              Excludes starting float for next shift
                            </p>
                          </div>
                        </div>
                      </div>
                    </>
                  );
                })()}
              </div>
            </CardContent>
          </Card>

          {/* Stock Counts */}
          <Card className="shadow-lg hover:shadow-xl transition-shadow duration-300 border-0 bg-white">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Package className="h-5 w-5" />
                Stock Counts
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <FormField
                  control={form.control}
                  name="burgerBunsStock"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Burger Buns in Stock</FormLabel>
                      <FormControl>
                        <Input 
                          {...field} 
                          type="number" 
                          min="0" 
                          onChange={(e) => field.onChange(parseInt(e.target.value) || 0)}
                          value={field.value || ''}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="rollsOrderedCount"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Rolls Ordered</FormLabel>
                      <FormControl>
                        <Input 
                          {...field} 
                          type="number" 
                          min="0" 
                          onChange={(e) => field.onChange(parseInt(e.target.value) || 0)}
                          value={field.value || ''}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="meatWeight"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Meat Weight in Kg's</FormLabel>
                      <FormControl>
                        <Input {...field} type="number" step="0.01" placeholder="kg" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />


              </div>

              {/* Drink Stock Inventory within Stock Counts */}
              <div className="mt-6">
                <h4 className="text-md font-medium mb-3 flex items-center gap-2">
                  <Coffee className="h-4 w-4" />
                  Drink Stock Inventory
                </h4>
                <div className="grid grid-cols-1 xs:grid-cols-2 md:grid-cols-4 gap-4">
                  {DRINK_ITEMS.map((item) => (
                    <FormField
                      key={item}
                      control={form.control}
                      name={`drinkStock.${item}` as any}
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-sm">{item}</FormLabel>
                          <FormControl>
                            <Input 
                              {...field} 
                              type="number" 
                              min="0" 
                              className="h-8"
                              onChange={(e) => field.onChange(parseInt(e.target.value) || 0)}
                              value={field.value || ''}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Food Items Required */}
          <Card className="shadow-lg hover:shadow-xl transition-shadow duration-300 border-0 bg-white">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <ChefHat className="h-5 w-5" />
                Food Items Required
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Fresh Food */}
              <div>
                <h3 className="text-lg font-medium mb-3">Fresh Food</h3>
                <div className="grid grid-cols-1 xs:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
                  <FormField
                    control={form.control}
                    name="freshFood.salad"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-sm">Salad</FormLabel>
                        <FormControl>
                          <Input 
                            {...field} 
                            type="number" 
                            min="0" 
                            className="h-8"
                            onChange={(e) => field.onChange(parseInt(e.target.value) || 0)}
                            value={field.value || ''}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="freshFood.tomatos"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-sm">Tomatos</FormLabel>
                        <FormControl>
                          <Input 
                            {...field} 
                            type="number" 
                            min="0" 
                            className="h-8"
                            onChange={(e) => field.onChange(parseInt(e.target.value) || 0)}
                            value={field.value || ''}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="freshFood.whiteCabbage"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-sm">White Cabbage</FormLabel>
                        <FormControl>
                          <Input 
                            {...field} 
                            type="number" 
                            min="0" 
                            className="h-8"
                            onChange={(e) => field.onChange(parseInt(e.target.value) || 0)}
                            value={field.value || ''}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="freshFood.purpleCabbage"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-sm">Purple Cabbage</FormLabel>
                        <FormControl>
                          <Input 
                            {...field} 
                            type="number" 
                            min="0" 
                            className="h-8"
                            onChange={(e) => field.onChange(parseInt(e.target.value) || 0)}
                            value={field.value || ''}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="freshFood.onions"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-sm">Onions</FormLabel>
                        <FormControl>
                          <Input 
                            {...field} 
                            type="number" 
                            min="0" 
                            className="h-8"
                            onChange={(e) => field.onChange(parseInt(e.target.value) || 0)}
                            value={field.value || ''}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="freshFood.baconShort"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-sm">Bacon Short</FormLabel>
                        <FormControl>
                          <Input 
                            {...field} 
                            type="number" 
                            min="0" 
                            className="h-8"
                            onChange={(e) => field.onChange(parseInt(e.target.value) || 0)}
                            value={field.value || ''}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="freshFood.baconLong"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-sm">Bacon Long</FormLabel>
                        <FormControl>
                          <Input 
                            {...field} 
                            type="number" 
                            min="0" 
                            className="h-8"
                            onChange={(e) => field.onChange(parseInt(e.target.value) || 0)}
                            value={field.value || ''}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="freshFood.cheese"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-sm">Cheese</FormLabel>
                        <FormControl>
                          <Input 
                            {...field} 
                            type="number" 
                            min="0" 
                            className="h-8"
                            onChange={(e) => field.onChange(parseInt(e.target.value) || 0)}
                            value={field.value || ''}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="freshFood.milk"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-sm">Milk</FormLabel>
                        <FormControl>
                          <Input 
                            {...field} 
                            type="number" 
                            min="0" 
                            className="h-8"
                            onChange={(e) => field.onChange(parseInt(e.target.value) || 0)}
                            value={field.value || ''}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="freshFood.butter"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-sm">Butter</FormLabel>
                        <FormControl>
                          <Input 
                            {...field} 
                            type="number" 
                            min="0" 
                            className="h-8"
                            onChange={(e) => field.onChange(parseInt(e.target.value) || 0)}
                            value={field.value || ''}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>


              </div>

              {/* Shelf Items */}
              <div>
                <h3 className="text-lg font-medium mb-3 flex items-center gap-2">
                  <Refrigerator className="h-5 w-5" />
                  Shelf Items
                </h3>
                <div className="grid grid-cols-1 xs:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
                  {SHELF_ITEMS.map((item) => (
                    <FormField
                      key={item}
                      control={form.control}
                      name={`shelfItems.${item}` as any}
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-sm">{item}</FormLabel>
                          <FormControl>
                            <Input 
                              {...field} 
                              type="number" 
                              min="0" 
                              className="h-8"
                              onChange={(e) => field.onChange(parseInt(e.target.value) || 0)}
                              value={field.value || ''}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  ))}
                </div>
              </div>

              {/* Frozen Food */}
              <div>
                <h3 className="text-lg font-medium mb-3 flex items-center gap-2">
                  <Snowflake className="h-4 w-4" />
                  Frozen Food
                </h3>
                <div className="grid grid-cols-1 xs:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
                  {FROZEN_FOOD_ITEMS.map((item) => (
                    <FormField
                      key={item}
                      control={form.control}
                      name={`frozenFood.${item}` as any}
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-sm">{item}</FormLabel>
                          <FormControl>
                            <Input 
                              {...field} 
                              type="number" 
                              min="0" 
                              className="h-8"
                              onChange={(e) => field.onChange(parseInt(e.target.value) || 0)}
                              value={field.value || ''}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  ))}
                </div>
              </div>

              {/* Other Items Not Listed */}
              <div className="mt-6">
                <h3 className="text-lg font-medium mb-3 flex items-center gap-2">
                  <ClipboardList className="h-5 w-5" />
                  Other items not listed
                </h3>
                <div className="space-y-2">
                  {(form.watch('freshFood.otherItems') || []).map((item, index) => (
                    <div key={index} className="flex gap-2 items-center">
                      <Input
                        placeholder="Item name"
                        value={item.name || ''}
                        onChange={(e) => {
                          const current = form.getValues('freshFood.otherItems') || [];
                          current[index] = { ...current[index], name: e.target.value };
                          form.setValue('freshFood.otherItems', current);
                        }}
                        className="flex-1"
                      />
                      <Input
                        type="number"
                        min="0"
                        placeholder="Quantity"
                        value={item.quantity || ''}
                        onChange={(e) => {
                          const current = form.getValues('freshFood.otherItems') || [];
                          current[index] = { ...current[index], quantity: parseInt(e.target.value) || 0 };
                          form.setValue('freshFood.otherItems', current);
                        }}
                        className="w-24"
                      />
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          const current = form.getValues('freshFood.otherItems') || [];
                          form.setValue('freshFood.otherItems', current.filter((_, i) => i !== index));
                        }}
                      >
                        ×
                      </Button>
                    </div>
                  ))}
                  
                  <Button 
                    type="button" 
                    className="bg-yellow-600 hover:bg-yellow-700 text-white border-yellow-600"
                    onClick={() => {
                      const current = form.getValues('freshFood.otherItems') || [];
                      form.setValue('freshFood.otherItems', [...current, { name: '', quantity: 0 }]);
                    }}
                  >
                    Add Other Items
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>





          {/* Kitchen Items */}
          <Card className="shadow-lg hover:shadow-xl transition-shadow duration-300 border-0 bg-white">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Wrench className="h-5 w-5" />
                Kitchen Requirements
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {KITCHEN_ITEMS.map((item) => (
                  <FormField
                    key={item}
                    control={form.control}
                    name={`kitchenItems.${item}` as any}
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-sm">{item}</FormLabel>
                        <FormControl>
                          <Input 
                            {...field} 
                            type="number" 
                            min="0" 
                            className="h-8"
                            onChange={(e) => field.onChange(parseInt(e.target.value) || 0)}
                            value={field.value || ''}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Packaging Items */}
          <Card className="shadow-lg hover:shadow-xl transition-shadow duration-300 border-0 bg-white">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Box className="h-5 w-5" />
                Packaging & Supplies
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {PACKAGING_ITEMS.map((item) => (
                  <FormField
                    key={item}
                    control={form.control}
                    name={`packagingItems.${item}` as any}
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-sm">{item}</FormLabel>
                        <FormControl>
                          <Input 
                            {...field} 
                            type="number" 
                            min="0" 
                            className="h-8"
                            onChange={(e) => field.onChange(parseInt(e.target.value) || 0)}
                            value={field.value || ''}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Confirmation */}
          <Card className="shadow-lg hover:shadow-xl transition-shadow duration-300 border-0 bg-white">
            <CardHeader>
              <CardTitle>Confirmation</CardTitle>
            </CardHeader>
            <CardContent>
              <FormField
                control={form.control}
                name="rollsOrderedConfirmed"
                render={({ field }) => (
                  <FormItem className="flex flex-row items-start space-x-3 space-y-0">
                    <FormControl>
                      <Checkbox checked={field.value} onCheckedChange={field.onChange} />
                    </FormControl>
                    <div className="space-y-1 leading-none">
                      <FormLabel>Confirm that you have ordered rolls</FormLabel>
                    </div>
                  </FormItem>
                )}
              />
            </CardContent>
          </Card>



          <div className="flex justify-between">
            <Button 
              type="button"
              onClick={saveDraft}
              disabled={saveDraftMutation.isPending}
              className="min-w-[150px] bg-black text-white hover:bg-gray-800"
            >
              <Save className="h-4 w-4 mr-2" />
              {saveDraftMutation.isPending ? "Saving..." : editingFormId ? "Update Draft" : "Save as Draft"}
            </Button>
            
            <Button 
              type="submit" 
              disabled={createMutation.isPending}
              className="min-w-[200px] bg-black text-white hover:bg-gray-800"
            >
              {createMutation.isPending ? "Submitting..." : editingFormId ? "Update Form" : "Submit Form"}
            </Button>
          </div>
          </form>
        </Form>
        </TabsContent>

        <TabsContent value="draft" className="space-y-6">
          <Card className="shadow-lg hover:shadow-xl transition-shadow duration-300 border-0 bg-white">
            <CardHeader>
              <CardTitle>Load Draft</CardTitle>
              <p className="text-sm text-gray-600">Find and load your saved draft forms to continue working on them.</p>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {searchLoading ? (
                  <div className="text-center py-8">
                    <p>Loading drafts...</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {completedForms.filter(form => form.isDraft).length === 0 ? (
                      <p className="text-center py-8 text-gray-500">No drafts found. Save a draft from the "New Form" tab to see it here.</p>
                    ) : (
                      completedForms.filter(form => form.isDraft).map((draftForm) => (
                        <div key={draftForm.id} className="border rounded-lg p-4 hover:bg-gray-50 cursor-pointer">
                          <div className="flex justify-between items-start">
                            <div className="space-y-1">
                              <div className="flex items-center gap-2">
                                <Users className="h-4 w-4 text-blue-500" />
                                <p className="font-medium">{draftForm.completedBy}</p>
                                <Badge variant="secondary">Draft</Badge>
                              </div>
                              <p className="text-sm text-gray-600">
                                {format(new Date(draftForm.shiftDate), 'PPP')} - {draftForm.shiftType}
                              </p>
                              <p className="text-sm text-gray-500">
                                Created: {format(new Date(draftForm.createdAt), 'PPpp')}
                              </p>
                            </div>
                            <Button
                              size="sm"
                              onClick={() => {
                                // Load the draft data into the form
                                form.reset({
                                  completedBy: draftForm.completedBy,
                                  shiftType: draftForm.shiftType,
                                  shiftDate: new Date(draftForm.shiftDate),
                                  startingCash: draftForm.startingCash || "0",
                                  endingCash: draftForm.endingCash || "0",
                                  grabSales: draftForm.grabSales || "0",
                                  foodPandaSales: draftForm.foodPandaSales || "0",
                                  aroiDeeSales: draftForm.aroiDeeSales || "0",
                                  qrScanSales: draftForm.qrScanSales || "0",
                                  cashSales: draftForm.cashSales || "0",
                                  totalSales: draftForm.totalSales || "0",
                                  salaryWages: draftForm.salaryWages || "0",
                                  shopping: draftForm.shopping || "0",
                                  gasExpense: draftForm.gasExpense || "0",
                                  totalExpenses: draftForm.totalExpenses || "0",
                                  expenseDescription: draftForm.expenseDescription || "",
                                  wageEntries: draftForm.wageEntries || [],
                                  shoppingEntries: draftForm.shoppingEntries || [],
                                  burgerBunsStock: draftForm.burgerBunsStock || 0,
                                  rollsOrderedCount: draftForm.rollsOrderedCount || 0,
                                  meatWeight: draftForm.meatWeight || "0",
                                  rollsOrderedConfirmed: draftForm.rollsOrderedConfirmed || false,
                                  freshFood: draftForm.freshFood || Object.fromEntries(FRESH_FOOD_ITEMS.map(item => [item, 0])),
                                  frozenFood: draftForm.frozenFood || Object.fromEntries(FROZEN_FOOD_ITEMS.map(item => [item, 0])),
                                  shelfItems: draftForm.shelfItems || Object.fromEntries(SHELF_ITEMS.map(item => [item, 0])),
                                  foodItems: draftForm.foodItems || {},
                                  drinkStock: draftForm.drinkStock || Object.fromEntries(DRINK_ITEMS.map(item => [item, 0])),
                                  kitchenItems: draftForm.kitchenItems || Object.fromEntries(KITCHEN_ITEMS.map(item => [item, 0])),
                                  packagingItems: draftForm.packagingItems || Object.fromEntries(PACKAGING_ITEMS.map(item => [item, 0]))
                                });
                                // Load receipt photos if they exist
                                if (draftForm.receiptPhotos) {
                                  setReceiptPhotos(draftForm.receiptPhotos);
                                }
                                setIsDraft(true);
                                toast({
                                  title: "Draft Loaded",
                                  description: "Your draft has been loaded into the form. You can continue editing."
                                });
                              }}
                              className="bg-blue-500 hover:bg-blue-600 text-white"
                            >
                              Load Draft
                            </Button>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="search" className="space-y-6">
          <Card className="shadow-lg hover:shadow-xl transition-shadow duration-300 border-0 bg-white">
            <CardHeader>
              <CardTitle>Search Completed Forms</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="flex space-x-2">
                  <Input
                    placeholder="Search by staff name, date, notes..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="flex-1"
                  />
                  <Button onClick={() => {}} className="flex items-center space-x-2">
                    <Search className="h-4 w-4" />
                    <span>Search</span>
                  </Button>
                </div>

                {searchLoading ? (
                  <div className="text-center py-8">
                    <p>Searching forms...</p>
                  </div>
                ) : selectedForm ? (
                  <div className="space-y-4">
                    <div className="flex justify-between items-center">
                      <h3 className="text-lg font-semibold">Form Details</h3>
                      <Button variant="outline" onClick={() => setSelectedForm(null)}>
                        Back to Results
                      </Button>
                    </div>
                    
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div className="flex items-center space-x-2">
                        <Users className="h-4 w-4 text-blue-500" />
                        <div>
                          <p className="text-sm text-gray-600">Completed By</p>
                          <p className="font-medium">{selectedForm.completedBy}</p>
                        </div>
                      </div>
                      <div className="flex items-center space-x-2">
                        <div>
                          <p className="text-sm text-gray-600">Shift Date</p>
                          <p className="font-medium">{format(new Date(selectedForm.shiftDate), 'PPP')}</p>
                        </div>
                      </div>
                      <div className="flex items-center space-x-2">
                        <Badge variant={selectedForm.shiftType === 'Night Shift' ? 'secondary' : 'outline'}>
                          {selectedForm.shiftType}
                        </Badge>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                      <Card>
                        <CardContent className="p-4">
                          <div className="flex items-center space-x-2">
                            <div>
                              <p className="text-sm text-gray-600">Total Sales</p>
                              <p className="font-bold text-green-600">{formatCurrency(selectedForm.totalSales)}</p>
                            </div>
                          </div>
                        </CardContent>
                      </Card>

                      <Card>
                        <CardContent className="p-4">
                          <div className="flex items-center space-x-2">
                            <div>
                              <p className="text-sm text-gray-600">Total Expenses</p>
                              <p className="font-bold text-red-600">{formatCurrency(selectedForm.totalExpenses)}</p>
                            </div>
                          </div>
                        </CardContent>
                      </Card>

                      <Card>
                        <CardContent className="p-4">
                          <div className="flex items-center space-x-2">
                            <div>
                              <p className="text-sm text-gray-600">Starting Cash</p>
                              <p className="font-medium">{formatCurrency(selectedForm.startingCash)}</p>
                            </div>
                          </div>
                        </CardContent>
                      </Card>

                      <Card>
                        <CardContent className="p-4">
                          <div className="flex items-center space-x-2">
                            <div>
                              <p className="text-sm text-gray-600">Ending Cash</p>
                              <p className="font-medium">{formatCurrency(selectedForm.endingCash)}</p>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-4">
                    <h3 className="text-lg font-semibold">Search Results ({completedForms.length} forms found)</h3>
                    {completedForms.length === 0 ? (
                      <div className="text-center py-8">
                        <FileText className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                        <p className="text-gray-600">No forms found matching your search criteria</p>
                      </div>
                    ) : (
                      <div className="space-y-4">
                        {completedForms.map((formItem: DailyStockSales) => (
                          <div key={formItem.id} className="border rounded-lg p-4 hover:bg-gray-50">
                            <div className="flex justify-between items-start">
                              <div className="flex-1">
                                <div className="flex items-center space-x-4 mb-2">
                                  <h4 className="font-medium">{formItem.completedBy}</h4>
                                  <Badge variant={formItem.shiftType === 'Night Shift' ? 'secondary' : 'outline'}>
                                    {formItem.shiftType}
                                  </Badge>
                                  <span className="text-sm text-gray-600">
                                    {format(new Date(formItem.shiftDate), 'MMM dd, yyyy')}
                                  </span>
                                </div>
                                
                                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                                  <div>
                                    <span className="text-gray-600">Sales: </span>
                                    <span className="font-medium text-green-600">{formatCurrency(formItem.totalSales)}</span>
                                  </div>
                                  <div>
                                    <span className="text-gray-600">Expenses: </span>
                                    <span className="font-medium text-red-600">{formatCurrency(formItem.totalExpenses)}</span>
                                  </div>
                                  <div>
                                    <span className="text-gray-600">Wages: </span>
                                    <span className="font-medium">{(formItem.wageEntries as any[] || []).length} entries</span>
                                  </div>
                                  <div>
                                    <span className="text-gray-600">Shopping: </span>
                                    <span className="font-medium">{(formItem.shoppingEntries as any[] || []).length} items</span>
                                  </div>
                                </div>
                              </div>
                              
                              <div className="flex space-x-2">
                                <Button 
                                  variant="outline" 
                                  size="sm"
                                  onClick={() => setSelectedForm(formItem)}
                                  className="flex items-center space-x-1"
                                >
                                  <Eye className="h-4 w-4" />
                                  <span>View</span>
                                </Button>
                                <Button 
                                  variant="default" 
                                  size="sm"
                                  onClick={() => {
                                    // Load the selected form data into the form for editing
                                    form.reset({
                                      completedBy: formItem.completedBy,
                                      shiftType: formItem.shiftType,
                                      shiftDate: new Date(formItem.shiftDate),
                                      startingCash: formItem.startingCash || "0",
                                      endingCash: formItem.endingCash || "0",
                                      grabSales: formItem.grabSales || "0",
                                      foodPandaSales: formItem.foodPandaSales || "0",
                                      aroiDeeSales: formItem.aroiDeeSales || "0",
                                      qrScanSales: formItem.qrScanSales || "0",
                                      cashSales: formItem.cashSales || "0",
                                      totalSales: formItem.totalSales || "0",
                                      salaryWages: formItem.salaryWages || "0",
                                      shopping: formItem.shopping || "0",
                                      gasExpense: formItem.gasExpense || "0",
                                      totalExpenses: formItem.totalExpenses || "0",
                                      expenseDescription: formItem.expenseDescription || "",
                                      wageEntries: formItem.wageEntries || [],
                                      shoppingEntries: formItem.shoppingEntries || [],
                                      burgerBunsStock: formItem.burgerBunsStock || 0,
                                      rollsOrderedCount: formItem.rollsOrderedCount || 0,
                                      meatWeight: formItem.meatWeight || "0",
                                      rollsOrderedConfirmed: formItem.rollsOrderedConfirmed || false,
                                      freshFood: formItem.freshFood || Object.fromEntries(FRESH_FOOD_ITEMS.map(item => [item, 0])),
                                      frozenFood: formItem.frozenFood || Object.fromEntries(FROZEN_FOOD_ITEMS.map(item => [item, 0])),
                                      shelfItems: formItem.shelfItems || Object.fromEntries(SHELF_ITEMS.map(item => [item, 0])),
                                      foodItems: formItem.foodItems || {},
                                      drinkStock: formItem.drinkStock || Object.fromEntries(DRINK_ITEMS.map(item => [item, 0])),
                                      kitchenItems: formItem.kitchenItems || Object.fromEntries(KITCHEN_ITEMS.map(item => [item, 0])),
                                      packagingItems: formItem.packagingItems || Object.fromEntries(PACKAGING_ITEMS.map(item => [item, 0]))
                                    });
                                    setEditingFormId(formItem.id);
                                    setIsDraft(formItem.isDraft);
                                    // Switch to the New Form tab for editing
                                    setActiveTab('new-form');
                                    toast({
                                      title: "Form Loaded for Editing",
                                      description: "The form has been loaded into the editor. Make your changes and submit."
                                    });
                                  }}
                                  className="flex items-center space-x-1 bg-blue-500 hover:bg-blue-600 text-white"
                                >
                                  <Edit className="h-4 w-4" />
                                  <span>Edit</span>
                                </Button>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}