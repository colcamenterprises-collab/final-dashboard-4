import React, { useState } from "react";
import CategoriesEditor from "./CategoriesEditor";
import ItemsEditor from "./ItemsEditor";
import ModifiersEditor from "./ModifiersEditor";
import RecipeEditor from "./RecipeEditor";

export default function MenuAdmin() {
  const [view, setView] = useState("categories");
  const [selectedItem, setSelectedItem] = useState(null);

  return (
    <div style={{ padding: "24px" }}>
      <h1 style={{ fontSize: "32px", marginBottom: "20px" }}>Menu Master V3</h1>

      {/* Navigation */}
      <div style={{ display: "flex", gap: "16px", marginBottom: "20px" }}>
        <button onClick={() => setView("categories")}>Categories</button>
        <button onClick={() => setView("items")}>Items</button>
        <button onClick={() => setView("modifiers")}>Modifiers</button>
        <button onClick={() => setView("recipes")}>
          Recipes
        </button>
      </div>

      {/* Views */}
      {view === "categories" && <CategoriesEditor />}
      {view === "items" && (
        <ItemsEditor onSelectItem={(item: any) => {
          setSelectedItem(item);
          setView("recipes");
        }} />
      )}
      {view === "modifiers" && <ModifiersEditor />}
      {view === "recipes" && selectedItem && (
        <RecipeEditor item={selectedItem} />
      )}
      {view === "recipes" && !selectedItem && (
        <div style={{ padding: "40px", textAlign: "center", color: "#666" }}>
          <p style={{ fontSize: "18px", marginBottom: "12px" }}>No recipes yet</p>
          <p>Select a menu item from the Items tab to create or edit its recipe.</p>
        </div>
      )}
    </div>
  );
}
