import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { insertIngredientSchema, type Ingredient } from "@shared/schema";
import { z } from "zod";
import { Save, X, Calculator } from "lucide-react";
import { calculateIngredientCosts, THB, formatUnitPrice } from "@/utils/ingredientCalculations";
import { useMemo } from "react";

// Categories matching your spreadsheet
const INGREDIENT_CATEGORIES = [
  'Stock Items',
  'Fresh Food',
  'Frozen Food',
  'Shelf Items',
  'Drinks',
  'Kitchen Items',
  'Packaging Items'
];

// Suppliers from your spreadsheet
const SUPPLIER_OPTIONS = [
  'Makro',
  'Bakery',
  '7/11',
  'Supercheap',
  'Lotus',
  'Big C',
  'Printing Shop',
  'GO Wholesale',
  'Gas Supply',
  'Local Market',
  'Other'
];

// Brands from your spreadsheet
const BRAND_OPTIONS = [
  'Bakery',
  'Butcher',
  'Coke',
  'Schweppes',
  'Fanta',
  'Tipco',
  'Leo',
  'Nestle',
  'Sprite',
  'House Made',
  'Other'
];

// Measurements from your spreadsheet
const MEASUREMENT_OPTIONS = [
  'Each',
  'kg',
  'per kg',
  'grams',
  'kilograms',
  '6 Pack',
  'pieces',
  'units',
  'bottles',
  'cans',
  'packets',
  'bags',
  'boxes',
  'rolls',
  'sheets',
  'liters',
  'milliliters',
  'portions',
  'slices'
];

const ingredientFormSchema = insertIngredientSchema.extend({
  name: z.string().min(1, "Name is required"),
  category: z.string().min(1, "Category is required"),
  supplier: z.string().min(1, "Supplier is required"),
  packageQty: z.string().min(1, "Package quantity is required"),
  measurement: z.string().min(1, "Measurement is required"),
  costPerItem: z.coerce.number().min(0, "Cost per item must be positive"),
  unitPrice: z.coerce.number().min(0, "Unit price must be positive"),
  packageSize: z.string().min(1, "Package size is required"),
  unit: z.string().min(1, "Unit is required"),
});

interface IngredientFormProps {
  ingredient?: Ingredient;
  onSubmit: (data: any) => void;
  onCancel: () => void;
  isSubmitting?: boolean;
}

