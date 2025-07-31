import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Wifi, WifiOff, RefreshCw } from "lucide-react";
import { Link } from "wouter";

interface LoyverseConnectionProps {
  compact?: boolean;
}

interface LoyverseStatus {
  connected: boolean;
  message: string;
}

export default function LoyverseConnectionStatus({ compact = false }: LoyverseConnectionProps) {
  const { data: status, isLoading, refetch } = useQuery<LoyverseStatus>({
    queryKey: ["/api/loyverse/live/status"],
    refetchInterval: 10000, // Check every 10 seconds
  });

  const handleRefresh = () => {
    refetch();
  };

  if (compact) {
    return (
      <Card className="w-full">
        <CardContent className="p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              {isLoading ? (
                <RefreshCw className="h-4 w-4 animate-spin text-muted-foreground" />
              ) : status?.connected ? (
                <Wifi className="h-4 w-4 text-green-600" />
              ) : (
                <WifiOff className="h-4 w-4 text-red-500" />
              )}
              <span className="text-sm font-medium">Loyverse POS</span>
            </div>
            <div className="flex items-center space-x-2">
              <Badge 
                variant={
                  isLoading ? "secondary" : 
                  status?.connected ? "default" : 
                  "destructive"
                }
                className={
                  status?.connected ? "bg-green-100 text-green-800 border-green-200" : ""
                }
              >
                {isLoading ? "Checking..." : status?.connected ? "Connected" : "Disconnected"}
              </Badge>
              <Link href="/pos-loyverse">
                <Button variant="ghost" size="sm" className="h-6 px-2 text-xs">
                  Manage
                </Button>
              </Link>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium flex items-center space-x-2">
          {isLoading ? (
            <RefreshCw className="h-4 w-4 animate-spin text-muted-foreground" />
          ) : status?.connected ? (
            <Wifi className="h-4 w-4 text-green-600" />
          ) : (
            <WifiOff className="h-4 w-4 text-red-500" />
          )}
          <span>Loyverse POS</span>
        </CardTitle>
        <Button
          variant="ghost"
          size="sm"
          onClick={handleRefresh}
          className="h-6 w-6 p-0"
        >
          <RefreshCw className="h-3 w-3" />
        </Button>
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold mb-2">
          <Badge 
            variant={
              isLoading ? "secondary" : 
              status?.connected ? "default" : 
              "destructive"
            }
            className={
              status?.connected ? "bg-green-100 text-green-800 border-green-200" : ""
            }
          >
            {isLoading ? "Checking..." : status?.connected ? "Connected" : "Disconnected"}
          </Badge>
        </div>
        <p className="text-xs text-muted-foreground">
          {isLoading ? "Checking connection..." : 
           status?.connected ? "Real-time sync active" : 
           "Connection failed"}
        </p>
        <div className="mt-3">
          <Link href="/pos-loyverse">
            <Button variant="outline" size="sm" className="w-full">
              Manage Integration
            </Button>
          </Link>
        </div>
      </CardContent>
    </Card>
  );
}