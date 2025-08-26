import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMutation, useQueryClient, useQuery } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { Plus, X } from "lucide-react";

type DrinkLine = { name: string; qty: number };

const drinkItemSchema = z.object({
  itemName: z.string().min(1, "Item name is required"),
  qty: z.number().min(1, "Quantity must be at least 1"),
  unit: z.string().default("pcs"),
});

const purchaseTallySchema = z.object({
  date: z.string().min(1, "Date is required"),
  supplier: z.string().optional(),
  amountTHB: z.string().optional(),
  rollsPcs: z.string().optional(),
  meatGrams: z.string().optional(), 
  notes: z.string().optional(),
  staff: z.string().optional(),
  drinks: z.array(drinkItemSchema).default([]),
});

type PurchaseTallyForm = z.infer<typeof purchaseTallySchema>;
type DrinkItem = z.infer<typeof drinkItemSchema>;

interface PurchaseTallyModalProps {
  open: boolean;
  onClose: () => void;
  entry?: any; // For editing existing entries
}

export function PurchaseTallyModal({ open, onClose, entry }: PurchaseTallyModalProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [drinks, setDrinks] = useState<DrinkLine[]>([{ name: "", qty: 0 }]);

  const addDrinkItem = () => setDrinks((d) => [...d, { name: "", qty: 0 }]);
  const removeDrinkItem = (idx: number) =>
    setDrinks((d) => d.filter((_, i) => i !== idx));
  const setDrinkItem = (idx: number, key: keyof DrinkLine, val: string | number) =>
    setDrinks((d) => d.map((r, i) => (i === idx ? { ...r, [key]: val } : r)));

  // Get drinks from ingredient catalog
  const { data: ingredientsData } = useQuery({
    queryKey: ["/api/costing/ingredients"],
    queryFn: () => apiRequest("/api/costing/ingredients"),
  });

  const drinkOptions = ingredientsData?.list?.filter((item: any) => item.category === "Drinks") || [];

  const form = useForm<PurchaseTallyForm>({
    resolver: zodResolver(purchaseTallySchema),
    defaultValues: {
      date: entry?.date || new Date().toISOString().split('T')[0],
      supplier: entry?.supplier || "",
      amountTHB: entry?.amountTHB || "",
      rollsPcs: entry?.rollsPcs?.toString() || "",
      meatGrams: entry?.meatGrams?.toString() || "",
      notes: entry?.notes || "",
      staff: entry?.staff || "",
      drinks: [],
    },
  });

  // Parse drinks from notes (DRINKS:JSON format)
  function parseDrinkItems(notes?: string | null): DrinkLine[] {
    if (!notes) return [{ name: "", qty: 0 }];
    const tag = "DRINKS:";
    const at = notes.indexOf(tag);
    if (at < 0) return [{ name: "", qty: 0 }];
    try {
      const json = notes.substring(at + tag.length).split('\n')[0].trim();
      return JSON.parse(json);
    } catch {
      return [{ name: "", qty: 0 }];
    }
  }

  // Initialize drinks when entry changes or modal opens
  useEffect(() => {
    if (entry?.notes) {
      const parsedDrinks = parseDrinkItems(entry.notes);
      setDrinks(parsedDrinks.length > 0 ? parsedDrinks : [{ name: "", qty: 0 }]);
    } else {
      setDrinks([{ name: "", qty: 0 }]);
    }
  }, [entry]);

  const createMutation = useMutation({
    mutationFn: async (data: any) => {
      return apiRequest("/api/purchase-tally", {
        method: "POST",
        body: JSON.stringify(data),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/purchase-tally"] });
      toast({
        title: "Success",
        description: "Purchase tally created successfully",
      });
      onClose();
      form.reset();
      setDrinks([{ name: "", qty: 0 }]);
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to create purchase tally",
        variant: "destructive",
      });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async (data: any) => {
      return apiRequest(`/api/purchase-tally/${entry.id}`, {
        method: "PUT",
        body: JSON.stringify(data),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/purchase-tally"] });
      toast({
        title: "Success",
        description: "Purchase tally updated successfully",
      });
      onClose();
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to update purchase tally",
        variant: "destructive",
      });
    },
  });

  const onSubmit = (data: PurchaseTallyForm) => {
    // Filter out empty drinks
    const cleanDrinks = drinks.filter(d => d.name && d.qty > 0);
    
    // Embed drinks into notes as JSON
    const drinksTag = cleanDrinks.length ? `DRINKS:${JSON.stringify(cleanDrinks)}` : "";
    const notesWithDrinks = data.notes ? `${data.notes}\n${drinksTag}` : drinksTag;
    
    // Prepare the payload
    const payload = {
      ...data,
      notes: notesWithDrinks,
      // Keep legacy total for backwards compatibility
      drinks: cleanDrinks.reduce((sum, d) => sum + d.qty, 0),
      amountTHB: data.amountTHB ? parseFloat(data.amountTHB) : undefined,
      rollsPcs: data.rollsPcs ? parseInt(data.rollsPcs) : undefined,
      meatGrams: data.meatGrams ? parseInt(data.meatGrams) : undefined,
    };

    if (entry) {
      updateMutation.mutate(payload);
    } else {
      createMutation.mutate(payload);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {entry ? "Edit Purchase Tally" : "Add Purchase Tally"}
          </DialogTitle>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="date"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Date *</FormLabel>
                    <FormControl>
                      <Input type="date" {...field} />
                    </FormControl>
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
                      <Input placeholder="e.g., Makro, 7-Eleven" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="amountTHB"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Amount (THB)</FormLabel>
                    <FormControl>
                      <Input type="number" step="0.01" placeholder="0.00" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="staff"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Staff</FormLabel>
                    <FormControl>
                      <Input placeholder="Staff member name" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="rollsPcs"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Rolls (pcs)</FormLabel>
                    <FormControl>
                      <Input type="number" placeholder="0" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="meatGrams"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Meat (grams)</FormLabel>
                    <FormControl>
                      <Input type="number" placeholder="0" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            {/* Itemized Drinks Section */}
            <div className="space-y-3">
              <label className="block text-sm font-medium">
                Drinks (itemized)
              </label>

              {drinks.map((row, i) => (
                <div key={i} className="flex gap-2 items-center">
                  <Input
                    className="flex-1"
                    placeholder="e.g., Coke"
                    value={row.name}
                    onChange={(e) => setDrinkItem(i, "name", e.target.value)}
                    list={`drink-options-${i}`}
                  />
                  <datalist id={`drink-options-${i}`}>
                    {drinkOptions.map((drink: any) => (
                      <option key={drink.id} value={drink.name} />
                    ))}
                  </datalist>
                  <Input
                    type="number"
                    className="w-24"
                    placeholder="0"
                    value={row.qty || ''}
                    onChange={(e) => setDrinkItem(i, "qty", Number(e.target.value || 0))}
                    min={0}
                  />
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => removeDrinkItem(i)}
                    disabled={drinks.length === 1}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              ))}

              <Button 
                type="button" 
                variant="ghost" 
                size="sm" 
                onClick={addDrinkItem}
                className="text-sm text-blue-600 hover:text-blue-800"
              >
                <Plus className="h-4 w-4 mr-1" />
                Add drink
              </Button>
            </div>

            <FormField
              control={form.control}
              name="notes"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Notes</FormLabel>
                  <FormControl>
                    <Textarea 
                      placeholder="Additional notes..." 
                      {...field} 
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="flex justify-end gap-2 pt-4">
              <Button type="button" variant="outline" onClick={onClose}>
                Cancel
              </Button>
              <Button 
                type="submit" 
                disabled={createMutation.isPending || updateMutation.isPending}
              >
                {createMutation.isPending || updateMutation.isPending ? "Saving..." : 
                 entry ? "Update" : "Create"}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}