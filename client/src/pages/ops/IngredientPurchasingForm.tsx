import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Link, useNavigate, useParams } from "react-router-dom";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import {
  validateAndDeriveIngredientAuthority,
  allowedUnits,
  type IngredientAuthorityInvalidReason,
  type Unit,
} from "@/utils/ingredientAuthority";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

type IngredientAuthorityRecord = {
  id: number;
  name: string;
  category: string;
  supplier: string;
  purchaseQuantity: number;
  purchaseUnit: Unit;
  purchaseCostThb: number;
  portionQuantity: number;
  portionUnit: Unit;
  conversionFactor: number | null;
  isActive: boolean;
  updatedAt: string;
  derived: {
    portionsPerPurchase: number;
    costPerPortion: number;
    costPerBaseUnit: number | null;
    baseUnit: Unit;
    conversionNotes: string[];
  } | null;
  validation: {
    valid: boolean;
    errors: string[];
  };
};

type FormState = {
  name: string;
  category: string;
  supplier: string;
  purchaseQuantity: string;
  purchaseUnit: Unit | "";
  purchaseCostThb: string;
  portionQuantity: string;
  portionUnit: Unit | "";
  conversionFactor: string;
  isActive: boolean;
};

const emptyForm: FormState = {
  name: "",
  category: "",
  supplier: "",
  purchaseQuantity: "",
  purchaseUnit: "",
  purchaseCostThb: "",
  portionQuantity: "",
  portionUnit: "",
  conversionFactor: "",
  isActive: true,
};

const formatNumber = (value: number, digits = 2) =>
  value.toLocaleString("en-TH", { minimumFractionDigits: digits, maximumFractionDigits: digits });

const formatQuantity = (value: number) =>
  value.toLocaleString("en-TH", { minimumFractionDigits: 0, maximumFractionDigits: 3 });

const parseNumber = (value: string): number | null => {
  if (value.trim() === "") return null;
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return null;
  return parsed;
};

