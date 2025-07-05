import { useQuery } from "@tanstack/react-query";

interface MonthlyRevenueChartProps {
  data?: number[];
  labels?: string[];
}

interface MonthlyRevenue {
  year: number;
  month: number;
  revenue: number;
}

export default function MonthlyRevenueChart({ 
  data,
  labels
}: MonthlyRevenueChartProps) {
  
  // Historical data up until end of June 2025 (you'll provide this)
  const historicalData: MonthlyRevenue[] = [
    // You'll provide this data
    { year: 2024, month: 7, revenue: 45000 },
    { year: 2024, month: 8, revenue: 52000 },
    { year: 2024, month: 9, revenue: 48000 },
    { year: 2024, month: 10, revenue: 55000 },
    { year: 2024, month: 11, revenue: 58000 },
    { year: 2024, month: 12, revenue: 62000 },
    { year: 2025, month: 1, revenue: 48000 },
    { year: 2025, month: 2, revenue: 51000 },
    { year: 2025, month: 3, revenue: 54000 },
    { year: 2025, month: 4, revenue: 49000 },
    { year: 2025, month: 5, revenue: 56000 },
    { year: 2025, month: 6, revenue: 59000 }
  ];

  // Get current month's revenue from API (July 2025 onwards)
  const currentDate = new Date();
  const currentYear = currentDate.getFullYear();
  const currentMonth = currentDate.getMonth() + 1;

  const { data: currentMonthRevenue } = useQuery<{ total: number }>({
    queryKey: ["/api/loyverse/monthly-revenue", currentYear, currentMonth],
    queryFn: () => fetch(`/api/loyverse/monthly-revenue?year=${currentYear}&month=${currentMonth}`).then(res => res.json()),
    enabled: currentYear >= 2025 && currentMonth >= 7 // Only fetch from July 2025 onwards
  });

  // Combine historical data with current month if available
  const allMonthsData = [...historicalData];
  
  // Add current month if we have API data
  if (currentMonthRevenue && currentYear >= 2025 && currentMonth >= 7) {
    const existingIndex = allMonthsData.findIndex(item => 
      item.year === currentYear && item.month === currentMonth
    );
    
    if (existingIndex >= 0) {
      allMonthsData[existingIndex] = { year: currentYear, month: currentMonth, revenue: currentMonthRevenue.total };
    } else {
      allMonthsData.push({ year: currentYear, month: currentMonth, revenue: currentMonthRevenue.total });
    }
  }

  // Take last 24 months
  const last24Months = allMonthsData.slice(-24);
  const maxRevenue = Math.max(...last24Months.map(item => item.revenue));
  
  // Calculate average yearly revenue
  const totalRevenue = last24Months.reduce((sum, item) => sum + item.revenue, 0);
  const averageYearlyRevenue = (totalRevenue / 24) * 12; // Convert to yearly average

  return (
    <div className="relative overflow-hidden rounded-lg" style={{
      background: 'linear-gradient(135deg, #8CC152 0%, #6BA42D 100%)',
      minHeight: '180px',
      padding: '20px'
    }}>
      {/* Main Revenue Display */}
      <div className="mb-4">
        <div className="text-white text-2xl font-bold mb-1">
          ฿{averageYearlyRevenue.toLocaleString('en-US', { maximumFractionDigits: 0 })}
        </div>
        <div className="text-white/80 text-sm">
          Average Yearly Revenue Over Time
        </div>
      </div>

      {/* Bar Chart */}
      <div className="flex items-end justify-between h-16 mb-4">
        {last24Months.map((monthData, index) => {
          const barHeight = (monthData.revenue / maxRevenue) * 100;
          const year = monthData.year.toString().slice(-2); // Last 2 digits of year
          
          return (
            <div key={`${monthData.year}-${monthData.month}`} className="flex flex-col items-center">
              <div 
                className="bg-white/90 rounded-sm transition-all duration-300 hover:bg-white"
                style={{
                  width: '8px',
                  height: `${Math.max(barHeight, 5)}%`,
                  minHeight: '4px'
                }}
              />
            </div>
          );
        })}
      </div>

      {/* Year Labels */}
      <div className="flex justify-between text-white/70 text-xs">
        {/* Show year labels for specific positions */}
        <span>Jul '24</span>
        <span>Oct '24</span>
        <span>Jan '25</span>
        <span>Apr '25</span>
        <span>Jul '25</span>
      </div>
    </div>
  );
}
