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
        <button
          disabled={!selectedItem}
          onClick={() => setView("recipes")}
        >
          Recipes
        </button>
      </div>

      {/* Views */}
      {view === "categories" && <CategoriesEditor />}
      {view === "items" && (
        <ItemsEditor onSelectItem={(item) => {
          setSelectedItem(item);
          setView("recipes");
        }} />
      )}
      {view === "modifiers" && <ModifiersEditor />}
      {view === "recipes" && selectedItem && (
        <RecipeEditor item={selectedItem} />
      )}
    </div>
  );
}
