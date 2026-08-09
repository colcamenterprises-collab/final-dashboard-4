import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Plus } from "lucide-react";
import { asArray, normalizeMenuCategories } from "@/lib/menuData";
import MenuWorkspace from "./MenuWorkspace";
import MenuItemCreateModal from "./MenuItemCreateModal";
import MenuItemEditor from "./MenuItemEditor";

type MenuCategory = { id: string; name: string; isActive?: boolean };
type Recipe = { id: number; name: string };
type ModifierOption = { id?: string; name?: string; name_en?: string; price?: number | string; priceDelta?: number | string };
type ModifierGroup = {
  id?: string;
  name: string;
  menuItemId?: string;
  linkedMenuItemIds?: string[];
  groupType?: string;
  type?: string;
  selectionMode?: string;
  promptText?: string | null;
  options?: ModifierOption[];
  modifiers?: ModifierOption[];
};
type MenuItem = {
  id: string;
  categoryId?: string;
  category?: string | { name?: string };
  name: string;
  description?: string | null;
  basePrice?: number | string;
  price?: number | string;
  directPrice?: number | string;
  grabPrice?: number | string;
  imageUrl?: string | null;
  isActive?: boolean;
  soldOut?: boolean;
  posEnabled?: boolean;
  onlineEnabled?: boolean;
  isOnlineEnabled?: boolean;
  recipeId?: number | null;
  displayOrder?: number | string | null;
  sortOrder?: number | string | null;
};

type ModifierResponse = { groups?: ModifierGroup[] } | ModifierGroup[];
type RecipeResponse = Recipe[] | { rows?: Recipe[] };

export default function MenuItemsPage() {
  const [creating, setCreating] = useState(false);
  const [createdItem, setCreatedItem] = useState<MenuItem | null>(null);
  const { data: rawCategories } = useQuery<unknown>({ queryKey: ["/api/menu-v3/categories"] });
  const { data: recipesData } = useQuery<RecipeResponse>({ queryKey: ["/api/recipes"] });
  const { data: modifierData } = useQuery<ModifierResponse>({ queryKey: ["/api/menu-v3/modifiers/groups"] });

  const categories = asArray<MenuCategory>(normalizeMenuCategories<MenuCategory>(rawCategories).items);
  const recipes = Array.isArray(recipesData) ? recipesData : asArray<Recipe>(recipesData?.rows);
  const modifierGroups = Array.isArray(modifierData) ? modifierData : asArray<ModifierGroup>(modifierData?.groups);

  return (
    <div className="relative">
      <MenuWorkspace />
      {!createdItem && (
        <button
          type="button"
          onClick={() => setCreating(true)}
          className="fixed bottom-6 right-6 z-40 inline-flex items-center gap-2 rounded-xl bg-black px-5 py-3 text-sm font-bold text-white shadow-xl transition hover:bg-slate-800"
        >
          <Plus className="h-4 w-4" /> Add Menu Item
        </button>
      )}
      {creating && (
        <MenuItemCreateModal
          categories={categories}
          onClose={() => setCreating(false)}
          onCreated={(item) => {
            setCreating(false);
            setCreatedItem(item as MenuItem);
          }}
        />
      )}
      {createdItem && (
        <MenuItemEditor
          item={createdItem}
          categories={categories}
          recipes={recipes}
          modifierGroups={modifierGroups}
          onClose={() => setCreatedItem(null)}
        />
      )}
    </div>
  );
}
