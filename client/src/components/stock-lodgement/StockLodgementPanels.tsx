import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { RollsLodgementPanel, RollsForm } from "./RollsLodgementPanel";
import { MeatLodgementPanel, MeatForm } from "./MeatLodgementPanel";
import { DrinksLodgementPanel, DrinksForm, DrinkIngredient } from "./DrinksLodgementPanel";
import { FriesLodgementPanel, FriesForm } from "./FriesLodgementPanel";
import { SweetPotatoLodgementPanel, SweetPotatoForm } from "./SweetPotatoLodgementPanel";
import { useState } from "react";
import { CalendarDays } from "lucide-react";

type TabType = "rolls" | "meat" | "drinks" | "fries" | "sweetpotato";

interface StockInitialData {
  type: "rolls" | "meat" | "drinks";
  id?: number;
  quantity?: number;
  cost?: number;
  paid?: boolean;
  meatType?: string;
  weightKg?: number;
}

function getBangkokTodayDate(): string {
  return new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Bangkok' });
}

function getBangkokNowIso() {
  const now = new Date();
  const bkk = new Date(now.toLocaleString("en-US", { timeZone: "Asia/Bangkok" }));
  return bkk.toISOString();
}

function getMinBackdateDate(): string {
  const d = new Date();
  d.setDate(d.getDate() - 14);
  return d.toLocaleDateString('en-CA', { timeZone: 'Asia/Bangkok' });
}

const TAB_LABELS: { key: TabType; label: string }[] = [
  { key: "rolls", label: "Rolls" },
  { key: "meat", label: "Meat" },
  { key: "drinks", label: "Drinks" },
  { key: "fries", label: "Fries" },
  { key: "sweetpotato", label: "Sweet Potato" },
];

interface StockLodgementPanelsProps {
  mode: "tabs" | "columns";
  initialData?: StockInitialData;
  onSuccess?: () => void;
  onCancel?: () => void;
  lang?: "en" | "th";
}

