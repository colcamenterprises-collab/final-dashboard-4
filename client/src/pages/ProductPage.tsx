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
  ingredient_name?: string | null;
  ingredient_unit?: string | null;
  quantity_used: number | null;
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
  const [activationReasons, setActivationReasons] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);

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
        const p = await fetch(`/api/products/${id}`).then((r) => r.json());
        setProduct(p.product);
        setLines(p.lines || []);
      }
    })();
  }, [id, isNew]);

  const totalCost = useMemo(
    () => {
      if (!lines.length) return null;
      let total = 0;
      for (const line of lines) {
        const lineCost = Number(line.line_cost_derived);
        if (!Number.isFinite(lineCost)) {
          return null;
        }
        total += lineCost;
      }
      return Number(total.toFixed(2));
    },
    [lines]
  );

  const margin = useMemo(() => {
    if (!product.sale_price || product.sale_price <= 0 || totalCost === null) return null;
    return (product.sale_price - totalCost) / product.sale_price;
  }, [product.sale_price, totalCost]);

  const missingCostLines = useMemo(() => {
    if (!lines.length) return lines;
    return lines.filter((line) => {
      const qty = Number(line.quantity_used);
      const unitCost = Number(line.unit_cost_derived);
      const lineCost = Number(line.line_cost_derived);
      return (
        !Number.isFinite(qty) ||
        qty <= 0 ||
        !Number.isFinite(unitCost) ||
        unitCost < 0 ||
        !Number.isFinite(lineCost) ||
        lineCost < 0
      );
    });
  }, [lines]);

  const missingPrice = !product.sale_price || product.sale_price <= 0;
  const invalidMargin =
    totalCost !== null && product.sale_price !== null && product.sale_price <= totalCost;

  const activationReady =
    !missingPrice && !invalidMargin && missingCostLines.length === 0 && totalCost !== null;

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

  async function refreshLines() {
    const p = await fetch(`/api/products/${product.id}`).then((r) => r.json());
    setLines(p.lines || []);
  }

  async function activate() {
    setActivationReasons([]);
    const res = await fetch(`/api/products/${product.id}/activate`, { method: "POST" });
    const data = await res.json();
    if (!res.ok || data.ok === false) {
      if (data?.reasons?.length) {
        setActivationReasons(data.reasons);
        return;
      }
      return setError(data.error || "Activation failed");
    }
    setProduct((p) => ({ ...p, active: true }));
  }

  return (
    <div style={{ padding: 24, maxWidth: 1200 }}>
      <h1>{isNew ? "New Product" : "Product"}</h1>
      {error && <div style={{ color: "red" }}>{error}</div>}

      <section>
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

      <section>
        <h3>Ingredients</h3>
        <select onChange={(e) => addLine(Number(e.target.value))}>
          <option value="">Add ingredient</option>
          {ingredients.map((i) => (
            <option key={i.id} value={i.id}>{i.name}</option>
          ))}
        </select>
        <table>
          <thead>
            <tr>
              <th>Ingredient</th><th>Quantity</th><th>Unit</th><th>Line Cost</th><th>Prep</th>
            </tr>
          </thead>
          <tbody>
            {lines.map((l) => (
              <tr key={l.id}>
                <td>
                  {l.ingredient_name ||
                    ingredients.find((i) => i.id === l.ingredient_id)?.name ||
                    "UNMAPPED"}
                </td>
                <td>{l.quantity_used ?? "—"}</td>
                <td>{l.ingredient_unit ?? "—"}</td>
                <td>
                  {Number.isFinite(Number(l.line_cost_derived))
                    ? Number(l.line_cost_derived).toFixed(2)
                    : "—"}
                </td>
                <td>{l.prep_note || "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <section>
        <h3>Pricing</h3>
        <input
          type="number"
          placeholder="Sale Price"
          value={product.sale_price ?? ""}
          onChange={(e) => setProduct({ ...product, sale_price: Number(e.target.value) })}
        />
        <div>Total Cost: {totalCost !== null ? totalCost.toFixed(2) : "—"}</div>
        <div>
          Margin: {margin !== null ? `${(margin * 100).toFixed(1)}%` : "—"}
        </div>
      </section>

      <section>
        <button disabled={saving} onClick={saveProduct}>Save</button>
        {!product.active && !isNew && (
          <button onClick={activate} disabled={!activationReady}>Activate</button>
        )}
      </section>

      {!isNew && (
        <section>
          <h3>Activation Readiness</h3>
          <table>
            <thead>
              <tr>
                <th>Check</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>Missing costs</td>
                <td>
                  {lines.length === 0
                    ? "No ingredient lines"
                    : missingCostLines.length === 0
                      ? "None"
                      : `${missingCostLines.length} ingredient lines need cost or quantity`}
                </td>
              </tr>
              <tr>
                <td>Missing price</td>
                <td>{missingPrice ? "Sale price is required" : "None"}</td>
              </tr>
              <tr>
                <td>Invalid margin</td>
                <td>
                  {invalidMargin
                    ? "Sale price must exceed total cost"
                    : "None"}
                </td>
              </tr>
            </tbody>
          </table>

          {activationReasons.length > 0 && (
            <div>
              <h4>Activation Blockers</h4>
              <table>
                <thead>
                  <tr>
                    <th>Reason</th>
                  </tr>
                </thead>
                <tbody>
                  {activationReasons.map((reason) => (
                    <tr key={reason}>
                      <td>{reason}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      )}
    </div>
  );
}
