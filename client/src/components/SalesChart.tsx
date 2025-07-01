import { useEffect, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

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
  // Get real Loyverse shift data
  const { data: shiftReports, isLoading } = useQuery<ShiftReport[]>({
    queryKey: ["/api/loyverse/shift-reports"],
    queryFn: () => fetch("/api/loyverse/shift-reports?limit=7").then(res => res.json())
  });

  // Process real Loyverse data
  const chartData = data || (shiftReports ? 
    shiftReports.slice(0, 6).reverse().map(report => parseFloat(report.totalSales)) : 
    []
  );
  
  const chartLabels = labels || (shiftReports ? 
    shiftReports.slice(0, 6).reverse().map(report => {
      const date = new Date(report.shiftDate);
      return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    }) : 
    []
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
    const maxValue = Math.max(...data);
    const minValue = Math.min(...data);
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
    
    data.forEach((value, index) => {
      const x = padding + (width / (data.length - 1)) * index;
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

    // Draw line
    ctx.strokeStyle = '#F5D016';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(points[0].x, points[0].y);
    points.forEach((point, index) => {
      if (index > 0) {
        // Create smooth curve
        const prevPoint = points[index - 1];
        const cpX = (prevPoint.x + point.x) / 2;
        ctx.quadraticCurveTo(cpX, prevPoint.y, point.x, point.y);
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
    labels.forEach((label, index) => {
      const x = padding + (width / (labels.length - 1)) * index;
      ctx.fillText(label, x, padding + height + 20);
    });

  }, [data, labels]);

  return (
    <Card className="restaurant-card">
      <CardHeader>
        <div className="flex justify-between items-center">
          <CardTitle className="text-lg font-semibold text-gray-900">Sales Overview</CardTitle>
          <Select defaultValue="6months">
            <SelectTrigger className="w-36">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="6months">Last 6 Months</SelectItem>
              <SelectItem value="1year">Last Year</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </CardHeader>
      <CardContent>
        <div className="chart-container">
          <canvas 
            ref={canvasRef}
            className="w-full h-full"
            style={{ width: '100%', height: '320px' }}
          />
        </div>
      </CardContent>
    </Card>
  );
}