export function IngredientForm({ ingredient, onSubmit, onCancel, isSubmitting }: IngredientFormProps) {
  const form = useForm({
    resolver: zodResolver(ingredientFormSchema),
    defaultValues: {
      name: ingredient?.name || "",
      category: ingredient?.category || "",
      supplier: ingredient?.supplier || "",
      brand: ingredient?.brand || "",
      costPerItem: ingredient?.costPerItem || 0,
      packageQty: ingredient?.packageQty || "",
      measurement: ingredient?.measurement || "",
      minimumStockAmount: ingredient?.minimumStockAmount || "",
      servingSize: ingredient?.servingSize || "",
      // Legacy fields for backwards compatibility
      unitPrice: ingredient?.unitPrice || 0,
      packageSize: ingredient?.packageSize || "",
      unit: ingredient?.unit || "",
      notes: ingredient?.notes || "",
    },
  });
  
  // Watch form values for real-time calculations
  const watchedValues = form.watch();
  
  // Calculate real-time values
  const calculations = useMemo(() => {
    const costPerItem = watchedValues.costPerItem || 0;
    const packageQty = watchedValues.packageQty || '';
    const servingSize = watchedValues.servingSize || '';
    
    if (costPerItem > 0 && packageQty && servingSize) {
      try {
        const costString = `฿${costPerItem.toFixed(2)}`;
        return calculateIngredientCosts(costString, packageQty, servingSize);
      } catch (error) {
        console.warn('Calculation error:', error);
        return null;
      }
    }
    return null;
  }, [watchedValues.costPerItem, watchedValues.packageQty, watchedValues.servingSize]);

  const handleSubmit = (data: any) => {
    // Ensure unitPrice matches costPerItem for backwards compatibility
    const submissionData = {
      ...data,
      unitPrice: data.costPerItem,
      packageSize: data.packageQty,
      unit: data.measurement,
    };
    onSubmit(submissionData);
  };

  return (
    <Card className="w-full max-w-2xl">
      <CardHeader>
        <CardTitle className="text-lg font-semibold text-gray-900">
          {ingredient ? 'Edit Ingredient' : 'Add New Ingredient'}
        </CardTitle>
        <CardDescription>
          {ingredient ? 'Update ingredient details' : 'Complete all required fields to add a new ingredient'}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-6">
            {/* Basic Information */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Item Name *</FormLabel>
                    <FormControl>
                      <Input placeholder="e.g. Burger Buns Stock" {...field} />
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
                    <FormLabel>Category *</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select category" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {INGREDIENT_CATEGORIES.map((category) => (
                          <SelectItem key={category} value={category}>
                            {category}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            {/* Supplier and Brand */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="supplier"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Supplier *</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select supplier" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {SUPPLIER_OPTIONS.map((supplier) => (
                          <SelectItem key={supplier} value={supplier}>
                            {supplier}
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
                name="brand"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Brand</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select brand (optional)" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {BRAND_OPTIONS.map((brand) => (
                          <SelectItem key={brand} value={brand}>
                            {brand}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            {/* Cost and Package Info */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <FormField
                control={form.control}
                name="costPerItem"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Cost per Item (฿) *</FormLabel>
                    <FormControl>
                      <Input type="number" step="0.01" placeholder="0.00" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="packageQty"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Package Qty *</FormLabel>
                    <FormControl>
                      <Input placeholder="e.g. Each, 6 Pack" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="measurement"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Measurement *</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select measurement" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {MEASUREMENT_OPTIONS.map((measurement) => (
                          <SelectItem key={measurement} value={measurement}>
                            {measurement}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            {/* Stock and Serving Info */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="minimumStockAmount"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Minimum Stock Amount</FormLabel>
                    <FormControl>
                      <Input placeholder="e.g. 100, N/A" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="servingSize"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Serving Size (measurement)</FormLabel>
                    <FormControl>
                      <Input placeholder="e.g. 1, 90 grams, 20 grams" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            {/* Additional Notes */}
            <FormField
              control={form.control}
              name="notes"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Additional Notes</FormLabel>
                  <FormControl>
                    <Input placeholder="Any additional notes" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Real-Time Calculations Display */}
            {calculations && (
              <Card className="bg-blue-50 border-blue-200">
                <CardHeader className="pb-3">
                  <CardTitle className="text-lg flex items-center gap-2">
                    <Calculator className="h-5 w-5 text-blue-600" />
                    Live Calculations
                  </CardTitle>
                  <CardDescription className="text-sm">
                    Automatically calculated based on your inputs above
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label className="text-sm font-medium text-gray-700">Unit Price</Label>
                      <div className="p-3 bg-white rounded-md border">
                        <div className="font-mono text-lg font-semibold text-green-700">
                          {formatUnitPrice(calculations.unitPrice, calculations.packageSize.unit)}
                        </div>
                        <div className="text-xs text-gray-500">
                          Cost per {calculations.packageSize.unit}
                        </div>
                      </div>
                    </div>
                    
                    <div className="space-y-2">
                      <Label className="text-sm font-medium text-gray-700">Cost Per Portion</Label>
                      <div className="p-3 bg-white rounded-md border">
                        <div className="font-mono text-lg font-semibold text-orange-700">
                          {THB(calculations.costPerPortion)}
                        </div>
                        <div className="text-xs text-gray-500">
                          Per menu serving
                        </div>
                      </div>
                    </div>
                  </div>
                  
                  {calculations.calculationNote && (
                    <div className="p-3 bg-gray-50 rounded-md border-l-4 border-blue-400">
                      <div className="text-xs font-medium text-gray-700 mb-1">Calculation Details:</div>
                      <div className="text-xs text-gray-600 font-mono">
                        {calculations.calculationNote}
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            )}

            {/* Action Buttons */}
            <div className="flex justify-end space-x-2 pt-4">
              <Button 
                type="button" 
                variant="outline" 
                onClick={onCancel}
                className="w-full md:w-24"
              >
                <X className="h-4 w-4 mr-2" />
                Cancel
              </Button>
              <Button 
                type="submit" 
                disabled={isSubmitting}
                className="w-full md:w-32 bg-black text-white hover:bg-gray-800"
              >
                <Save className="h-4 w-4 mr-2" />
                {isSubmitting ? "Saving..." : ingredient ? "Update" : "Add"}
              </Button>
            </div>
          </form>
        </Form>
      </CardContent>
    </Card>
  );
}