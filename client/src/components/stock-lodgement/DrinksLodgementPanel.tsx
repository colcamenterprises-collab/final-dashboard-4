import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";

const drinksSchema = z.object({
  staffName: z.string().trim().min(1, "Staff Name is required"),
});

type DrinksForm = z.infer<typeof drinksSchema>;

export interface DrinkIngredient {
  id: number;
  name: string;
}

const labels = {
  en: {
    staffName: "Staff Name",
    dateNote: "Date and timestamp are recorded automatically (Asia/Bangkok) when submitted.",
    drinkType: "Drink Type",
    qty: "Qty",
    loading: "Loading drinks...",
    noDrinks: "No drink ingredients found",
    cancel: "Cancel",
    saving: "Saving...",
    lodgeDrinks: "Lodge Drinks",
  },
  th: {
    staffName: "ชื่อพนักงาน",
    dateNote: "วันที่และเวลาจะบันทึกอัตโนมัติ (เวลากรุงเทพฯ) เมื่อส่ง",
    drinkType: "ประเภทเครื่องดื่ม",
    qty: "จำนวน",
    loading: "กำลังโหลดเครื่องดื่ม...",
    noDrinks: "ไม่พบรายการเครื่องดื่ม",
    cancel: "ยกเลิก",
    saving: "กำลังบันทึก...",
    lodgeDrinks: "บันทึกเครื่องดื่ม",
  },
};

interface DrinksLodgementPanelProps {
  drinkIngredients: DrinkIngredient[];
  drinksLoading?: boolean;
  initialValues?: Partial<DrinksForm>;
  isSubmitting?: boolean;
  showCancel?: boolean;
  submitText?: string;
  onCancel?: () => void;
  onSubmit: (data: DrinksForm, drinkCounts: Record<string, number>) => void;
  lang?: "en" | "th";
}

export function DrinksLodgementPanel({
  drinkIngredients,
  drinksLoading,
  initialValues,
  isSubmitting,
  showCancel,
  submitText,
  onCancel,
  onSubmit,
  lang = "en",
}: DrinksLodgementPanelProps) {
  const L = labels[lang];
  const [drinkCounts, setDrinkCounts] = useState<Record<string, number>>({});

  const form = useForm<DrinksForm>({
    resolver: zodResolver(drinksSchema),
    defaultValues: {
      staffName: initialValues?.staffName || "",
    },
  });

  useEffect(() => {
    if (drinkIngredients.length > 0 && Object.keys(drinkCounts).length === 0) {
      setDrinkCounts(Object.fromEntries(drinkIngredients.map((d) => [String(d.id), 0])));
    }
  }, [drinkIngredients, drinkCounts]);

  useEffect(() => {
    if (!initialValues) return;
    form.reset({
      staffName: initialValues.staffName || "",
    });
    setDrinkCounts(Object.fromEntries(drinkIngredients.map((d) => [String(d.id), 0])));
  }, [initialValues, form, drinkIngredients]);

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit((data) => onSubmit(data, drinkCounts))} className="space-y-3">
        <FormField control={form.control} name="staffName" render={({ field }) => (
          <FormItem>
            <FormLabel className="text-xs text-slate-600">{L.staffName}</FormLabel>
            <FormControl><Input className="h-9 text-sm rounded-[4px]" {...field} /></FormControl>
            <FormMessage />
          </FormItem>
        )} />

        <p className="text-xs text-slate-500">{L.dateNote}</p>

        <div className="border border-slate-200 rounded-[4px] overflow-hidden">
          {drinksLoading ? (
            <div className="p-4 text-center text-xs text-slate-500">{L.loading}</div>
          ) : drinkIngredients.length === 0 ? (
            <div className="p-4 text-center text-xs text-slate-500">{L.noDrinks}</div>
          ) : (
            <table className="w-full">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200">
                  <th className="text-left px-2 py-1.5 text-xs font-medium text-slate-600">{L.drinkType}</th>
                  <th className="text-right px-2 py-1.5 text-xs font-medium text-slate-600 w-20">{L.qty}</th>
                </tr>
              </thead>
              <tbody>
                {drinkIngredients.map((drink) => (
                  <tr key={drink.id} className="border-b border-slate-200 last:border-b-0">
                    <td className="px-2 py-1 text-xs text-slate-700">{drink.name}</td>
                    <td className="px-2 py-1">
                      <Input
                        type="number"
                        min="0"
                        value={drinkCounts[String(drink.id)] || ""}
                        onChange={(e) => setDrinkCounts((prev) => ({ ...prev, [String(drink.id)]: parseInt(e.target.value) || 0 }))}
                        className="!h-7 text-xs text-right w-16 ml-auto rounded-[4px]"
                        data-testid={`input-drink-${drink.name.toLowerCase().replace(/\s+/g, "-")}`}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        <div className="flex gap-3 pt-3">
          {showCancel && <Button type="button" variant="outline" size="sm" onClick={onCancel} className="flex-1 !h-9 text-sm">{L.cancel}</Button>}
          <Button type="submit" disabled={isSubmitting} size="sm" className="flex-1 !h-9 text-sm bg-emerald-600 hover:bg-emerald-700 text-white">{isSubmitting ? L.saving : (submitText || L.lodgeDrinks)}</Button>
        </div>
      </form>
    </Form>
  );
}

export type { DrinksForm };
