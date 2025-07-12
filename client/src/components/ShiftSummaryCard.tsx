import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function ShiftSummaryCard() {
  const { data, isLoading } = useQuery({
    queryKey: ["latest-shift-summary"],
    queryFn: () =>
      fetch("/api/shift-summary/latest").then((r) => r.json()),
    refetchInterval: 60_000,
  });

  if (isLoading) return (
    <Card>
      <CardHeader>
        <CardTitle>Loading...</CardTitle>
      </CardHeader>
    </Card>
  );
  
  if (!data || !data.shiftDate) return null;

  const cats = data.itemsBreakdown as Record<
    string,
    { qty: number; sales: number }
  >;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Shift Summary – {data.shiftDate}</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 gap-3 mb-4">
          {Object.entries(cats).map(([cat, v]) => (
            <div key={cat} className="p-3 bg-muted rounded-lg">
              <div className="text-sm font-medium text-muted-foreground">{cat}</div>
              <div className="text-xl font-bold">{v.qty}</div>
              <div className="text-sm text-muted-foreground">
                ฿{v.sales.toFixed(2)}
              </div>
            </div>
          ))}
        </div>
        <div className="flex gap-4 pt-2 border-t">
          <span className="text-sm">
            🍔 Burgers: <span className="font-bold">{data.burgersSold}</span>
          </span>
          <span className="text-sm">
            🥤 Drinks: <span className="font-bold">{data.drinksSold}</span>
          </span>
        </div>
      </CardContent>
    </Card>
  );
}