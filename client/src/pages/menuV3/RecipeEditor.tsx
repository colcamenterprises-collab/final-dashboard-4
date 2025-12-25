import React, { useEffect, useState } from "react";
import axios from "axios";

export default function RecipeEditor({ item }) {
  const [recipe, setRecipe] = useState([]);
  const [ingredients, setIngredients] = useState([]);

  const [form, setForm] = useState({
    ingredientId: "",
    quantityUsed: "",
    unit: "g"
  });

  async function load() {
    const res = await axios.get("/api/menu-v3/recipes/" + item.id);
    setRecipe(res.data);

    const ing = await axios.get("/api/ingredients");
    setIngredients(ing.data);
  }

  async function save() {
    await axios.post("/api/menu-v3/recipes/set", {
      itemId: item.id,
      recipe
    });
    load();
  }

  function addToRecipe() {
    setRecipe([
      ...recipe,
      {
        ingredientId: form.ingredientId,
        quantityUsed: parseFloat(form.quantityUsed),
        unit: form.unit
      }
    ]);
  }

  useEffect(() => { load(); }, [item.id]);

  return (
    <div>
      <div className="bg-amber-50 border border-amber-200 rounded p-3 mb-4 text-sm text-amber-800">
        <strong>Read-only</strong> — Recipe editing is managed in <a href="/recipe-management" className="text-emerald-600 underline">Recipe Management</a>
      </div>
      <h2>Recipe for: {item.name}</h2>

      {/* Add ingredient */}
      <div>
        <select
          value={form.ingredientId}
          onChange={(e) =>
            setForm({ ...form, ingredientId: e.target.value })
          }
        >
          <option value="">Select Ingredient</option>
          {ingredients.map((i) => (
            <option key={i.id} value={i.id}>{i.name}</option>
          ))}
        </select>

        <input
          placeholder="Qty"
          value={form.quantityUsed}
          onChange={(e) =>
            setForm({ ...form, quantityUsed: e.target.value })
          }
        />

        <select
          value={form.unit}
          onChange={(e) =>
            setForm({ ...form, unit: e.target.value })
          }
        >
          <option value="g">Grams</option>
          <option value="ml">Milliliters</option>
          <option value="unit">Units</option>
        </select>

        <button onClick={addToRecipe}>Add</button>
      </div>

      <h3>Current Recipe</h3>
      <ul>
        {recipe.map((r, i) => (
          <li key={i}>
            {r.ingredientId} — {r.quantityUsed}{r.unit}
          </li>
        ))}
      </ul>

      <button onClick={save}>Save Recipe</button>
    </div>
  );
}
