import { useEffect, useMemo, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";

type Ingredient = {
  id: number;
  name: string;
  purchase_cost: number | null;
  yield_per_purchase: number | null;
  yield_unit: string | null;
};

type ProductIngredient = {
  id: number;
  ingredient_id: number;
  quantity_used: number;
  prep_note?: string | null;
  unit_cost_derived: number | null;
  line_cost_derived: number | null;
};

type Product = {
  id: number;
  name: string;
  description: string;
  prep_notes?: string | null;
  image_url?: string | null;
  category?: string | null;
  sale_price?: number | null;
  active: boolean;
};

type IngredientsResponse = {
  items: Array<{
    id: number;
    name: string;
    packageCost?: number | null;
    packageQty?: number | null;
    packageUnit?: string | null;
    portionQty?: number | null;
    portionUnit?: string | null;
  }>;
};

type ProductResponse = {
  product: Product;
  lines: ProductIngredient[];
};

export default function ProductPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const isNew = id === "new";

  const [product, setProduct] = useState<Product>({
    id: 0,
    name: "",
    description: "",
    prep_notes: "",
    image_url: "",
    category: "",
    sale_price: null,
    active: false,
  });

  const [ingredients, setIngredients] = useState<Ingredient[]>([]);
  const [lines, setLines] = useState<ProductIngredient[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [activating, setActivating] = useState(false);

  useEffect(() => {
    (async () => {
      const ing: IngredientsResponse = await fetch("/api/ingredients").then((r) => r.json());
      const mapped = (ing.items || []).map((item) => ({
        id: item.id,
        name: item.name,
        purchase_cost: item.packageCost ?? null,
        yield_per_purchase: item.packageQty ?? item.portionQty ?? null,
        yield_unit: item.packageUnit ?? item.portionUnit ?? null,
      }));
      setIngredients(mapped);
      if (!isNew) {
        const p: ProductResponse = await fetch(`/api/products/${id}`).then((r) => r.json());
        setProduct(p.product);
        setLines(p.lines || []);
      }
    })();
  }, [id, isNew]);

  const totalCost = useMemo(() => {
    if (lines.length === 0) return null;
    if (lines.some((line) => line.line_cost_derived === null)) return null;
    return lines.reduce((sum, line) => sum + Number(line.line_cost_derived || 0), 0);
  }, [lines]);

  const margin = useMemo(() => {
    if (!product.sale_price || product.sale_price <= 0 || totalCost === null) return null;
    return (product.sale_price - totalCost) / product.sale_price;
  }, [product.sale_price, totalCost]);

  async function saveProduct() {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/products${isNew ? "" : `/${product.id}`}`,
        {
          method: isNew ? "POST" : "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(product),
        }
      );
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Save failed");
      if (isNew && data.id) navigate(`/products/${data.id}`, { replace: true });
    } catch (e: any) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  }

  async function refreshLines() {
    const p: ProductResponse = await fetch(`/api/products/${product.id}`).then((r) => r.json());
    setLines(p.lines || []);
  }

  async function addLine(ingredientId: number) {
    if (!Number.isFinite(ingredientId)) return;
    if (isNew) {
      setError("Save the product before adding ingredients");
      return;
    }
    const res = await fetch(`/api/products/${product.id}/ingredients`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ingredientId, quantityUsed: 1 }),
    });
    const data = await res.json();
    if (!res.ok) return setError(data.error);
    await refreshLines();
  }

  async function updateLine(lineId: number, payload: Partial<ProductIngredient>) {
    const res = await fetch(`/api/products/${product.id}/ingredients/${lineId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ingredientId: payload.ingredient_id,
        quantityUsed: payload.quantity_used,
        prepNote: payload.prep_note,
      }),
    });
    const data = await res.json();
    if (!res.ok) return setError(data.error);
    await refreshLines();
  }

  async function deleteLine(lineId: number) {
    const res = await fetch(`/api/products/${product.id}/ingredients/${lineId}`, {
      method: "DELETE",
    });
    const data = await res.json();
    if (!res.ok) return setError(data.error);
    await refreshLines();
  }

  async function activate(nextActive: boolean) {
    if (isNew) return;
    setActivating(true);
    setError(null);
    try {
      const endpoint = nextActive ? "activate" : "deactivate";
      const res = await fetch(`/api/products/${product.id}/${endpoint}`, { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Activation failed");
      setProduct((p) => ({ ...p, active: nextActive }));
    } catch (e: any) {
      setError(e.message);
    } finally {
      setActivating(false);
    }
  }

  const formatMoney = (value: number | null) => {
    if (value === null || !Number.isFinite(value)) return "N/A";
    return value.toFixed(2);
  };

  return (
    <div style={{ padding: 24, maxWidth: 1200 }}>
      <h1>{isNew ? "New Product" : "Product"}</h1>
      {error && <div style={{ color: "red" }}>{error}</div>}

      <section style={{ marginBottom: 16 }}>
        <input
          placeholder="Name"
          value={product.name}
          onChange={(e) => setProduct({ ...product, name: e.target.value })}
        />
        <textarea
          placeholder="Description"
          value={product.description}
          onChange={(e) => setProduct({ ...product, description: e.target.value })}
        />
        <textarea
          placeholder="Prep Notes"
          value={product.prep_notes || ""}
          onChange={(e) => setProduct({ ...product, prep_notes: e.target.value })}
        />
        <input
          placeholder="Image URL"
          value={product.image_url || ""}
          onChange={(e) => setProduct({ ...product, image_url: e.target.value })}
        />
        <input
          placeholder="Category"
          value={product.category || ""}
          onChange={(e) => setProduct({ ...product, category: e.target.value })}
        />
      </section>

      <section style={{ marginBottom: 16 }}>
        <h3>Ingredient Lines</h3>
        <select onChange={(e) => addLine(Number(e.target.value))} value="">
          <option value="">Add ingredient</option>
          {ingredients.map((i) => (
            <option key={i.id} value={i.id}>{i.name}</option>
          ))}
        </select>
        <table>
          <thead>
            <tr>
              <th>Ingredient</th>
              <th>Qty</th>
              <th>Unit</th>
              <th>Unit Cost</th>
              <th>Line Cost</th>
              <th>Prep</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {lines.map((line) => {
              const ingredient = ingredients.find((i) => i.id === line.ingredient_id);
              return (
                <tr key={line.id}>
                  <td>
                    <select
                      value={line.ingredient_id}
                      onChange={(e) => {
                        const nextId = Number(e.target.value);
                        const nextLine = { ...line, ingredient_id: nextId };
                        setLines((prev) => prev.map((l) => (l.id === line.id ? nextLine : l)));
                        updateLine(line.id, { ingredient_id: nextId });
                      }}
                    >
                      {ingredients.map((i) => (
                        <option key={i.id} value={i.id}>{i.name}</option>
                      ))}
                    </select>
                  </td>
                  <td>
                    <input
                      type="number"
                      value={line.quantity_used}
                      onChange={(e) => {
                        const nextQty = Number(e.target.value);
                        setLines((prev) => prev.map((l) => (l.id === line.id ? { ...l, quantity_used: nextQty } : l)));
                      }}
                      onBlur={(e) => updateLine(line.id, { quantity_used: Number(e.target.value) })}
                    />
                  </td>
                  <td>{ingredient?.yield_unit || "UNMAPPED"}</td>
                  <td>{formatMoney(line.unit_cost_derived)}</td>
                  <td>{formatMoney(line.line_cost_derived)}</td>
                  <td>
                    <input
                      value={line.prep_note || ""}
                      onChange={(e) => {
                        const next = e.target.value;
                        setLines((prev) => prev.map((l) => (l.id === line.id ? { ...l, prep_note: next } : l)));
                      }}
                      onBlur={(e) => updateLine(line.id, { prep_note: e.target.value })}
                    />
                  </td>
                  <td>
                    <button type="button" onClick={() => deleteLine(line.id)}>Delete</button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </section>

      <section style={{ marginBottom: 16 }}>
        <h3>Pricing</h3>
        <input
          type="number"
          placeholder="Sale Price"
          value={product.sale_price ?? ""}
          onChange={(e) => setProduct({ ...product, sale_price: e.target.value === "" ? null : Number(e.target.value) })}
        />
        <div>Total Cost: {totalCost === null ? "N/A" : totalCost.toFixed(2)}</div>
        <div>Margin: {margin === null ? "N/A" : `${(margin * 100).toFixed(1)}%`}</div>
      </section>

      <section>
        <button disabled={saving} onClick={saveProduct}>Save</button>
        {!isNew && (
          <label style={{ marginLeft: 12 }}>
            <input
              type="checkbox"
              checked={product.active}
              onChange={(e) => activate(e.target.checked)}
              disabled={activating}
            />
            Active
          </label>
        )}
      </section>
    </div>
  );
}
