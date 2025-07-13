import { Card, CardContent } from "@/components/ui/card";
import { LucideIcon } from "lucide-react";

interface KPICardProps {
  title: string;
  value: string | number;
  change?: string;
  changeType?: "positive" | "negative" | "neutral";
  icon: LucideIcon;
  iconColor?: string;
  iconBgColor?: string;
}

export default function KPICard({ 
  title, 
  value, 
  change, 
  changeType = "neutral", 
  icon: Icon,
  iconColor = "text-primary",
  iconBgColor = "bg-primary/20"
}: KPICardProps) {
  const changeColors = {
    positive: "text-green-600",
    negative: "text-red-600",
    neutral: "text-yellow-600"
  };

  return (
    <Card className="restaurant-card min-h-[120px] sm:min-h-[140px]">
      <CardContent className="p-3 sm:p-4 md:p-6 h-full">
        <div className="flex items-center justify-between">
          <div className="flex-1 min-w-0">
            <p className="text-xs sm:text-sm font-medium text-gray-600 truncate">{title}</p>
            <p className="text-lg sm:text-xl md:text-2xl font-bold text-gray-900 mt-1 break-words">{value}</p>
            {change && (
              <p className={`text-xs sm:text-sm mt-1 ${changeColors[changeType]} truncate`}>
                {change}
              </p>
            )}
          </div>
          <div className={`w-8 h-8 sm:w-10 sm:h-10 md:w-12 md:h-12 ${iconBgColor} rounded-lg flex items-center justify-center flex-shrink-0 ml-2 sm:ml-3`}>
            <Icon className={`${iconColor} text-base sm:text-lg md:text-xl`} />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
