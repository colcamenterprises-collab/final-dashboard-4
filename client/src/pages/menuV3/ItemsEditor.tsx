import React, { useEffect, useState } from "react";
import axios from "axios";

export default function ItemsEditor({ onSelectItem }) {
  const [items, setItems] = useState([]);
  const [categories, setCategories] = useState([]);

  const [form, setForm] = useState({
    name: "",
    basePrice: "",
    categoryId: "",
    kitchenStation: "prep"
  });

  async function load() {
    const res = await axios.get("/api/menu-v3/items");
    setItems(res.data);

    const cats = await axios.get("/api/menu-v3/categories");
    setCategories(cats.data);
  }

  async function create() {
    await axios.post("/api/menu-v3/items/create", {
      name: form.name,
      basePrice: parseFloat(form.basePrice),
      categoryId: form.categoryId,
      kitchenStation: form.kitchenStation
    });
    load();
  }

  useEffect(() => { load(); }, []);

  return (
    <div>
      <h2>Items</h2>

      {/* Create */}
      <div style={{ marginBottom: "20px" }}>
        <input
          placeholder="Name"
          value={form.name}
          onChange={(e) => setForm({ ...form, name: e.target.value })}
        />

        <input
          placeholder="Price"
          value={form.basePrice}
          onChange={(e) =>
            setForm({ ...form, basePrice: e.target.value })
          }
        />

        <select
          value={form.categoryId}
          onChange={(e) =>
            setForm({ ...form, categoryId: e.target.value })
          }
        >
          <option value="">Select Category</option>
          {categories.map((c) => (
            <option key={c.id} value={c.id}>{c.name}</option>
          ))}
        </select>

        <select
          value={form.kitchenStation}
          onChange={(e) =>
            setForm({ ...form, kitchenStation: e.target.value })
          }
        >
          <option value="prep">Prep</option>
          <option value="grill">Grill</option>
          <option value="fry">Fry</option>
          <option value="drink">Drink</option>
        </select>

        <button onClick={create}>Create</button>
      </div>

      {/* List */}
      {items.map((item) => (
        <div
          key={item.id}
          style={{
            padding: "12px",
            border: "1px solid #ccc",
            marginBottom: "8px",
            borderRadius: "6px",
          }}
        >
          <strong>{item.name}</strong> — ฿{item.basePrice}
          <div>Category: {item.category?.name}</div>
          <div>Kitchen: {item.kitchenStation}</div>
          <button onClick={() => onSelectItem(item)}>
            Edit Recipe
          </button>
        </div>
      ))}
    </div>
  );
}
