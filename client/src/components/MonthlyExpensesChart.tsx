import { useQuery } from "@tanstack/react-query";
import { TrendingDown, CreditCard } from "lucide-react";

export default function MonthlyExpensesChart() {
  const { data: mtdExpenses } = useQuery<{ total: number }>({
    queryKey: ["/api/expenses/month-to-date"],
  });

  // Generate sample monthly data for the chart
  const monthlyExpenseData = [
    { month: 'Jan', amount: 28500 },
    { month: 'Feb', amount: 31200 },
    { month: 'Mar', amount: 29800 },
    { month: 'Apr', amount: 26700 },
    { month: 'May', amount: 30100 },
    { month: 'Jun', amount: 32400 },
    { month: 'Jul', amount: mtdExpenses?.total || 15458 },
  ];

  const maxAmount = Math.max(...monthlyExpenseData.map(item => item.amount));
  const currentMonthAmount = mtdExpenses?.total || 15458;

  return (
    <div className="relative overflow-hidden rounded-lg" style={{
      background: 'linear-gradient(135deg, #FF6B6B 0%, #D63447 100%)',
      minHeight: '280px',
      padding: '20px'
    }}>
      {/* Main Expenses Display */}
      <div className="mb-4">
        <div className="text-white text-2xl font-bold mb-1">
          ฿{currentMonthAmount.toLocaleString()}
        </div>
        <div className="text-white/80 text-sm">
          Monthly Expenses (July 2025)
        </div>
      </div>

      {/* Bar Chart */}
      <div className="flex items-end justify-between h-32 mb-4 gap-1">
        {monthlyExpenseData.map((monthData, index) => {
          const barHeight = (monthData.amount / maxAmount) * 120;
          const isCurrentMonth = monthData.month === 'Jul';
          
          return (
            <div key={monthData.month} className="flex flex-col items-center group relative">
              <div 
                className={`rounded-sm transition-all duration-300 cursor-pointer ${
                  isCurrentMonth 
                    ? 'bg-white/95 hover:bg-white' 
                    : 'bg-white/70 hover:bg-white/90'
                }`}
                style={{
                  width: '12px',
                  height: `${Math.max(barHeight, 8)}px`,
                  minHeight: '8px'
                }}
                title={`${monthData.month}: ฿${monthData.amount.toLocaleString()}`}
              />
              {/* Tooltip */}
              <div className="absolute bottom-full mb-2 hidden group-hover:block bg-black/80 text-white text-xs px-2 py-1 rounded whitespace-nowrap z-10">
                {monthData.month}: ฿{monthData.amount.toLocaleString()}
              </div>
            </div>
          );
        })}
      </div>

      {/* Month Labels */}
      <div className="flex justify-between text-white/70 text-xs">
        {monthlyExpenseData.map(month => (
          <span key={month.month}>{month.month}</span>
        ))}
      </div>

      {/* Expense Icon */}
      <div className="absolute top-4 right-4">
        <div className="bg-white/20 p-2 rounded-lg">
          <CreditCard className="h-5 w-5 text-white" />
        </div>
      </div>

      {/* Trend Indicator */}
      <div className="absolute bottom-4 right-4 flex items-center gap-1 text-white/80 text-xs">
        <TrendingDown className="h-3 w-3" />
        <span>vs last month</span>
      </div>
    </div>
  );
}