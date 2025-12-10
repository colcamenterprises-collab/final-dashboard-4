import React, { useEffect, useState } from "react";
import axios from "../../utils/axiosInstance";

import POSCategoryBar from "./components/POSCategoryBar";
import POSItemGrid from "./components/POSItemGrid";
import POSModifierSheet from "./components/POSModifierSheet";
import POSCart from "./components/POSCart";

export default function POS() {
  const logged = localStorage.getItem("pos_logged_in");
  if (!logged) window.location.href = "/pos-login";

  const [categories, setCategories] = useState([]);
  const [items, setItems] = useState([]);
  const [activeCategory, setActiveCategory] = useState(null);

  const [cart, setCart] = useState([]);
  const [selectedItem, setSelectedItem] = useState(null);
  const [selectedModifiers, setSelectedModifiers] = useState([]);

  const [modifierGroups, setModifierGroups] = useState([]);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    const c = await axios.get("/api/menu-v3/categories");
    const i = await axios.get("/api/menu-v3/items");
    const m = await axios.get("/api/menu-v3/modifiers/groups");

    setCategories(c.data || []);
    setItems(i.data || []);
    setModifierGroups(m.data || []);

    if (c.data.length > 0) setActiveCategory(c.data[0].id);
  };

  const itemsForCategory = items.filter((i) => i.categoryId === activeCategory);

  const addToCart = () => {
    if (!selectedItem) return;

    const price =
      selectedItem.price +
      selectedModifiers.reduce((sum, m) => sum + m.price, 0);

    setCart((prev) => [
      ...prev,
      {
        name: selectedItem.name,
        price: selectedItem.price,
        qty: 1,
        modifiers: selectedModifiers,
        total: price,
      },
    ]);

    setSelectedItem(null);
    setSelectedModifiers([]);
  };

  const removeFromCart = (index) => {
    setCart((prev) => prev.filter((_, idx) => idx !== index));
  };

  const checkout = () => {
    localStorage.setItem("pos_cart", JSON.stringify(cart));
    window.location.href = "/pos-checkout";
  };

  return (
    <div style={{ display: "flex" }}>
      <div style={{ width: "70%", padding: 20 }}>
        <POSCategoryBar
          categories={categories}
          activeCategory={activeCategory}
          onSelect={setActiveCategory}
        />

        <POSItemGrid
          items={itemsForCategory}
          onSelect={(item) => setSelectedItem(item)}
        />

        <POSModifierSheet
          item={selectedItem}
          groups={modifierGroups}
          onSelectModifier={(group, mod) =>
            setSelectedModifiers((prev) => [...prev, mod])
          }
          onFinish={addToCart}
        />
      </div>

      <POSCart cart={cart} onRemove={removeFromCart} onCheckout={checkout} />
    </div>
  );
}
