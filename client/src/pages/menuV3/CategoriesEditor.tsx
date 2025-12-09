import React, { useEffect, useState } from "react";
import axios from "axios";

export default function CategoriesEditor() {
  const [categories, setCategories] = useState([]);
  const [newName, setNewName] = useState("");

  async function load() {
    const res = await axios.get("/api/menu-v3/categories");
    setCategories(res.data);
  }

  async function create() {
    await axios.post("/api/menu-v3/categories/create", { name: newName });
    setNewName("");
    load();
  }

  useEffect(() => { load(); }, []);

  return (
    <div>
      <h2>Categories</h2>

      {/* Create */}
      <div style={{ marginBottom: "20px" }}>
        <input
          placeholder="Category name"
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
        />
        <button onClick={create}>Add</button>
      </div>

      {/* List */}
      {categories.map((cat) => (
        <div
          key={cat.id}
          style={{
            padding: "12px",
            border: "1px solid #ccc",
            marginBottom: "8px",
            borderRadius: "6px",
          }}
        >
          <strong>{cat.name}</strong>
          <div>POS: {cat.visiblePOS ? "Yes" : "No"}</div>
          <div>Online: {cat.visibleOnline ? "Yes" : "No"}</div>
        </div>
      ))}
    </div>
  );
}
