/**
 * 🔒 PATCH S1: STOCK RECEIVED MODAL
 * Unified stock logging for Rolls, Meat, and Drinks
 * 
 * RULES:
 * - Rolls: qty + optional expense toggle
 * - Meat: type + weight (NO expense)
 * - Drinks: qty only (NO expense, NO SKU)
 * - All entries feed analysis tables
 */
import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { Package, Beef, GlassWater } from "lucide-react";

const MEAT_TYPES = ["Topside", "Chuck", "Brisket", "Rump", "Outside", "Mixed"];

const DRINKS = [
  "Coke",
  "Coke Zero",
  "Sprite",
  "Fanta Orange",
  "Fanta Strawberry",
  "Soda Water",
  "Bottled Water",
  "Kids Juice (Apple)",
  "Kids Juice (Orange)",
];

interface StockReceivedModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function StockReceivedModal({ isOpen, onClose }: StockReceivedModalProps) {
  const [activeTab, setActiveTab] = useState<"rolls" | "meat" | "drinks">("rolls");
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [rollsQty, setRollsQty] = useState(0);
  const [rollsPaid, setRollsPaid] = useState(false);

  const [meatType, setMeatType] = useState("");
  const [meatWeightKg, setMeatWeightKg] = useState(0);

  const [drinkCounts, setDrinkCounts] = useState<Record<string, number>>(
    Object.fromEntries(DRINKS.map((d) => [d, 0]))
  );

