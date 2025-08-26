import { useQuery } from "@tanstack/react-query";
import { TrendingDown, CreditCard } from "lucide-react";

export default function MonthlyExpensesChart() {
  const { data: mtdExpenses } = useQuery<{ total: number }>({
    queryKey: ["/api/expensesV2/month-to-date"],
  });

  // Generate sample daily data for the chart (like the sample design)
  const dailyExpenseData = [
    { day: 'Mo', amount: 2100 },
    { day: 'Tu', amount: 3200 },
    { day: 'We', amount: 1800 },
    { day: 'Th', amount: 1200 },
    { day: 'Fr', amount: 2400 },
    { day: 'Sa', amount: 3600 },
    { day: 'Su', amount: 1800 },
  ];

  const maxAmount = Math.max(...dailyExpenseData.map(item => item.amount));
  const currentMonthAmount = mtdExpenses?.total || 15458;

  return (
    <div className="bg-white rounded-lg border border-gray-200 p-6" style={{ minHeight: '280px' }}>
      {/* Header */}
      <div className="flex justify-between items-center mb-6">
        <h3 className="text-lg font-semibold text-gray-900">Expense Summary</h3>
        <button className="text-sm text-gray-500 hover:text-gray-700 flex items-center gap-1">
          Report
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
        </button>
      </div>

      {/* Bar Chart */}
      <div className="relative h-40 mb-4">
        {/* Y-axis labels */}
        <div className="absolute left-0 top-0 h-full flex flex-col justify-between text-xs text-gray-500">
          <span>4k</span>
          <span>3k</span>
          <span>2k</span>
          <span>1k</span>
          <span>0</span>
        </div>
        
        {/* Chart area */}
        <div className="ml-8 h-full flex items-end justify-between gap-2">
          {dailyExpenseData.map((dayData, index) => {
            const barHeight = (dayData.amount / maxAmount) * 140;
            
            return (
              <div key={dayData.day} className="flex flex-col items-center group relative flex-1">
                <div 
                  className="bg-teal-600 rounded-sm transition-all duration-300 cursor-pointer hover:bg-teal-700 w-full max-w-8"
                  style={{
                    height: `${Math.max(barHeight, 8)}px`,
                    minHeight: '8px'
                  }}
                  title={`${dayData.day}: ฿${dayData.amount.toLocaleString()}`}
                />
                {/* Tooltip */}
                <div className="absolute bottom-full mb-2 hidden group-hover:block bg-black/80 text-white text-xs px-2 py-1 rounded whitespace-nowrap z-10">
                  {dayData.day}: ฿{dayData.amount.toLocaleString()}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* X-axis labels */}
      <div className="ml-8 flex justify-between text-xs text-gray-500">
        {dailyExpenseData.map(day => (
          <span key={day.day} className="text-center flex-1">{day.day}</span>
        ))}
      </div>

      {/* Total expenses indicator */}
      <div className="mt-4 text-center">
        <div className="text-sm text-gray-500">Monthly Total</div>
        <div className="text-lg font-semibold text-gray-900">
          ฿{currentMonthAmount.toLocaleString()}
        </div>
      </div>
    </div>
  );
}