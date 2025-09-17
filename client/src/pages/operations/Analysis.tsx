import { useQuery } from '@tanstack/react-query';
import { Link, Outlet } from 'react-router-dom';
import axios from 'axios';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { BarChart3 } from 'lucide-react';

export const AnalysisPage = () => {
  // Add stats query for overview cards
  const { data: stats } = useQuery({
    queryKey: ['analysisStats'],
    queryFn: () => axios.get('/api/operations/stats').then(res => res.data)
  });

  return (
    <div className="p-6 space-y-6" data-testid="analysis-page">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Analysis Dashboard</h1>
        <p className="text-gray-600">Comprehensive analytics and reporting for restaurant operations</p>
      </div>
      
      {/* Stats Overview Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
        <Card>
          <CardContent className="p-4">
            <Label className="text-sm text-gray-600">Receipts Last Shift</Label>
            <div className="text-2xl font-bold">{stats?.receiptsLast || 0}</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <Label className="text-sm text-gray-600">Gross Last Shift</Label>
            <div className="text-2xl font-bold">{stats?.grossLast?.toFixed(2) || 0}</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <Label className="text-sm text-gray-600">Net MTD</Label>
            <div className="text-2xl font-bold">{stats?.netMtd?.toFixed(2) || 0}</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <Label className="text-sm text-gray-600">Anomalies</Label>
            <Badge variant="destructive" className="text-lg">{stats?.anomalies || 0}</Badge>
          </CardContent>
        </Card>
      </div>

      {/* Analysis Modules */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Loyverse Reports Module */}
        <Card className="hover:shadow-lg transition-shadow">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <BarChart3 className="h-5 w-5" />
              Loyverse Reports
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-gray-600 mb-4">
              Comprehensive POS analytics, sales reports, and receipt management from your Loyverse system.
            </p>
            <Link to="/operations/analysis/loyverse">
              <Button className="w-full">
                View Loyverse Analysis
              </Button>
            </Link>
          </CardContent>
        </Card>

        {/* Stock Review Module */}
        <Card className="hover:shadow-lg transition-shadow">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <BarChart3 className="h-5 w-5" />
              Stock Review
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-gray-600 mb-4">
              Monitor buns, meat, and drinks inventory levels, usage patterns, and stock optimization.
            </p>
            <Link to="/operations/analysis/stock-review">
              <Button className="w-full">
                View Stock Analysis
              </Button>
            </Link>
          </CardContent>
        </Card>
      </div>


      {/* Outlet for nested routes */}
      <Outlet />
    </div>
  );
};