  const rollsMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/stock/rolls", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ qty: rollsQty, paid: rollsPaid }),
      });
      if (!res.ok) throw new Error("Failed to log rolls");
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "Rolls logged", description: `${rollsQty} rolls recorded` });
      setRollsQty(0);
      setRollsPaid(false);
      queryClient.invalidateQueries({ queryKey: ["/api/stock"] });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to log rolls", variant: "destructive" });
    },
  });

  const meatMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/stock/meat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: meatType, weightKg: meatWeightKg }),
      });
      if (!res.ok) throw new Error("Failed to log meat");
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "Meat logged", description: `${meatWeightKg}kg ${meatType} recorded` });
      setMeatType("");
      setMeatWeightKg(0);
      queryClient.invalidateQueries({ queryKey: ["/api/stock"] });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to log meat", variant: "destructive" });
    },
  });

  const drinksMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/stock/drinks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ counts: drinkCounts }),
      });
      if (!res.ok) throw new Error("Failed to log drinks");
      return res.json();
    },
    onSuccess: () => {
      const totalDrinks = Object.values(drinkCounts).reduce((a, b) => a + b, 0);
      toast({ title: "Drinks logged", description: `${totalDrinks} drinks recorded` });
      setDrinkCounts(Object.fromEntries(DRINKS.map((d) => [d, 0])));
      queryClient.invalidateQueries({ queryKey: ["/api/stock"] });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to log drinks", variant: "destructive" });
    },
  });

  const handleSubmitRolls = () => {
    if (rollsQty <= 0) {
      toast({ title: "Invalid quantity", description: "Enter a positive number", variant: "destructive" });
      return;
    }
    rollsMutation.mutate();
  };

  const handleSubmitMeat = () => {
    if (!meatType) {
      toast({ title: "Select meat type", description: "Please select a meat type", variant: "destructive" });
      return;
    }
    if (meatWeightKg <= 0) {
      toast({ title: "Invalid weight", description: "Enter a positive weight", variant: "destructive" });
      return;
    }
    meatMutation.mutate();
  };

  const handleSubmitDrinks = () => {
    const total = Object.values(drinkCounts).reduce((a, b) => a + b, 0);
    if (total <= 0) {
      toast({ title: "No drinks entered", description: "Enter at least one drink quantity", variant: "destructive" });
      return;
    }
    drinksMutation.mutate();
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-md w-[calc(100vw-32px)] mx-auto">
        <DialogHeader>
          <DialogTitle className="text-sm font-semibold">Log Stock Received</DialogTitle>
        </DialogHeader>

        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as any)}>
          <TabsList className="flex w-full h-auto p-1 gap-1">
            <TabsTrigger 
              value="rolls" 
              className="flex-1 text-xs py-2 px-2 min-h-[36px] flex items-center justify-center gap-1" 
              data-testid="tab-rolls"
            >
              <Package className="h-3 w-3 shrink-0" />
              <span>Rolls</span>
            </TabsTrigger>
            <TabsTrigger 
              value="meat" 
              className="flex-1 text-xs py-2 px-2 min-h-[36px] flex items-center justify-center gap-1" 
              data-testid="tab-meat"
            >
              <Beef className="h-3 w-3 shrink-0" />
              <span>Meat</span>
            </TabsTrigger>
            <TabsTrigger 
              value="drinks" 
              className="flex-1 text-xs py-2 px-2 min-h-[36px] flex items-center justify-center gap-1" 
              data-testid="tab-drinks"
            >
              <GlassWater className="h-3 w-3 shrink-0" />
              <span>Drinks</span>
            </TabsTrigger>
          </TabsList>

          <TabsContent value="rolls" className="space-y-4 pt-4">
            <div>
              <Label className="text-xs">Quantity (packs)</Label>
              <Input
                type="number"
                value={rollsQty || ""}
                onChange={(e) => setRollsQty(Number(e.target.value))}
                placeholder="Enter quantity"
                className="text-xs h-8 rounded-[4px]"
                data-testid="input-rolls-qty"
              />
            </div>
            <div className="flex items-center gap-2">
              <Switch
                checked={rollsPaid}
                onCheckedChange={setRollsPaid}
                data-testid="switch-rolls-paid"
              />
              <Label className="text-xs">Paid at purchase (create expense)</Label>
            </div>
            <Button
              onClick={handleSubmitRolls}
              disabled={rollsMutation.isPending}
              className="w-full text-xs h-8 rounded-[4px]"
              data-testid="button-log-rolls"
            >
              {rollsMutation.isPending ? "Logging..." : "Log Rolls"}
            </Button>
          </TabsContent>

          <TabsContent value="meat" className="space-y-4 pt-4">
            <div>
              <Label className="text-xs">Meat Type</Label>
              <Select value={meatType} onValueChange={setMeatType}>
                <SelectTrigger className="text-xs h-8 rounded-[4px]" data-testid="select-meat-type">
                  <SelectValue placeholder="Select meat type" />
                </SelectTrigger>
                <SelectContent>
                  {MEAT_TYPES.map((type) => (
                    <SelectItem key={type} value={type} className="text-xs">
                      {type}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">Weight (kg)</Label>
              <Input
                type="number"
                step="0.1"
                value={meatWeightKg || ""}
                onChange={(e) => setMeatWeightKg(Number(e.target.value))}
                placeholder="Enter weight in kg"
                className="text-xs h-8 rounded-[4px]"
                data-testid="input-meat-weight"
              />
            </div>
            <Button
              onClick={handleSubmitMeat}
              disabled={meatMutation.isPending}
              className="w-full text-xs h-8 rounded-[4px]"
              data-testid="button-log-meat"
            >
              {meatMutation.isPending ? "Logging..." : "Log Meat"}
            </Button>
          </TabsContent>

          <TabsContent value="drinks" className="space-y-3 pt-4">
            <div className="max-h-[300px] overflow-y-auto space-y-2">
              {DRINKS.map((drink) => (
                <div key={drink} className="flex items-center justify-between gap-2">
                  <Label className="text-xs flex-1">{drink}</Label>
                  <Input
                    type="number"
                    value={drinkCounts[drink] || ""}
                    onChange={(e) =>
                      setDrinkCounts({ ...drinkCounts, [drink]: Number(e.target.value) })
                    }
                    className="text-xs h-7 w-20 rounded-[4px]"
                    data-testid={`input-drink-${drink.toLowerCase().replace(/\s+/g, "-")}`}
                  />
                </div>
              ))}
            </div>
            <Button
              onClick={handleSubmitDrinks}
              disabled={drinksMutation.isPending}
              className="w-full text-xs h-8 rounded-[4px]"
              data-testid="button-log-drinks"
            >
              {drinksMutation.isPending ? "Logging..." : "Log Drinks"}
            </Button>
          </TabsContent>
        </Tabs>

        <div className="pt-2">
          <Button variant="outline" onClick={onClose} className="w-full text-xs h-8 rounded-[4px]">
            Close
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default StockReceivedModal;
