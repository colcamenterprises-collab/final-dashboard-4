/**
 * K4/K5: Manual Stock Purchase Page
 * Purchasing = items, Finance = money
 * Table-based multi-entry for efficient stock logging
 */
import { useState, useEffect } from "react";
import { useMutation, useQueryClient, useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { Package, Save, RefreshCw } from "lucide-react";

type DrinkItem = {
  name: string;
  quantity: number;
};

type PurchasingItem = {
  id: number;
  item: string;
  category: string | null;
};

const DRINK_ITEMS = [
  "Coke", "Coke Zero", "Sprite", "Schweppes Manow", "Fanta Orange", 
  "Fanta Strawberry", "Singha Red Soda", "Singha Yellow Soda", "Singha Pink Soda", 
  "Soda Water", "Bottled Water", "Kids Juice (Orange)", "Kids Juice (Apple)"
];

export default function ManualStockPurchase() {
  const [activeTab, setActiveTab] = useState<"rolls" | "meat" | "drinks">("rolls");
  const [date, setDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [rollsQty, setRollsQty] = useState(0);
  const [rollsCost, setRollsCost] = useState(0);
  const [rollsPaid, setRollsPaid] = useState(false);
  const [meatWeightKg, setMeatWeightKg] = useState(0);
  const [meatCost, setMeatCost] = useState(0);
  const [meatPaid, setMeatPaid] = useState(false);
  const [drinks, setDrinks] = useState<DrinkItem[]>(
    DRINK_ITEMS.map(name => ({ name, quantity: 0 }))
  );
  const [drinksCost, setDrinksCost] = useState(0);
  const [drinksPaid, setDrinksPaid] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: purchasingItems } = useQuery<PurchasingItem[]>({
    queryKey: ["/api/purchasing-items"],
  });

  const submitMutation = useMutation({
    mutationFn: async (data: {
      type: "rolls" | "meat" | "drinks";
      date: string;
      items?: { name: string; quantity: number }[];
      quantity?: number;
      weightKg?: number;
      cost?: number;
      paid?: boolean;
    }) => {
      return apiRequest("/api/stock/manual-purchase", {
        method: "POST",
        body: JSON.stringify(data),
      });
    },
    onSuccess: () => {
      toast({
        title: "Success",
        description: "Stock purchase logged successfully",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/purchasing-shift-log"] });
      resetForm();
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to log stock purchase",
        variant: "destructive",
      });
    },
  });

  const resetForm = () => {
    setRollsQty(0);
    setRollsCost(0);
    setRollsPaid(false);
    setMeatWeightKg(0);
    setMeatCost(0);
    setMeatPaid(false);
    setDrinks(DRINK_ITEMS.map(name => ({ name, quantity: 0 })));
    setDrinksCost(0);
    setDrinksPaid(false);
  };

  const handleDrinkQtyChange = (drinkName: string, qty: number) => {
    setDrinks(prev => prev.map(d => 
      d.name === drinkName ? { ...d, quantity: qty } : d
    ));
  };

  const handleSubmitRolls = () => {
    if (rollsQty <= 0) {
      toast({ title: "Error", description: "Quantity must be greater than 0", variant: "destructive" });
      return;
    }
    submitMutation.mutate({
      type: "rolls",
      date,
      quantity: rollsQty,
      cost: rollsCost,
      paid: rollsPaid,
    });
  };

  const handleSubmitMeat = () => {
    if (meatWeightKg <= 0) {
      toast({ title: "Error", description: "Weight must be greater than 0", variant: "destructive" });
      return;
    }
    submitMutation.mutate({
      type: "meat",
      date,
      weightKg: meatWeightKg,
      cost: meatCost,
      paid: meatPaid,
    });
  };

  const handleSubmitDrinks = () => {
    const itemsWithQty = drinks.filter(d => d.quantity > 0);
    if (itemsWithQty.length === 0) {
      toast({ title: "Error", description: "At least one drink must have quantity > 0", variant: "destructive" });
      return;
    }
    submitMutation.mutate({
      type: "drinks",
      date,
      items: itemsWithQty,
      cost: drinksCost,
      paid: drinksPaid,
    });
  };

  const totalDrinksQty = drinks.reduce((sum, d) => sum + d.quantity, 0);

  return (
    <div className="p-4 space-y-4">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">
            Manual Stock Purchase
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Log rolls, meat, and drinks purchases in one submission
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Label htmlFor="date" className="text-xs">Date:</Label>
          <Input
            id="date"
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="w-40 text-xs"
            data-testid="input-date"
          />
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as "rolls" | "meat" | "drinks")}>
        <TabsList className="grid w-full grid-cols-3 mb-4">
          <TabsTrigger value="rolls" data-testid="tab-rolls">Rolls</TabsTrigger>
          <TabsTrigger value="meat" data-testid="tab-meat">Meat</TabsTrigger>
          <TabsTrigger value="drinks" data-testid="tab-drinks">Drinks</TabsTrigger>
        </TabsList>

        <TabsContent value="rolls">
          <Card className="rounded-[4px] border-slate-200">
            <CardHeader className="py-3 px-4 bg-slate-50 border-b border-slate-200">
              <CardTitle className="text-sm font-semibold">Burger Buns / Rolls</CardTitle>
            </CardHeader>
            <CardContent className="p-4 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-xs">Quantity (units)</Label>
                  <Input
                    type="number"
                    value={rollsQty || ""}
                    onChange={(e) => setRollsQty(parseInt(e.target.value) || 0)}
                    placeholder="0"
                    className="text-sm"
                    data-testid="input-rolls-qty"
                  />
                </div>
                <div>
                  <Label className="text-xs">Cost (THB)</Label>
                  <Input
                    type="number"
                    value={rollsCost || ""}
                    onChange={(e) => setRollsCost(parseFloat(e.target.value) || 0)}
                    placeholder="0"
                    className="text-sm"
                    data-testid="input-rolls-cost"
                  />
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Switch
                  checked={rollsPaid}
                  onCheckedChange={setRollsPaid}
                  data-testid="switch-rolls-paid"
                />
                <Label className="text-xs">Mark as paid (create expense entry)</Label>
              </div>
              <Button
                onClick={handleSubmitRolls}
                disabled={submitMutation.isPending || rollsQty <= 0}
                className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs"
                data-testid="button-submit-rolls"
              >
                <Save className="h-4 w-4 mr-1" />
                Log Rolls Purchase
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="meat">
          <Card className="rounded-[4px] border-slate-200">
            <CardHeader className="py-3 px-4 bg-slate-50 border-b border-slate-200">
              <CardTitle className="text-sm font-semibold">Meat Purchase</CardTitle>
            </CardHeader>
            <CardContent className="p-4 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-xs">Weight (kg)</Label>
                  <Input
                    type="number"
                    step="0.1"
                    value={meatWeightKg || ""}
                    onChange={(e) => setMeatWeightKg(parseFloat(e.target.value) || 0)}
                    placeholder="0"
                    className="text-sm"
                    data-testid="input-meat-weight"
                  />
                </div>
                <div>
                  <Label className="text-xs">Cost (THB)</Label>
                  <Input
                    type="number"
                    value={meatCost || ""}
                    onChange={(e) => setMeatCost(parseFloat(e.target.value) || 0)}
                    placeholder="0"
                    className="text-sm"
                    data-testid="input-meat-cost"
                  />
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Switch
                  checked={meatPaid}
                  onCheckedChange={setMeatPaid}
                  data-testid="switch-meat-paid"
                />
                <Label className="text-xs">Mark as paid (create expense entry)</Label>
              </div>
              <Button
                onClick={handleSubmitMeat}
                disabled={submitMutation.isPending || meatWeightKg <= 0}
                className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs"
                data-testid="button-submit-meat"
              >
                <Save className="h-4 w-4 mr-1" />
                Log Meat Purchase
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="drinks">
          <Card className="rounded-[4px] border-slate-200">
            <CardHeader className="py-3 px-4 bg-slate-50 border-b border-slate-200">
              <CardTitle className="text-sm font-semibold flex justify-between items-center">
                <span>Drinks Purchase</span>
                <span className="text-xs font-normal text-slate-500">
                  Total: {totalDrinksQty} items
                </span>
              </CardTitle>
            </CardHeader>
            <CardContent className="p-4 space-y-4">
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {drinks.map((drink) => (
                  <div key={drink.name} className="flex items-center gap-2">
                    <Label className="text-xs flex-1 truncate" title={drink.name}>{drink.name}</Label>
                    <Input
                      type="number"
                      value={drink.quantity || ""}
                      onChange={(e) => handleDrinkQtyChange(drink.name, parseInt(e.target.value) || 0)}
                      placeholder="0"
                      className="w-16 text-xs text-center"
                      data-testid={`input-drink-${drink.name.replace(/\s+/g, '-').toLowerCase()}`}
                    />
                  </div>
                ))}
              </div>
              <div className="grid grid-cols-2 gap-4 pt-2 border-t border-slate-200">
                <div>
                  <Label className="text-xs">Total Cost (THB)</Label>
                  <Input
                    type="number"
                    value={drinksCost || ""}
                    onChange={(e) => setDrinksCost(parseFloat(e.target.value) || 0)}
                    placeholder="0"
                    className="text-sm"
                    data-testid="input-drinks-cost"
                  />
                </div>
                <div className="flex items-center gap-2 pt-5">
                  <Switch
                    checked={drinksPaid}
                    onCheckedChange={setDrinksPaid}
                    data-testid="switch-drinks-paid"
                  />
                  <Label className="text-xs">Mark as paid</Label>
                </div>
              </div>
              <Button
                onClick={handleSubmitDrinks}
                disabled={submitMutation.isPending || totalDrinksQty <= 0}
                className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs"
                data-testid="button-submit-drinks"
              >
                <Save className="h-4 w-4 mr-1" />
                Log All Drinks ({totalDrinksQty} items)
              </Button>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
