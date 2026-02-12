import React, { useState } from "react";
import CategoriesEditor from "./CategoriesEditor";
import ItemsEditor from "./ItemsEditor";
import ModifiersEditor from "./ModifiersEditor";
import { Link } from "react-router-dom";

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
      </div>

      {/* Views */}
      {view === "categories" && <CategoriesEditor />}
      {view === "items" && (
        <ItemsEditor onSelectItem={(item: any) => {
          setSelectedItem(item);
        }} />
      )}
      {view === "modifiers" && <ModifiersEditor />}
      
      {/* Recipe editing redirect notice */}
      <div style={{ marginTop: "24px", padding: "16px", backgroundColor: "#fef3c7", borderRadius: "8px", border: "1px solid #f59e0b" }}>
        <p style={{ color: "#92400e", fontWeight: 500 }}>
          Recipe editing has moved to{" "}
          <Link to="/recipe-management" style={{ color: "#1d4ed8", textDecoration: "underline" }}>
            Recipe Management
          </Link>
        </p>
      </div>
    </div>
  );
}
