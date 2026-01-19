import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

type MenuItem = {
  id: string;
  name: string;
  description: string | null;
  imageUrl: string | null;
  category: string;
  isActive: boolean;
  isOnlineEnabled: boolean;
  salePrice: number | null;
  totalCost: number | null;
};

type MenuManagementResponse = {
  ok: boolean;
  items: MenuItem[];
};

export default function MenuManagement() {
  const { data, isLoading } = useQuery<MenuManagementResponse>({
    queryKey: ["/api/menu-management"],
  });

  const items = data?.items || [];

  const totalItems = useMemo(() => items.length, [items]);

  const formatMoney = (value: number | null) => {
    if (value === null || !Number.isFinite(value)) return "N/A";
    return `฿${Number(value).toFixed(2)}`;
  };

  if (isLoading) {
    return <div className="text-center py-8 text-slate-500">Loading menu view...</div>;
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900" data-testid="text-page-title">Menu</h1>
        <p className="text-sm text-slate-500">
          Read-only view of products with pricing and activation status.
        </p>
        <p className="text-xs text-slate-400 mt-1">Total products: {totalItems}</p>
      </div>

      <Card className="rounded-[4px]">
        <CardHeader className="py-3 px-4 bg-slate-50 border-b">
          <CardTitle className="text-sm font-semibold">Products</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {items.length === 0 ? (
            <div className="p-4 text-center text-slate-400 text-sm">No products available</div>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-white">
                  <th className="text-left py-2 px-4 font-medium">Product</th>
                  <th className="text-left py-2 px-4 font-medium">Category</th>
                  <th className="text-right py-2 px-4 font-medium">Sale Price</th>
                  <th className="text-right py-2 px-4 font-medium">Total Cost</th>
                  <th className="text-center py-2 px-4 font-medium">Status</th>
                  <th className="text-center py-2 px-4 font-medium">Online</th>
                </tr>
              </thead>
              <tbody>
                {items.map((item) => (
                  <tr key={item.id} className="border-b hover:bg-slate-50">
                    <td className="py-2 px-4">
                      <div className="font-medium">{item.name}</div>
                      {item.description && <div className="text-xs text-slate-500 line-clamp-2">{item.description}</div>}
                    </td>
                    <td className="py-2 px-4 text-slate-600">{item.category || "UNMAPPED"}</td>
                    <td className="py-2 px-4 text-right text-slate-700">{formatMoney(item.salePrice)}</td>
                    <td className="py-2 px-4 text-right text-slate-700">{formatMoney(item.totalCost)}</td>
                    <td className="py-2 px-4 text-center">
                      <Badge className={`text-[10px] rounded-[4px] ${item.isActive ? "bg-emerald-100 text-emerald-700" : "bg-slate-200 text-slate-600"}`}>
                        {item.isActive ? "Active" : "Inactive"}
                      </Badge>
                    </td>
                    <td className="py-2 px-4 text-center">
                      <Badge className={`text-[10px] rounded-[4px] ${item.isOnlineEnabled ? "bg-emerald-100 text-emerald-700" : "bg-slate-200 text-slate-600"}`}>
                        {item.isOnlineEnabled ? "Enabled" : "Disabled"}
                      </Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
