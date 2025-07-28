import { useQuery } from '@tanstack/react-query';
import { format } from "date-fns";
import { Separator } from "@/components/ui/separator";

const MonthlyStockDisplay = () => {
  const { data: monthlyStockSummary, isLoading, error } = useQuery<{
    rolls: Array<{ quantity: number; totalCost: string; date: string }>;
    drinks: Array<{ drinkName: string; quantity: number; totalCost: string; date: string }>;
    meat: Array<{ meatType: string; weight: string; totalCost: string; date: string }>;
  }>({
    queryKey: ["/api/stock-purchase/monthly-summary"],
    enabled: true,
    retry: 3,
  });

  const formatCurrency = (amount: string | number) => {
    const num = typeof amount === 'string' ? parseFloat(amount) : amount;
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'THB',
      minimumFractionDigits: 2,
    }).format(num);
  };

  console.log("MonthlyStockDisplay - Data:", monthlyStockSummary);
  console.log("MonthlyStockDisplay - Loading:", isLoading);
  console.log("MonthlyStockDisplay - Error:", error);

  if (isLoading) {
    return (
      <div className="text-center py-4">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-green-500 mx-auto"></div>
        <p className="mt-2 text-green-600">Loading stock data...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">
        <strong>Error:</strong> {JSON.stringify(error)}
      </div>
    );
  }

  if (!monthlyStockSummary) {
    return (
      <div className="text-center py-4">
        <p className="text-gray-500">No stock data available</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Debug Info */}
      <div className="text-xs bg-green-100 p-3 rounded border">
        <strong>Stock Summary Data Available:</strong><br/>
        Rolls: {monthlyStockSummary.rolls?.length || 0} entries<br/>
        Drinks: {monthlyStockSummary.drinks?.length || 0} entries<br/>
        Meat: {monthlyStockSummary.meat?.length || 0} entries
      </div>

      {/* Rolls Section */}
      <div>
        <h4 className="font-semibold text-sm mb-3 text-gray-900">Rolls Purchased</h4>
        {monthlyStockSummary.rolls.length === 0 ? (
          <p className="text-sm text-gray-500">No rolls purchased this month</p>
        ) : (
          <div className="space-y-2">
            {monthlyStockSummary.rolls.map((roll, index) => (
              <div key={index} className="flex justify-between items-center p-2 bg-gray-50 rounded">
                <div>
                  <span className="text-sm font-medium">{roll.quantity} rolls</span>
                  <span className="text-xs text-gray-500 block">
                    {format(new Date(roll.date), 'MMM dd, yyyy')}
                  </span>
                </div>
                <span className="text-sm font-semibold">{formatCurrency(roll.totalCost)}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      <Separator />

      {/* Drinks Section */}
      <div>
        <h4 className="font-semibold text-sm mb-3 text-gray-900">Drinks Purchased</h4>
        {monthlyStockSummary.drinks.length === 0 ? (
          <p className="text-sm text-gray-500">No drinks purchased this month</p>
        ) : (
          <div className="space-y-2">
            {monthlyStockSummary.drinks.map((drink, index) => (
              <div key={index} className="flex justify-between items-center p-2 bg-gray-50 rounded">
                <div>
                  <span className="text-sm font-medium">{drink.drinkName}</span>
                  <span className="text-xs text-gray-500 block">
                    {drink.quantity} units • {format(new Date(drink.date), 'MMM dd, yyyy')}
                  </span>
                </div>
                <span className="text-sm font-semibold">{formatCurrency(drink.totalCost)}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      <Separator />

      {/* Meat Section */}
      <div>
        <h4 className="font-semibold text-sm mb-3 text-gray-900">Meat Purchased</h4>
        {monthlyStockSummary.meat.length === 0 ? (
          <p className="text-sm text-gray-500">No meat purchased this month</p>
        ) : (
          <div className="space-y-2">
            {monthlyStockSummary.meat.map((meat, index) => (
              <div key={index} className="flex justify-between items-center p-2 bg-gray-50 rounded">
                <div>
                  <span className="text-sm font-medium">{meat.meatType}</span>
                  <span className="text-xs text-gray-500 block">
                    {meat.weight}kg • {format(new Date(meat.date), 'MMM dd, yyyy')}
                  </span>
                </div>
                <span className="text-sm font-semibold">{formatCurrency(meat.totalCost)}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default MonthlyStockDisplay;