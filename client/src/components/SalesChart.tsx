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
  
  // Authentic NET SALES data from your CSV file
  const historicalData: MonthlyRevenue[] = [
    { year: 2024, month: 8, revenue: 1188747.90 },  // Aug 2024
    { year: 2024, month: 9, revenue: 504602.17 },   // Sep 2024  
    { year: 2024, month: 10, revenue: 603361.47 },  // Oct 2024
    { year: 2024, month: 11, revenue: 644497.10 },  // Nov 2024
    { year: 2024, month: 12, revenue: 710170.10 },  // Dec 2024
    { year: 2025, month: 1, revenue: 711206.50 },   // Jan 2025
    { year: 2025, month: 2, revenue: 729417.30 },   // Feb 2025
    { year: 2025, month: 3, revenue: 827838.00 },   // Mar 2025
    { year: 2025, month: 4, revenue: 677521.30 },   // Apr 2025
    { year: 2025, month: 5, revenue: 618430.80 },   // May 2025
    { year: 2025, month: 6, revenue: 455860.80 },   // Jun 2025
    { year: 2025, month: 7, revenue: 55607.90 }     // Jul 2025 (partial)
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
      minHeight: '280px',
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
      <div className="flex items-end justify-between h-32 mb-4 gap-1">
        {last24Months.map((monthData, index) => {
          const barHeight = (monthData.revenue / maxRevenue) * 120; // Use 120px instead of percentage
          const monthName = new Date(monthData.year, monthData.month - 1).toLocaleString('default', { month: 'short' });
          
          return (
            <div key={`${monthData.year}-${monthData.month}`} className="flex flex-col items-center group relative">
              <div 
                className="bg-white/90 rounded-sm transition-all duration-300 hover:bg-white cursor-pointer"
                style={{
                  width: '6px',
                  height: `${Math.max(barHeight, 8)}px`,
                  minHeight: '8px'
                }}
                title={`${monthName} ${monthData.year}: ฿${monthData.revenue.toLocaleString()}`}
              />
              {/* Tooltip */}
              <div className="absolute bottom-full mb-2 hidden group-hover:block bg-black/80 text-white text-xs px-2 py-1 rounded whitespace-nowrap z-10">
                {monthName} {monthData.year}: ฿{monthData.revenue.toLocaleString()}
              </div>
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
