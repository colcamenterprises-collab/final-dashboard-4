import { useQuery } from '@tanstack/react-query';
import { Card, CardHeader, CardContent, CardTitle } from "@/components/ui/card";
import { Package } from "lucide-react";

export default function TestMonthlyStock() {
  const { data: monthlyStockSummary, isLoading, error } = useQuery<{
    rolls: Array<{ quantity: number; totalCost: string; date: string }>;
    drinks: Array<{ drinkName: string; quantity: number; totalCost: string; date: string }>;
    meat: Array<{ meatType: string; weight: string; totalCost: string; date: string }>;
  }>({
    queryKey: ["/api/stock-purchase/monthly-summary"],
    enabled: true,
    retry: 3,
  });

  console.log("TEST PAGE - Monthly stock summary data:", monthlyStockSummary);
  console.log("TEST PAGE - Monthly stock loading:", isLoading);
  console.log("TEST PAGE - Monthly stock error:", error);

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <h1 className="text-3xl font-bold mb-6">TEST: Monthly Stock Summary</h1>
      
      <Card className="border-4 border-red-500 bg-red-50 shadow-lg">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-red-900">
            <Package className="h-5 w-5" />
            🔴 TEST: Monthly Stock Purchases API
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="text-sm bg-white p-3 rounded border">
              <strong>Debug Info:</strong><br/>
              Loading: {isLoading ? "YES" : "NO"}<br/>
              Error: {error ? JSON.stringify(error) : "NONE"}<br/>
              Data Available: {monthlyStockSummary ? "YES" : "NO"}
            </div>

            {isLoading && (
              <div className="text-center py-4">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-red-500 mx-auto"></div>
                <p className="mt-2 text-red-600">Loading stock data...</p>
              </div>
            )}

            {error && (
              <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded">
                <strong>Error:</strong> {JSON.stringify(error)}
              </div>
            )}

            {monthlyStockSummary && (
              <div className="space-y-4">
                <div>
                  <h3 className="font-semibold mb-2">Rolls Purchased</h3>
                  {monthlyStockSummary.rolls.length === 0 ? (
                    <p className="text-gray-500">No rolls this month</p>
                  ) : (
                    <div className="space-y-2">
                      {monthlyStockSummary.rolls.map((roll, index) => (
                        <div key={index} className="flex justify-between p-2 bg-gray-50 rounded">
                          <span>{roll.quantity} rolls on {roll.date}</span>
                          <span className="font-semibold">฿{roll.totalCost}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <div>
                  <h3 className="font-semibold mb-2">Drinks Purchased</h3>
                  {monthlyStockSummary.drinks.length === 0 ? (
                    <p className="text-gray-500">No drinks this month</p>
                  ) : (
                    <div className="space-y-2">
                      {monthlyStockSummary.drinks.map((drink, index) => (
                        <div key={index} className="flex justify-between p-2 bg-gray-50 rounded">
                          <span>{drink.drinkName}: {drink.quantity} units on {drink.date}</span>
                          <span className="font-semibold">฿{drink.totalCost}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <div>
                  <h3 className="font-semibold mb-2">Meat Purchased</h3>
                  {monthlyStockSummary.meat.length === 0 ? (
                    <p className="text-gray-500">No meat this month</p>
                  ) : (
                    <div className="space-y-2">
                      {monthlyStockSummary.meat.map((meat, index) => (
                        <div key={index} className="flex justify-between p-2 bg-gray-50 rounded">
                          <span>{meat.meatType}: {meat.weight}kg on {meat.date}</span>
                          <span className="font-semibold">฿{meat.totalCost}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}

            {!isLoading && !error && !monthlyStockSummary && (
              <p className="text-gray-500">No data available</p>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}