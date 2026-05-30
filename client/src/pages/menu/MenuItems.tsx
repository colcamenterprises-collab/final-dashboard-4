import { useQuery } from "@tanstack/react-query";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { useState } from "react";
import { Search } from "lucide-react";

interface MenuItem {
  id: string;
  categoryId: string;
  name: string;
  description: string | null;
  basePrice: number;
  imageUrl: string | null;
  posEnabled: boolean;
  onlineEnabled: boolean;
  kitchenStation: string | null;
  isActive: boolean;
}

interface MenuCategory {
  id: string;
  name: string;
  description: string | null;
  sortOrder: number;
  isActive: boolean;
}

export default function MenuItems() {
  const [search, setSearch] = useState("");

  const { data: items = [], isLoading: itemsLoading } = useQuery<MenuItem[]>({
    queryKey: ["/api/menu-v3/items"],
  });

  const { data: categories = [] } = useQuery<MenuCategory[]>({
    queryKey: ["/api/menu-v3/categories"],
  });

  const categoryMap = categories.reduce<Record<string, string>>((acc, cat) => {
    acc[cat.id] = cat.name;
    return acc;
  }, {});

  const filtered = items.filter(
    (i) =>
      i.name.toLowerCase().includes(search.toLowerCase()) ||
      (categoryMap[i.categoryId] || "").toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="p-4 space-y-4 max-w-5xl mx-auto">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold text-slate-900 dark:text-white">Menu Items</h1>
          <p className="text-xs text-slate-500">{items.length} items across {categories.length} categories</p>
        </div>
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
        <Input
          placeholder="Search menu items..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-9 text-xs"
        />
      </div>

      {itemsLoading && (
        <div className="text-center py-12 text-slate-400 text-xs">Loading menu items...</div>
      )}

      {!itemsLoading && filtered.length === 0 && (
        <div className="text-center py-12 text-slate-400 text-xs">No menu items found.</div>
      )}

      <div className="border border-slate-200 dark:border-slate-700 rounded-lg overflow-hidden">
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800">
              <th className="text-left px-3 py-2 font-medium text-slate-500">Name</th>
              <th className="text-left px-3 py-2 font-medium text-slate-500">Category</th>
              <th className="text-left px-3 py-2 font-medium text-slate-500">Station</th>
              <th className="text-right px-3 py-2 font-medium text-slate-500">Price (฿)</th>
              <th className="text-center px-3 py-2 font-medium text-slate-500">POS</th>
              <th className="text-center px-3 py-2 font-medium text-slate-500">Online</th>
              <th className="text-center px-3 py-2 font-medium text-slate-500">Status</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((item, idx) => (
              <tr
                key={item.id}
                className={`border-b border-slate-100 dark:border-slate-800 last:border-0 ${
                  idx % 2 === 0 ? "bg-white dark:bg-slate-900" : "bg-slate-50/50 dark:bg-slate-800/50"
                }`}
              >
                <td className="px-3 py-2 font-medium text-slate-800 dark:text-slate-200">{item.name}</td>
                <td className="px-3 py-2 text-slate-500">{categoryMap[item.categoryId] || "—"}</td>
                <td className="px-3 py-2 text-slate-500">{item.kitchenStation || "—"}</td>
                <td className="px-3 py-2 text-right font-mono text-slate-700 dark:text-slate-300">
                  {item.basePrice?.toFixed(0) ?? "—"}
                </td>
                <td className="px-3 py-2 text-center">
                  <span className={`inline-block w-2 h-2 rounded-full ${item.posEnabled ? "bg-green-500" : "bg-slate-300"}`} />
                </td>
                <td className="px-3 py-2 text-center">
                  <span className={`inline-block w-2 h-2 rounded-full ${item.onlineEnabled ? "bg-blue-500" : "bg-slate-300"}`} />
                </td>
                <td className="px-3 py-2 text-center">
                  <Badge
                    variant={item.isActive ? "default" : "outline"}
                    className={`text-[10px] px-1.5 py-0 ${item.isActive ? "bg-green-100 text-green-700 border-green-200" : "text-slate-400"}`}
                  >
                    {item.isActive ? "Active" : "Off"}
                  </Badge>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