export function StockLodgementPanels({ mode, initialData, onSuccess, onCancel, lang = "en" }: StockLodgementPanelsProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<TabType>(
    (initialData?.type as TabType) || "rolls"
  );
  const [effectiveDate, setEffectiveDate] = useState<string>(getBangkokTodayDate());
  const isEditMode = !!initialData?.id;

  const todayBkk = getBangkokTodayDate();
  const minDate = getMinBackdateDate();
  const isBackdated = effectiveDate !== todayBkk;

  const { data: drinkIngredients = [], isLoading: drinksLoading } = useQuery<DrinkIngredient[]>({
    queryKey: ["/api/purchasing/drinks"],
    queryFn: async () => {
      const res = await fetch("/api/purchasing/drinks");
      if (!res.ok) throw new Error("Failed to fetch drinks from purchasing list");
      const json = await res.json();
      return (json.items || []).map((item: any) => ({ id: item.id, name: item.name }));
    },
  });

  const stockMutation = useMutation({
    mutationFn: async (payload: any) => {
      const endpoint = isEditMode && initialData?.id ? `/api/expensesV2/stock/${initialData.id}` : "/api/expensesV2/stock";
      const method = isEditMode ? "PUT" : "POST";
      return apiRequest(endpoint, { method, body: JSON.stringify(payload) });
    },
    onSuccess: (_, variables) => {
      const labelMap: Record<string, string> = {
        rolls: "Rolls", meat: "Meat", drinks: "Drinks", fries: "Fries", sweetpotato: "Sweet Potato",
      };
      const stockType = labelMap[variables.type] || variables.type;
      const action = isEditMode ? "Updated" : "Lodged";
      const dateNote = variables.effectiveDate && variables.effectiveDate !== todayBkk ? ` for ${variables.effectiveDate}` : "";
      toast({ title: `${stockType} ${action} Successfully`, description: `Stock purchase has been ${isEditMode ? "updated" : "recorded"}${dateNote}`, variant: "success" as any, duration: 3000 });
      queryClient.invalidateQueries({ queryKey: ["/api/expensesV2/rolls"] });
      queryClient.invalidateQueries({ queryKey: ["/api/expensesV2/meat"] });
      queryClient.invalidateQueries({ queryKey: ["/api/expensesV2/drinks"] });
      queryClient.invalidateQueries({ queryKey: ["/api/purchase-tally"] });
      onSuccess?.();
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error?.message || `Failed to ${isEditMode ? "update" : "record"} stock lodgment`, variant: "destructive" });
    },
  });

  const submitRolls = (data: RollsForm) => stockMutation.mutate({ type: "rolls", quantity: data.quantity, cost: data.cost, paid: data.paid, submittedBy: data.staffName, submittedAt: getBangkokNowIso(), effectiveDate });
  const submitMeat = (data: MeatForm) => stockMutation.mutate({ type: "meat", meatType: data.meatType, weightKg: data.weightKg, submittedBy: data.staffName, submittedAt: getBangkokNowIso(), effectiveDate });
  const submitFries = (data: FriesForm) => stockMutation.mutate({ type: "fries", friesGrams: data.friesGrams, submittedBy: data.staffName, submittedAt: getBangkokNowIso(), effectiveDate });
  const submitSweetPotato = (data: SweetPotatoForm) => stockMutation.mutate({ type: "sweetpotato", sweetPotatoGrams: data.sweetPotatoGrams, submittedBy: data.staffName, submittedAt: getBangkokNowIso(), effectiveDate });

  const submitDrinks = (data: DrinksForm, drinkCounts: Record<string, number>) => {
    const items = Object.entries(drinkCounts).filter(([_, qty]) => qty > 0).map(([ingredientId, quantity]) => {
      const ingredient = drinkIngredients.find((d) => String(d.id) === ingredientId);
      return { type: ingredient?.name || ingredientId, ingredientId: parseInt(ingredientId), quantity };
    });
    if (items.length === 0) {
      toast({ title: "No drinks entered", description: "Enter at least one drink quantity", variant: "destructive" });
      return;
    }
    stockMutation.mutate({ type: "drinks", items, submittedBy: data.staffName, submittedAt: getBangkokNowIso(), effectiveDate });
  };

  const panelProps = { isSubmitting: stockMutation.isPending, showCancel: mode === "tabs", onCancel, lang };

  const effectiveDatePicker = !isEditMode && (
    <div className="mb-4 rounded-[4px] border border-slate-200 bg-white p-3">
      <div className="flex items-center gap-2 mb-1.5">
        <CalendarDays className="h-3.5 w-3.5 text-slate-500" />
        <label className="text-xs font-medium text-slate-700">Effective Date</label>
        {isBackdated && (
          <span className="ml-auto text-[10px] font-medium text-amber-600 bg-amber-50 border border-amber-200 rounded px-1.5 py-0.5">
            Backdated
          </span>
        )}
      </div>
      <input
        type="date"
        value={effectiveDate}
        min={minDate}
        max={todayBkk}
        onChange={(e) => setEffectiveDate(e.target.value || todayBkk)}
        className="w-full rounded-[4px] border border-slate-200 bg-white px-2.5 py-1.5 text-xs text-slate-900 focus:outline-none focus:ring-1 focus:ring-emerald-500 focus:border-emerald-500"
      />
      <p className="mt-1.5 text-[10px] text-slate-500">
        Leave as today unless entering historical stock. Max 14 days back.
      </p>
    </div>
  );

  if (mode === "columns") {
    return (
      <div>
        {effectiveDatePicker}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4" data-testid="homepage-stock-lodgement-grid">
          <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm"><h2 className="text-sm font-semibold text-slate-900 mb-3">Rolls</h2><RollsLodgementPanel {...panelProps} onSubmit={submitRolls} /></div>
          <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm"><h2 className="text-sm font-semibold text-slate-900 mb-3">Meat</h2><MeatLodgementPanel {...panelProps} onSubmit={submitMeat} /></div>
          <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm"><h2 className="text-sm font-semibold text-slate-900 mb-3">Drinks</h2><DrinksLodgementPanel {...panelProps} drinkIngredients={drinkIngredients} drinksLoading={drinksLoading} onSubmit={submitDrinks} /></div>
        </div>
      </div>
    );
  }

  return (
    <>
      {effectiveDatePicker}
      <div className="flex flex-wrap border-b border-slate-200 mb-4">
        {TAB_LABELS.map(({ key, label }) => (
          <button
            key={key}
            type="button"
            onClick={() => setActiveTab(key)}
            className={`px-4 py-2 text-sm ${activeTab === key ? "border-b-2 border-emerald-600 text-emerald-600 font-medium" : "text-slate-600 hover:text-slate-800"}`}
          >
            {label}
          </button>
        ))}
      </div>
      {activeTab === "rolls" && <RollsLodgementPanel {...panelProps} initialValues={initialData?.type === "rolls" ? { quantity: initialData.quantity, cost: initialData.cost, paid: initialData.paid } : undefined} onSubmit={submitRolls} />}
      {activeTab === "meat" && <MeatLodgementPanel {...panelProps} initialValues={initialData?.type === "meat" ? { meatType: initialData.meatType, weightKg: initialData.weightKg } : undefined} onSubmit={submitMeat} />}
      {activeTab === "drinks" && <DrinksLodgementPanel {...panelProps} initialValues={initialData?.type === "drinks" ? {} : undefined} drinkIngredients={drinkIngredients} drinksLoading={drinksLoading} onSubmit={submitDrinks} />}
      {activeTab === "fries" && <FriesLodgementPanel {...panelProps} onSubmit={submitFries} />}
      {activeTab === "sweetpotato" && <SweetPotatoLodgementPanel {...panelProps} onSubmit={submitSweetPotato} />}
    </>
  );
}
