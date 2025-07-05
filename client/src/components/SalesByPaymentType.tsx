import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useQuery } from "@tanstack/react-query";
import { CreditCard } from "lucide-react";

interface PaymentTypeData {
  name: string;
  value: number;
  amount: number;
  color: string;
}

export default function SalesByPaymentType() {
  const { data: paymentData, isLoading } = useQuery<PaymentTypeData[]>({
    queryKey: ["/api/loyverse/sales-by-payment-type"],
    refetchInterval: 60000, // Refresh every minute
  });

  // Create SVG donut chart matching the attached image exactly
  const DonutChart = ({ data }: { data: PaymentTypeData[] }) => {
    const size = 200;
    const strokeWidth = 32; // Much thicker like the reference
    const center = size / 2;
    const radius = center - strokeWidth / 2;
    const circumference = 2 * Math.PI * radius;
    
    // Only show 270 degrees (3/4 circle) like the reference image
    const maxAngle = 270;
    const startAngle = 225; // Start from bottom left
    
    let accumulatedPercentage = 0;
    
    return (
      <div className="flex flex-col items-center">
        <svg width={size} height={size} className="transform" style={{ transform: `rotate(${startAngle}deg)` }}>
          {/* Background arc - only 3/4 circle */}
          <circle
            cx={center}
            cy={center}
            r={radius}
            fill="transparent"
            stroke="#f1f5f9"
            strokeWidth={strokeWidth}
            strokeDasharray={`${(maxAngle / 360) * circumference} ${circumference}`}
            strokeLinecap="round"
          />
          {/* Data segments */}
          {data.map((item, index) => {
            const segmentAngle = (item.value / 100) * maxAngle;
            const strokeDasharray = `${(segmentAngle / 360) * circumference} ${circumference}`;
            const strokeDashoffset = -(accumulatedPercentage / 100) * (maxAngle / 360) * circumference;
            accumulatedPercentage += item.value;
            
            return (
              <circle
                key={index}
                cx={center}
                cy={center}
                r={radius}
                fill="transparent"
                stroke={item.color}
                strokeWidth={strokeWidth}
                strokeDasharray={strokeDasharray}
                strokeDashoffset={strokeDashoffset}
                strokeLinecap="round"
                className="transition-all duration-300 hover:opacity-90"
              />
            );
          })}
        </svg>
      </div>
    );
  };

  if (isLoading) {
    return (
      <Card className="bg-white border border-gray-200 rounded-lg shadow-sm">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm font-medium text-gray-900">
              Sales by Payment Type
            </CardTitle>
            <span className="text-xs text-gray-400">Report →</span>
          </div>
        </CardHeader>
        <CardContent className="pt-0">
          <div className="h-48 flex items-center justify-center">
            <div className="text-sm text-gray-500">Loading...</div>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!paymentData || paymentData.length === 0) {
    return (
      <Card className="bg-white border border-gray-200 rounded-lg shadow-sm">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm font-medium text-gray-900">
              Sales by Payment Type
            </CardTitle>
            <span className="text-xs text-gray-400">Report →</span>
          </div>
        </CardHeader>
        <CardContent className="pt-0">
          <div className="h-48 flex items-center justify-center">
            <div className="text-sm text-gray-500">No data available</div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="bg-white border border-gray-200 rounded-lg shadow-sm">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-medium text-gray-900">
            Sales by Payment Type
          </CardTitle>
          <span className="text-xs text-gray-400">Report →</span>
        </div>
      </CardHeader>
      <CardContent className="pt-0">
        <div className="flex flex-col items-center">
          {/* Donut Chart */}
          <div className="mb-6">
            <DonutChart data={paymentData} />
          </div>
          
          {/* Legend */}
          <div className="flex flex-wrap justify-center gap-4">
            {paymentData.map((item, index) => (
              <div key={index} className="flex items-center gap-2">
                <div 
                  className="w-3 h-3 rounded-full" 
                  style={{ backgroundColor: item.color }}
                />
                <span className="text-sm text-gray-700 font-medium">{item.name}</span>
              </div>
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}