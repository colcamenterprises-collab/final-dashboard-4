import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";

export function useRealTimeData<T>(
  queryKey: string[],
  queryFn: () => Promise<T>,
  intervalMs: number = 30000
) {
  const [isLive, setIsLive] = useState(true);

  const query = useQuery({
    queryKey,
    queryFn,
    refetchInterval: isLive ? intervalMs : false,
    refetchIntervalInBackground: true,
  });

  const toggleLive = () => setIsLive(!isLive);

  useEffect(() => {
    // Simulate real-time updates for demo purposes
    if (isLive) {
      const interval = setInterval(() => {
        query.refetch();
      }, intervalMs);

      return () => clearInterval(interval);
    }
  }, [isLive, intervalMs, query]);

  return {
    ...query,
    isLive,
    toggleLive,
  };
}

export function useMockRealTimeUpdates(initialData: any[], updateInterval: number = 5000) {
  const [data, setData] = useState(initialData);

  useEffect(() => {
    const interval = setInterval(() => {
      setData(prevData => 
        prevData.map(item => ({
          ...item,
          // Update timestamps for real-time feel
          timestamp: item.timestamp ? new Date().toISOString() : item.timestamp,
          time: item.time ? "Just now" : item.time
        }))
      );
    }, updateInterval);

    return () => clearInterval(interval);
  }, [updateInterval]);

  return data;
}