export default function IngredientPurchasingForm() {
  const { id } = useParams();
  const isEdit = Boolean(id);
  const navigate = useNavigate();
  const { toast } = useToast();
  const [form, setForm] = useState<FormState>(emptyForm);
  const [formErrors, setFormErrors] = useState<IngredientAuthorityInvalidReason[]>([]);
  const [requiredErrors, setRequiredErrors] = useState<string[]>([]);

  const { data, isLoading, error } = useQuery<{ item: IngredientAuthorityRecord }>({
    queryKey: ["/api/ingredient-authority", id],
    queryFn: () => apiRequest(`/api/ingredient-authority/${id}`),
    enabled: isEdit,
  });

  useEffect(() => {
    if (!isEdit || !data?.item) return;
    const ingredient = data.item;
    setForm({
      name: ingredient.name,
      category: ingredient.category,
      supplier: ingredient.supplier,
      purchaseQuantity: String(ingredient.purchaseQuantity),
      purchaseUnit: ingredient.purchaseUnit,
      purchaseCostThb: String(ingredient.purchaseCostThb),
      portionQuantity: String(ingredient.portionQuantity),
      portionUnit: ingredient.portionUnit,
      conversionFactor: ingredient.conversionFactor !== null ? String(ingredient.conversionFactor) : "",
      isActive: ingredient.isActive,
    });
  }, [data, isEdit]);

  const createMutation = useMutation({
    mutationFn: (payload: Omit<FormState, "purchaseQuantity" | "purchaseCostThb" | "portionQuantity"> & {
      purchaseQuantity: number;
      purchaseCostThb: number;
      portionQuantity: number;
      purchaseUnit: Unit;
      portionUnit: Unit;
    }) =>
      apiRequest("/api/ingredient-authority", {
        method: "POST",
        body: JSON.stringify(payload),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/ingredient-authority"] });
      toast({ title: "Ingredient created." });
      navigate("/operations/ingredient-purchasing");
    },
    onError: (err: any) => {
      toast({ title: "Failed to create ingredient.", description: err.message, variant: "destructive" });
    },
  });

  const updateMutation = useMutation({
    mutationFn: (payload: Omit<FormState, "purchaseQuantity" | "purchaseCostThb" | "portionQuantity"> & {
      purchaseQuantity: number;
      purchaseCostThb: number;
      portionQuantity: number;
      purchaseUnit: Unit;
      portionUnit: Unit;
    }) =>
      apiRequest(`/api/ingredient-authority/${id}`, {
        method: "PUT",
        body: JSON.stringify(payload),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/ingredient-authority"] });
      toast({ title: "Ingredient updated." });
      navigate("/operations/ingredient-purchasing");
    },
    onError: (err: any) => {
      toast({ title: "Failed to update ingredient.", description: err.message, variant: "destructive" });
    },
  });

  const preview: {
    valid: boolean;
    errors: IngredientAuthorityInvalidReason[];
    derived: ReturnType<typeof validateAndDeriveIngredientAuthority>["derived"];
    required: string[];
    unitsDiffer: boolean;
  } = useMemo(() => {
    const required: string[] = [];
    const unitsDiffer = form.purchaseUnit !== "" && form.portionUnit !== "" && form.purchaseUnit !== form.portionUnit;
    const name = form.name.trim();
    const category = form.category.trim();
    const supplier = form.supplier.trim();

    if (!name) required.push("Name is required.");
    if (!category) required.push("Category is required.");
    if (!supplier) required.push("Supplier is required.");

    const purchaseQuantity = parseNumber(form.purchaseQuantity);
    const purchaseQtyValue = purchaseQuantity ?? Number.NaN;
    if (purchaseQuantity === null) required.push("Purchase quantity is required.");
    const purchaseCostThb = parseNumber(form.purchaseCostThb);
    const purchaseCostValue = purchaseCostThb ?? Number.NaN;
    if (purchaseCostThb === null) required.push("Purchase cost is required.");
    const portionQuantity = parseNumber(form.portionQuantity);
    const portionQtyValue = portionQuantity ?? Number.NaN;
    if (portionQuantity === null) required.push("Portion quantity is required.");
    if (!form.purchaseUnit) required.push("Purchase unit is required.");
    if (!form.portionUnit) required.push("Portion unit is required.");
    const conversionFactor = parseNumber(form.conversionFactor);

    const validation = validateAndDeriveIngredientAuthority({
      purchaseQuantity: purchaseQtyValue,
      purchaseUnit: (form.purchaseUnit || "g") as Unit,
      purchaseCostThb: purchaseCostValue,
      portionQuantity: portionQtyValue,
      portionUnit: (form.portionUnit || "g") as Unit,
      conversionFactor: unitsDiffer ? conversionFactor : null,
    });

    return { ...validation, required, unitsDiffer };
  }, [form]);

  const handleSubmit = () => {
    if (preview.required.length > 0) {
      setRequiredErrors(preview.required);
      return;
    }

    const errors = [...preview.errors];
    if (preview.unitsDiffer && errors.includes("UNIT_MISMATCH_NO_CONVERSION")) {
      setFormErrors(errors);
      setRequiredErrors([]);
      return;
    }

    const purchaseQuantity = parseNumber(form.purchaseQuantity);
    const purchaseCostThb = parseNumber(form.purchaseCostThb);
    const portionQuantity = parseNumber(form.portionQuantity);
    const conversionFactor = parseNumber(form.conversionFactor);

    if (
      purchaseQuantity === null ||
      purchaseCostThb === null ||
      portionQuantity === null ||
      !form.purchaseUnit ||
      !form.portionUnit
    ) {
      setRequiredErrors(["Required fields are missing."]);
      return;
    }

    const payload = {
      name: form.name.trim(),
      category: form.category.trim(),
      supplier: form.supplier.trim(),
      purchaseQuantity,
      purchaseUnit: form.purchaseUnit,
      purchaseCostThb,
      portionQuantity,
      portionUnit: form.portionUnit,
      conversionFactor: preview.unitsDiffer ? conversionFactor : null,
      isActive: form.isActive,
    };

    setFormErrors(errors);
    setRequiredErrors([]);

    if (isEdit) {
      updateMutation.mutate(payload);
    } else {
      createMutation.mutate(payload);
    }
  };

  const isSubmitting = createMutation.isPending || updateMutation.isPending;

  return (
    <div className="p-6 space-y-6">
      <Card>
        <CardHeader className="space-y-2">
          <CardTitle className="text-xl">
            {isEdit ? "Edit Ingredient" : "Create Ingredient"}
          </CardTitle>
          <p className="text-sm text-slate-500">
            Capture purchasing and portion data to determine cost per usable portion.
          </p>
        </CardHeader>
        <CardContent className="space-y-6">
          {isEdit && isLoading && <div className="text-sm text-slate-500">Loading ingredient...</div>}
          {error && (
            <div className="rounded border border-red-200 bg-red-50 p-3 text-sm text-red-700">
              Failed to load ingredient. {error instanceof Error ? error.message : "Unknown error."}
            </div>
          )}

          <div className="space-y-6">
            <section className="space-y-4">
              <h2 className="text-sm font-semibold text-slate-700">Ingredient Details</h2>
              <div className="grid grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="name">Name</Label>
                  <Input
                    id="name"
                    value={form.name}
                    onChange={(e) => setForm((prev) => ({ ...prev, name: e.target.value }))}
                    placeholder="Ingredient name"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="category">Category</Label>
                  <Input
                    id="category"
                    value={form.category}
                    onChange={(e) => setForm((prev) => ({ ...prev, category: e.target.value }))}
                    placeholder="Category"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="supplier">Supplier</Label>
                  <Input
                    id="supplier"
                    value={form.supplier}
                    onChange={(e) => setForm((prev) => ({ ...prev, supplier: e.target.value }))}
                    placeholder="Supplier"
                  />
                </div>
              </div>
            </section>

            <section className="space-y-4">
              <h2 className="text-sm font-semibold text-slate-700">Purchase Information</h2>
              <div className="grid grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="purchaseQuantity">Purchase Quantity</Label>
                  <Input
                    id="purchaseQuantity"
                    type="number"
                    min="0"
                    step="0.001"
                    value={form.purchaseQuantity}
                    onChange={(e) => setForm((prev) => ({ ...prev, purchaseQuantity: e.target.value }))}
                    placeholder="0"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Purchase Unit</Label>
                  <Select
                    value={form.purchaseUnit || "__none__"}
                    onValueChange={(value) =>
                      setForm((prev) => ({ ...prev, purchaseUnit: value === "__none__" ? "" : (value as Unit) }))
                    }
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select unit" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__none__">Select unit</SelectItem>
                      {allowedUnits.map((unit) => (
                        <SelectItem key={unit} value={unit}>
                          {unit}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="purchaseCostThb">Purchase Cost (THB)</Label>
                  <Input
                    id="purchaseCostThb"
                    type="number"
                    min="0"
                    step="0.01"
                    value={form.purchaseCostThb}
                    onChange={(e) => setForm((prev) => ({ ...prev, purchaseCostThb: e.target.value }))}
                    placeholder="0.00"
                  />
                </div>
              </div>
            </section>

            <section className="space-y-4">
              <h2 className="text-sm font-semibold text-slate-700">Portion Information</h2>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="portionQuantity">Portion Quantity</Label>
                  <Input
                    id="portionQuantity"
                    type="number"
                    min="0"
                    step="0.001"
                    value={form.portionQuantity}
                    onChange={(e) => setForm((prev) => ({ ...prev, portionQuantity: e.target.value }))}
                    placeholder="0"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Portion Unit</Label>
                  <Select
                    value={form.portionUnit || "__none__"}
                    onValueChange={(value) =>
                      setForm((prev) => ({ ...prev, portionUnit: value === "__none__" ? "" : (value as Unit) }))
                    }
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select unit" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__none__">Select unit</SelectItem>
                      {allowedUnits.map((unit) => (
                        <SelectItem key={unit} value={unit}>
                          {unit}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <input
                  id="isActive"
                  type="checkbox"
                  checked={form.isActive}
                  onChange={(e) => setForm((prev) => ({ ...prev, isActive: e.target.checked }))}
                  className="h-4 w-4"
                />
                <Label htmlFor="isActive">Active</Label>
              </div>
            </section>

            {form.purchaseUnit && form.portionUnit && form.purchaseUnit !== form.portionUnit && (
              <section className="space-y-4">
                <h2 className="text-sm font-semibold text-slate-700">Conversion</h2>
                <div className="flex items-center gap-3">
                  <span className="text-sm text-slate-600">1 {form.purchaseUnit} equals</span>
                  <Input
                    id="conversionFactor"
                    type="number"
                    min="0"
                    step="0.0001"
                    value={form.conversionFactor}
                    onChange={(e) => setForm((prev) => ({ ...prev, conversionFactor: e.target.value }))}
                    placeholder="0"
                    className="w-32 text-right"
                  />
                  <span className="text-sm text-slate-600">{form.portionUnit}</span>
                </div>
              </section>
            )}

            <section className="space-y-4">
              <h2 className="text-sm font-semibold text-slate-700">Derived Cost (Read Only)</h2>
              <div className="rounded border border-slate-200 bg-slate-50 p-4 space-y-3">
                <div className="flex items-center gap-3">
                  <Badge variant={preview.valid ? "default" : "destructive"}>
                    {preview.valid ? "VALID" : "INVALID"}
                  </Badge>
                  {preview.derived && preview.derived.conversionNotes.length > 0 && (
                    <span className="text-xs text-slate-500">
                      {preview.derived.conversionNotes.join(" • ")}
                    </span>
                  )}
                </div>
                {preview.derived ? (
                  <div className="grid grid-cols-3 gap-4 text-sm">
                    <div>
                      <div className="text-xs text-slate-500">Portions per Purchase</div>
                      <div className="font-medium text-slate-900">
                        {formatQuantity(preview.derived.portionsPerPurchase)}
                      </div>
                    </div>
                    <div>
                      <div className="text-xs text-slate-500">Cost per Portion (THB)</div>
                      <div className="font-medium text-slate-900">
                        {formatNumber(preview.derived.costPerPortion, 4)}
                      </div>
                    </div>
                    <div>
                      <div className="text-xs text-slate-500">
                        Cost per Base Unit {preview.derived.baseUnit}
                      </div>
                      <div className="font-medium text-slate-900">
                        {preview.derived.costPerBaseUnit === null
                          ? "—"
                          : formatNumber(preview.derived.costPerBaseUnit, 4)}
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="text-sm text-slate-500">
                    Complete required fields to see derived costs.
                  </div>
                )}
                {preview.errors.length > 0 && (
                  <div className="text-sm text-red-600 space-y-1">
                    {preview.errors.map((issue) => (
                      <div key={issue}>{issue}</div>
                    ))}
                  </div>
                )}
              </div>
            </section>

            {requiredErrors.length > 0 && (
              <div className="rounded border border-red-200 bg-red-50 p-3 text-sm text-red-700">
                {requiredErrors.map((issue) => (
                  <div key={issue}>{issue}</div>
                ))}
              </div>
            )}

            {formErrors.length > 0 && (
              <div className="rounded border border-red-200 bg-red-50 p-3 text-sm text-red-700">
                {formErrors.map((issue) => (
                  <div key={issue}>{issue}</div>
                ))}
              </div>
            )}

            <div className="flex flex-wrap gap-2">
              <Button onClick={handleSubmit} disabled={isSubmitting}>
                {isEdit ? "Update Ingredient" : "Create Ingredient"}
              </Button>
              <Button variant="outline" asChild disabled={isSubmitting}>
                <Link to="/operations/ingredient-purchasing">Cancel</Link>
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
