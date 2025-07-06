import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Bot, AlertTriangle, TrendingUp, CheckCircle, Clock } from "lucide-react";

interface AIInsight {
  type: 'alert' | 'recommendation' | 'optimization';
  severity: 'low' | 'medium' | 'high';
  title: string;
  description: string;
  action?: string;
}

export default function AIInsightsCard() {
  const { data: aiInsights } = useQuery<AIInsight[]>({
    queryKey: ["/api/dashboard/ai-insights"],
    refetchInterval: 10000, // Update every 10 seconds
  });

  const getIcon = (type: string) => {
    switch (type) {
      case 'alert':
        return <AlertTriangle className="h-4 w-4" />;
      case 'recommendation':
        return <TrendingUp className="h-4 w-4" />;
      case 'optimization':
        return <CheckCircle className="h-4 w-4" />;
      default:
        return <Bot className="h-4 w-4" />;
    }
  };

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'high':
        return 'bg-red-50 border-red-200 text-red-800';
      case 'medium':
        return 'bg-yellow-50 border-yellow-200 text-yellow-800';
      case 'low':
        return 'bg-blue-50 border-blue-200 text-blue-800';
      default:
        return 'bg-gray-50 border-gray-200 text-gray-800';
    }
  };

  return (
    <Card className="h-full">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-lg font-semibold text-gray-900">
          <Bot className="h-5 w-5 text-blue-600" />
          AI Insights
          <Badge variant="secondary" className="bg-yellow-100 text-yellow-800 text-xs">
            Live
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {aiInsights && aiInsights.length > 0 ? (
          aiInsights.slice(0, 3).map((insight, index) => (
            <div
              key={index}
              className={`p-3 rounded-lg border ${getSeverityColor(insight.severity)}`}
            >
              <div className="flex items-start gap-2 mb-2">
                {getIcon(insight.type)}
                <div className="flex-1 min-w-0">
                  <h4 className="font-medium text-sm mb-1">{insight.title}</h4>
                  <p className="text-xs opacity-90 leading-relaxed">
                    {insight.description}
                  </p>
                </div>
              </div>
              
              {insight.action && (
                <Button
                  variant="outline"
                  size="sm"
                  className="w-full mt-2 h-7 text-xs"
                >
                  <CheckCircle className="h-3 w-3 mr-1" />
                  Resolve
                </Button>
              )}
            </div>
          ))
        ) : (
          <div className="text-center py-8">
            <div className="flex items-center justify-center mb-2">
              <Clock className="h-8 w-8 text-gray-400" />
            </div>
            <div className="text-gray-500 text-sm font-medium">Analyzing data...</div>
            <div className="text-gray-400 text-xs mt-1">AI insights will appear here</div>
          </div>
        )}
        
        {aiInsights && aiInsights.length > 3 && (
          <Button variant="ghost" size="sm" className="w-full text-xs">
            View {aiInsights.length - 3} more insights
          </Button>
        )}
      </CardContent>
    </Card>
  );
}