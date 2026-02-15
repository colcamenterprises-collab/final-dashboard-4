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
      <form onSubmit={form.handleSubmit((data) => onSubmit(data, drinkCounts))} className="space-y-4">
        <FormField control={form.control} name="staffName" render={({ field }) => (
          <FormItem><FormLabel>{L.staffName}</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
        )} />

        <p className="text-xs text-slate-500">{L.dateNote}</p>

        <div className="border rounded-lg overflow-hidden">
          {drinksLoading ? (
            <div className="p-4 text-center text-sm text-slate-500">{L.loading}</div>
          ) : drinkIngredients.length === 0 ? (
            <div className="p-4 text-center text-sm text-slate-500">{L.noDrinks}</div>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-slate-100 border-b">
                  <th className="text-left p-2 font-medium text-slate-700">{L.drinkType}</th>
                  <th className="text-right p-2 font-medium text-slate-700 w-24">{L.qty}</th>
                </tr>
              </thead>
              <tbody>
                {drinkIngredients.map((drink) => (
                  <tr key={drink.id} className="border-b last:border-b-0 hover:bg-slate-50">
                    <td className="p-2 text-slate-700">{drink.name}</td>
                    <td className="p-2">
                      <Input
                        type="number"
                        min="0"
                        value={drinkCounts[String(drink.id)] || ""}
                        onChange={(e) => setDrinkCounts((prev) => ({ ...prev, [String(drink.id)]: parseInt(e.target.value) || 0 }))}
                        className="h-8 text-sm text-right w-20 ml-auto"
                        data-testid={`input-drink-${drink.name.toLowerCase().replace(/\s+/g, "-")}`}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        <div className="flex gap-3 pt-4">
          {showCancel && <Button type="button" variant="outline" onClick={onCancel} className="flex-1">{L.cancel}</Button>}
          <Button type="submit" disabled={isSubmitting} className="flex-1">{isSubmitting ? L.saving : (submitText || L.lodgeDrinks)}</Button>
        </div>
      </form>
    </Form>
  );
}

export type { DrinksForm };
