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

  const { data: apiMonthRevenue } = useQuery<{ total: number }>({
    queryKey: ["/api/loyverse/monthly-revenue", currentYear, currentMonth],
    queryFn: () => fetch(`/api/loyverse/monthly-revenue?year=${currentYear}&month=${currentMonth}`).then(res => res.json()),
    enabled: currentYear >= 2025 && currentMonth >= 7 // Only fetch from July 2025 onwards
  });

  // Combine historical data with current month if available
  const allMonthsData = [...historicalData];
  
  // Add current month if we have API data
  if (apiMonthRevenue && currentYear >= 2025 && currentMonth >= 7) {
    const existingIndex = allMonthsData.findIndex(item => 
      item.year === currentYear && item.month === currentMonth
    );
    
    if (existingIndex >= 0) {
      allMonthsData[existingIndex] = { year: currentYear, month: currentMonth, revenue: apiMonthRevenue.total };
    } else {
      allMonthsData.push({ year: currentYear, month: currentMonth, revenue: apiMonthRevenue.total });
    }
  }

  // Take last 24 months
  const last24Months = allMonthsData.slice(-24);
  
  // Calculate average yearly revenue
  const totalRevenue = last24Months.reduce((sum, item) => sum + item.revenue, 0);
  const averageYearlyRevenue = (totalRevenue / 24) * 12; // Convert to yearly average

  // Generate monthly revenue data for the chart (keeping the original revenue functionality)
  const monthlyRevenueData = [
    { month: 'Jan', revenue: last24Months[12]?.revenue || 85000 },
    { month: 'Feb', revenue: last24Months[13]?.revenue || 95000 },
    { month: 'Mar', revenue: last24Months[14]?.revenue || 78000 },
    { month: 'Apr', revenue: last24Months[15]?.revenue || 88000 },
    { month: 'May', revenue: last24Months[16]?.revenue || 92000 },
    { month: 'Jun', revenue: last24Months[17]?.revenue || 105000 },
    { month: 'Jul', revenue: last24Months[18]?.revenue || 98000 },
  ];

  const maxRevenue = Math.max(...monthlyRevenueData.map(item => item.revenue));
  const currentMonthRevenue = monthlyRevenueData[6].revenue; // July

  return (
    <div className="bg-white rounded-lg border border-gray-200 p-6" style={{ minHeight: '280px' }}>
      {/* Header */}
      <div className="flex justify-between items-center mb-6">
        <h3 className="text-lg font-semibold text-gray-900">Revenue Summary</h3>
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
          {monthlyRevenueData.map((monthData, index) => {
            const barHeight = (monthData.revenue / maxRevenue) * 140;
            
            return (
              <div key={monthData.month} className="flex flex-col items-center group relative flex-1">
                <div 
                  className="bg-teal-600 rounded-sm transition-all duration-300 cursor-pointer hover:bg-teal-700 w-full max-w-8"
                  style={{
                    height: `${Math.max(barHeight, 8)}px`,
                    minHeight: '8px'
                  }}
                  title={`${monthData.month}: ฿${monthData.revenue.toLocaleString()}`}
                />
                {/* Tooltip */}
                <div className="absolute bottom-full mb-2 hidden group-hover:block bg-black/80 text-white text-xs px-2 py-1 rounded whitespace-nowrap z-10">
                  {monthData.month}: ฿{monthData.revenue.toLocaleString()}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* X-axis labels */}
      <div className="ml-8 flex justify-between text-xs text-gray-500">
        {monthlyRevenueData.map(month => (
          <span key={month.month} className="text-center flex-1">{month.month}</span>
        ))}
      </div>

      {/* Revenue total indicator */}
      <div className="mt-4 text-center">
        <div className="text-sm text-gray-500">Average Yearly Revenue</div>
        <div className="text-lg font-semibold text-gray-900">
          ฿{averageYearlyRevenue.toLocaleString('en-US', { maximumFractionDigits: 0 })}
        </div>
      </div>
    </div>
  );
}
