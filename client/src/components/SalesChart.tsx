import { useEffect, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Calendar } from "lucide-react";

interface SalesChartProps {
  data?: number[];
  labels?: string[];
}

interface ShiftReport {
  id: number;
  shiftDate: string;
  totalSales: string;
  totalTransactions: number;
}

export default function SalesChart({ 
  data,
  labels
}: SalesChartProps) {
  const [startDate, setStartDate] = useState<string>('2025-07-01');
  const [endDate, setEndDate] = useState<string>('2025-07-04');
  const [selectedRange, setSelectedRange] = useState<string>('4days');

  // Get real Loyverse shift data with date range
  const { data: shiftReports, isLoading } = useQuery<ShiftReport[]>({
    queryKey: ["/api/loyverse/shift-reports", startDate, endDate],
    queryFn: () => fetch(`/api/loyverse/shift-reports?startDate=${startDate}&endDate=${endDate}&limit=30`).then(res => res.json())
  });

  // Handle date range changes
  const handleRangeChange = (range: string) => {
    setSelectedRange(range);
    const today = new Date();
    const todayStr = today.toISOString().split('T')[0];
    
    switch (range) {
      case '4days':
        setStartDate('2025-07-01');
        setEndDate('2025-07-04');
        break;
      case '7days':
        setStartDate('2025-06-28');
        setEndDate('2025-07-04');
        break;
      case 'custom':
        // Keep current dates for custom range
        break;
    }
  };

  // Process ONLY authentic Loyverse API data - no fallbacks
  const chartData = data || (shiftReports && shiftReports.length > 0 ? 
    shiftReports.map(report => parseFloat(report.totalSales)) : 
    [] // Empty if no authentic data available
  );
  
  const chartLabels = labels || (shiftReports && shiftReports.length > 0 ? 
    shiftReports.map(report => {
      const date = new Date(report.shiftDate);
      return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    }) : 
    [] // Empty if no authentic data available
  );
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    if (!canvasRef.current) return;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Set canvas size
    canvas.width = canvas.offsetWidth * window.devicePixelRatio;
    canvas.height = canvas.offsetHeight * window.devicePixelRatio;
    ctx.scale(window.devicePixelRatio, window.devicePixelRatio);

    // Clear canvas
    ctx.clearRect(0, 0, canvas.offsetWidth, canvas.offsetHeight);

    // Chart dimensions
    const padding = 40;
    const width = canvas.offsetWidth - padding * 2;
    const height = canvas.offsetHeight - padding * 2;

    // Data processing
    const maxValue = Math.max(...chartData);
    const minValue = Math.min(...chartData);
    const range = maxValue - minValue;

    // Draw grid lines
    ctx.strokeStyle = 'rgba(0, 0, 0, 0.05)';
    ctx.lineWidth = 1;
    for (let i = 0; i <= 5; i++) {
      const y = padding + (height / 5) * i;
      ctx.beginPath();
      ctx.moveTo(padding, y);
      ctx.lineTo(padding + width, y);
      ctx.stroke();
    }

    // Plot data points and lines
    const points: Array<{x: number, y: number}> = [];
    
    chartData.forEach((value, index) => {
      const x = padding + (width / (chartData.length - 1)) * index;
      const y = padding + height - ((value - minValue) / range) * height;
      points.push({ x, y });
    });

    // Draw area fill
    ctx.fillStyle = 'rgba(245, 208, 22, 0.1)';
    ctx.beginPath();
    ctx.moveTo(points[0].x, padding + height);
    points.forEach(point => ctx.lineTo(point.x, point.y));
    ctx.lineTo(points[points.length - 1].x, padding + height);
    ctx.closePath();
    ctx.fill();

    // Draw line connecting actual data points (no smooth curves)
    ctx.strokeStyle = '#F5D016';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(points[0].x, points[0].y);
    points.forEach((point, index) => {
      if (index > 0) {
        // Draw straight lines between actual data points
        ctx.lineTo(point.x, point.y);
      }
    });
    ctx.stroke();

    // Draw data points
    ctx.fillStyle = '#F5D016';
    points.forEach(point => {
      ctx.beginPath();
      ctx.arc(point.x, point.y, 4, 0, 2 * Math.PI);
      ctx.fill();
    });

    // Draw labels
    ctx.fillStyle = '#666';
    ctx.font = '12px Inter';
    ctx.textAlign = 'center';
    chartLabels.forEach((label, index) => {
      const x = padding + (width / (chartLabels.length - 1)) * index;
      ctx.fillText(label, x, padding + height + 20);
    });

  }, [chartData, chartLabels]);

  return (
    <Card className="restaurant-card">
      <CardHeader>
        <div className="flex justify-between items-center mb-4">
          <CardTitle className="text-lg font-semibold text-gray-900">Sales Overview</CardTitle>
          <div className="flex gap-2">
            <Select value={selectedRange} onValueChange={handleRangeChange}>
              <SelectTrigger className="w-36">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="4days">Last 4 Days</SelectItem>
                <SelectItem value="7days">Last 7 Days</SelectItem>
                <SelectItem value="custom">Custom Range</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
        {selectedRange === 'custom' && (
          <div className="flex gap-2 mb-4">
            <div className="flex flex-col">
              <label className="text-xs text-gray-500 mb-1">Start Date</label>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="px-3 py-1 border rounded text-sm"
              />
            </div>
            <div className="flex flex-col">
              <label className="text-xs text-gray-500 mb-1">End Date</label>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="px-3 py-1 border rounded text-sm"
              />
            </div>
          </div>
        )}
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="flex items-center justify-center h-80">
            <div className="text-gray-500">Loading authentic Loyverse data...</div>
          </div>
        ) : chartData.length === 0 ? (
          <div className="flex items-center justify-center h-80">
            <div className="text-gray-500">No authentic Loyverse data available for this date range</div>
          </div>
        ) : (
          <div className="chart-container">
            <canvas 
              ref={canvasRef}
              className="w-full h-full"
              style={{ width: '100%', height: '320px' }}
            />
          </div>
        )}
      </CardContent>
    </Card>
  );
}
