import { useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Save, ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";

// Form schema for editing ingredients
const editIngredientSchema = z.object({
  name: z.string().min(1, "Name is required"),
  category: z.string().min(1, "Category is required"),
  supplier: z.string().min(1, "Supplier is required"),
  brand: z.string().optional(),
  packagingQty: z.string().optional(),
  cost: z.string().min(1, "Cost is required"),
  averageMenuPortion: z.string().optional(),
  lastReviewDate: z.string().optional(),
});

type EditIngredientForm = z.infer<typeof editIngredientSchema>;

export default function IngredientEdit() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Fetch ingredient data
  const { data: ingredient, isLoading } = useQuery({
    queryKey: [`/api/ingredients/${id}`],
    enabled: !!id,
  });

  const form = useForm<EditIngredientForm>({
    resolver: zodResolver(editIngredientSchema),
    defaultValues: {
      name: "",
      category: "",
      supplier: "",
      brand: "",
      packagingQty: "",
      cost: "",
      averageMenuPortion: "",
      lastReviewDate: "",
    },
  });

  // Update form when ingredient data loads
  useEffect(() => {
    if (ingredient) {
      form.reset({
        name: (ingredient as any).name || "",
        category: (ingredient as any).category || "",
        supplier: (ingredient as any).supplier || "",
        brand: (ingredient as any).brand || "",
        packagingQty: (ingredient as any).packagingQty || "",
        cost: (ingredient as any).unitPrice || "0",
        averageMenuPortion: (ingredient as any).averageMenuPortion || "",
        lastReviewDate: (ingredient as any).lastReviewDate || "",
      });
    }
  }, [ingredient, form]);

  const updateMutation = useMutation({
    mutationFn: async (data: EditIngredientForm) => {
      return apiRequest(`/api/ingredients/${id}`, {
        method: "PUT",
        body: JSON.stringify({
          ...data,
          lastReviewDate: new Date().toLocaleDateString('en-GB') // Update review date
        }),
      });
    },
    onSuccess: () => {
      toast({ title: "Success", description: "Ingredient updated successfully" });
      queryClient.invalidateQueries({ queryKey: ["/api/ingredients"] });
      navigate("/menu/ingredients");
    },
    onError: (error: any) => {
      console.error(error);
      toast({ title: "Error", description: error.message || "Failed to update ingredient", variant: "destructive" });
    }
  });

  const onSubmit = (data: EditIngredientForm) => {
    updateMutation.mutate(data);
  };

  if (isLoading) {
    return (
      <div className="container mx-auto p-6">
        <div className="text-center py-8">Loading ingredient...</div>
      </div>
    );
  }

  if (!ingredient) {
    return (
      <div className="container mx-auto p-6">
        <div className="text-center py-8 text-red-600">Ingredient not found</div>
      </div>
    );
  }

  const categories = ["Drinks", "Fresh Food", "Frozen Food", "Kitchen Supplies", "Packaging", "Shelf Items"];

  return (
    <div className="container mx-auto p-6">
      <div className="flex items-center gap-4 mb-6">
        <Button variant="outline" onClick={() => navigate("/menu/ingredients")}>
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to Ingredients
        </Button>
        <div>
          <h1 className="text-3xl font-bold">Edit Ingredient</h1>
          <p className="text-gray-600 mt-2">Update ingredient information</p>
        </div>
      </div>

      <div className="max-w-2xl">
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Item Name</FormLabel>
                    <FormControl>
                      <Input {...field} placeholder="Enter item name" />
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
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select category" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {categories.map((category) => (
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

              <FormField
                control={form.control}
                name="supplier"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Supplier</FormLabel>
                    <FormControl>
                      <Input {...field} placeholder="Enter supplier name" />
                    </FormControl>
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
                    <FormControl>
                      <Input {...field} placeholder="Enter brand name" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="packagingQty"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Packaging Qty</FormLabel>
                    <FormControl>
                      <Input {...field} placeholder="e.g., Per kg, 6 Cans" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="cost"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Cost (฿)</FormLabel>
                    <FormControl>
                      <Input {...field} type="number" step="0.01" placeholder="0.00" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="averageMenuPortion"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Average Menu Portion</FormLabel>
                    <FormControl>
                      <Input {...field} placeholder="e.g., 95g, Each" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="lastReviewDate"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Last Review Date</FormLabel>
                    <FormControl>
                      <Input {...field} placeholder="DD.MM.YY" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div className="flex gap-4">
              <Button type="submit" disabled={updateMutation.isPending}>
                <Save className="h-4 w-4 mr-2" />
                {updateMutation.isPending ? "Saving..." : "Save Changes"}
              </Button>
              <Button type="button" variant="outline" onClick={() => navigate("/menu/ingredients")}>
                Cancel
              </Button>
            </div>
          </form>
        </Form>
      </div>
    </div>
  );
}