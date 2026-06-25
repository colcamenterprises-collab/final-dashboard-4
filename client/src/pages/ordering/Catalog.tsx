import { useQuery } from "@tanstack/react-query";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { useState } from "react";
import { Search, BookOpen } from "lucide-react";
import { asArray, logInvalidMenuShape, normalizeMenuCategories, normalizeMenuItems } from "@/lib/menuData";

interface MenuItem {
  id: string;
  categoryId: string;
  name: string;
  description: string | null;
  basePrice: number;
  imageUrl: string | null;
  posEnabled: boolean;
  onlineEnabled: boolean;
  isActive: boolean;
}

interface MenuCategory {
  id: string;
  name: string;
  sortOrder: number;
  isActive: boolean;
}

export default function Catalog() {
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<"all" | "online" | "pos">("all");

  const { data: rawItems, isLoading } = useQuery<unknown>({
    queryKey: ["/api/menu-v3/items"],
  });

  const { data: rawCategories, isLoading: categoriesLoading } = useQuery<unknown>({
    queryKey: ["/api/menu-v3/categories"],
  });

  const itemResult = normalizeMenuItems<MenuItem>(rawItems);
  const categoryResult = normalizeMenuCategories<MenuCategory>(rawCategories);
  const items = asArray<MenuItem>(itemResult.items);
  const categories = asArray<MenuCategory>(categoryResult.items);
  const hasInvalidMenuShape = !isLoading && !categoriesLoading && (!itemResult.isValidShape || !categoryResult.isValidShape);

  if (hasInvalidMenuShape) {
    logInvalidMenuShape("/menu catalog", { items: rawItems, categories: rawCategories });
  }

  const categoryMap = categories.reduce<Record<string, MenuCategory>>((acc, cat) => {
    if (cat?.id) acc[cat.id] = cat;
    return acc;
  }, {});

  const filtered = asArray(items).filter((i) => {
    if (!i.isActive) return false;
    if (filter === "online" && !i.onlineEnabled) return false;
    if (filter === "pos" && !i.posEnabled) return false;
    return (
      (i.name || "").toLowerCase().includes(search.toLowerCase()) ||
      (categoryMap[i.categoryId]?.name || "").toLowerCase().includes(search.toLowerCase())
    );
  });

  const byCategory = filtered.reduce<Record<string, MenuItem[]>>((acc, item) => {
    const catName = categoryMap[item.categoryId]?.name || "Other";
    if (!acc[catName]) acc[catName] = [];
    acc[catName].push(item);
    return acc;
  }, {});

  return (
    <div className="p-4 space-y-4 max-w-5xl mx-auto">
      <div className="flex items-center gap-3">
        <BookOpen className="h-5 w-5 text-slate-400" />
        <div>
          <h1 className="text-lg font-semibold text-slate-900 dark:text-white">Catalog</h1>
          <p className="text-xs text-slate-500">{filtered.length} items shown</p>
        </div>
      </div>

      <div className="flex gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <Input
            placeholder="Search catalog..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 text-xs"
          />
        </div>
        <div className="flex border border-slate-200 dark:border-slate-700 rounded-lg overflow-hidden">
          {(["all", "online", "pos"] as const).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-3 py-2 text-xs font-medium transition-colors ${
                filter === f
                  ? "bg-black text-white"
                  : "bg-white dark:bg-slate-900 text-slate-500 hover:bg-slate-50 dark:hover:bg-slate-800"
              }`}
            >
              {f === "all" ? "All" : f === "online" ? "Online" : "POS"}
            </button>
          ))}
        </div>
      </div>

      {isLoading && (
        <div className="text-center py-12 text-slate-400 text-xs">Loading catalog...</div>
      )}

      {hasInvalidMenuShape && (
        <div className="text-center py-12 text-red-500 text-xs">Menu data could not be loaded. Check API response shape.</div>
      )}

      {!isLoading && !hasInvalidMenuShape && Object.keys(byCategory).length === 0 && (
        <div className="text-center py-12 text-slate-400 text-xs">No items match the current filter.</div>
      )}

      <div className="space-y-5">
        {Object.entries(byCategory)
          .sort(([a], [b]) => {
            const aOrder = categories.find((c) => c.name === a)?.sortOrder ?? 99;
            const bOrder = categories.find((c) => c.name === b)?.sortOrder ?? 99;
            return aOrder - bOrder;
          })
          .map(([catName, catItems]) => (
            <div key={catName} className="space-y-2">
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide px-1">{catName}</p>
              <div className="grid grid-cols-3 md:grid-cols-2 lg:grid-cols-4 gap-2">
                {catItems.map((item) => (
                  <div
                    key={item.id}
                    className="border border-slate-200 dark:border-slate-700 rounded-lg p-3 bg-white dark:bg-slate-900 space-y-1.5"
                  >
                    <p className="text-xs font-semibold text-slate-800 dark:text-slate-200 leading-tight">{item.name || "—"}</p>
                    {item.description && (
                      <p className="text-[11px] text-slate-400 line-clamp-2 leading-tight">{item.description}</p>
                    )}
                    <div className="flex items-center justify-between pt-1">
                      <p className="text-xs font-mono font-semibold text-slate-700 dark:text-slate-300">
                        ฿{item.basePrice?.toFixed(0)}
                      </p>
                      <div className="flex gap-1">
                        {item.onlineEnabled && (
                          <Badge className="text-[9px] px-1 py-0 bg-blue-100 text-blue-600 border-blue-200 border">Web</Badge>
                        )}
                        {item.posEnabled && (
                          <Badge className="text-[9px] px-1 py-0 bg-green-100 text-green-600 border-green-200 border">POS</Badge>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
      </div>
    </div>
  );
}
