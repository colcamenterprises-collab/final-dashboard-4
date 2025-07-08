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
    <Card className="restaurant-card">
      <CardContent className="p-4 sm:p-6">
        <div className="flex items-center justify-between">
          <div className="flex-1 min-w-0">
            <p className="text-xs sm:text-sm font-medium text-gray-600 truncate">{title}</p>
            <p className="text-xl sm:text-2xl font-bold text-gray-900 mt-1">{value}</p>
            {change && (
              <p className={`text-xs sm:text-sm mt-1 ${changeColors[changeType]} truncate`}>
                {change}
              </p>
            )}
          </div>
          <div className={`w-10 h-10 sm:w-12 sm:h-12 ${iconBgColor} rounded-lg flex items-center justify-center flex-shrink-0 ml-3`}>
            <Icon className={`${iconColor} text-lg sm:text-xl`} />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
