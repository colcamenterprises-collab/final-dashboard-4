import React, { useState, useEffect } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { AlertTriangle, CheckCircle, Upload, FileText } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import { apiRequest } from '@/lib/queryClient';

interface ComparisonItem {
  label: string;
  shift: number;
  daily: number;
  difference: number;
  match: boolean;
}

interface ShiftData {
  grab_sales?: number;
  qr_sales?: number;
  aroi_sales?: number;
  cash_sales?: number;
  total_sales?: number;
  register_balance?: number;
}

interface DailyData {
  grab_sales?: number;
  qr_sales?: number;
  aroi_sales?: number;
  cash_sales?: number;
  total_sales?: number;
  register_balance?: number;
}

const ShiftComparison = () => {
  const [shiftData, setShiftData] = useState<ShiftData | null>(null);
  const [dailyData, setDailyData] = useState<DailyData | null>(null);
  const [comparison, setComparison] = useState<ComparisonItem[] | null>(null);
  const [shiftFileName, setShiftFileName] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [noMatchFound, setNoMatchFound] = useState(false);
  const { toast } = useToast();

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.name.toLowerCase().endsWith('.csv')) {
      toast({
        title: "Invalid file type",
        description: "Please upload a CSV file.",
        variant: "destructive"
      });
      return;
    }

    setLoading(true);
    setNoMatchFound(false);

    try {
      const formData = new FormData();
      formData.append('shiftReport', file);

      const response = await fetch('/api/shift-comparison', {
        method: 'POST',
        body: formData,
      });

      if (response.ok) {
        const result = await response.json();
        
        if (result.error === 'No matching daily form found') {
          setNoMatchFound(true);
          toast({
            title: "No Daily Sales Form found",
            description: "No Daily Sales Form found for this shift date.",
            variant: "destructive"
          });
        } else {
          setShiftData(result.shiftData);
          setDailyData(result.dailyData);
          setShiftFileName(file.name);
          toast({
            title: "File uploaded successfully",
            description: `${file.name} processed and matched with Daily Sales Form`,
          });
        }
      } else {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Upload failed');
      }
    } catch (error) {
      toast({
        title: "Upload failed",
        description: error instanceof Error ? error.message : "Failed to process CSV file",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (shiftData && dailyData) {
      const result = compareReports(shiftData, dailyData);
      setComparison(result);
    }
  }, [shiftData, dailyData]);

  const compareReports = (shift: ShiftData, daily: DailyData): ComparisonItem[] => {
    const categories = [
      { key: 'grab_sales', label: 'GRAB Sales' },
      { key: 'cash_sales', label: 'Cash Sales' },
      { key: 'qr_sales', label: 'QR Code Sales' },
      { key: 'aroi_sales', label: 'Aroi Dee' },
      { key: 'total_sales', label: 'Total Sales' },
      { key: 'register_balance', label: 'Register Balance' }
    ];

    return categories.map(cat => {
      const shiftValue = Number(shift[cat.key as keyof ShiftData] || 0);
      const dailyValue = Number(daily[cat.key as keyof DailyData] || 0);
      const diff = shiftValue - dailyValue;
      return {
        label: cat.label,
        shift: shiftValue,
        daily: dailyValue,
        difference: diff,
        match: Math.abs(diff) <= 50 // 50 THB tolerance
      };
    });
  };

  const formatCurrency = (amount: number) => {
    return `฿${amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  const getJussiComment = () => {
    if (!comparison) return '';
    
    const mismatches = comparison.filter(item => !item.match);
    if (mismatches.length === 0) {
      return "✅ All fields match within tolerance. Excellent work by the staff!";
    }
    
    const comments = mismatches.map(item => 
      `⚠️ Discrepancy in ${item.label}: difference of ${formatCurrency(Math.abs(item.difference))}`
    );
    
    const matchCount = comparison.length - mismatches.length;
    if (matchCount > 0) {
      comments.push(`✅ ${matchCount} other field${matchCount > 1 ? 's' : ''} match within tolerance.`);
    }
    
    return comments.join('\n');
  };

  return (
    <div className="container mx-auto p-3 sm:p-4 lg:p-6 max-w-7xl">
      {/* Header */}
      <div className="mb-4 sm:mb-6">
        <h1 className="text-xl sm:text-2xl lg:text-3xl font-bold text-gray-900 mb-1 sm:mb-2">
          🧠 Jussi's Shift Integrity Checker
        </h1>
        <p className="text-sm sm:text-base text-gray-600">
          Compare POS Shift Reports with Daily Sales & Stock Forms to detect discrepancies
        </p>
      </div>

      {/* File Upload Section */}
      <div className="max-w-2xl mx-auto mb-6">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-lg font-semibold flex items-center gap-2">
              <FileText className="h-5 w-5 text-blue-600" />
              Upload POS Shift Report CSV File
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <Input 
              type="file" 
              accept=".csv,text/csv" 
              onChange={handleFileUpload}
              className="cursor-pointer"
              disabled={loading}
            />
            <p className="text-sm text-gray-600">
              (Daily Sales Form will be automatically matched from system records)
            </p>
            {loading && (
              <p className="text-sm text-blue-600 flex items-center gap-1">
                <Upload className="h-4 w-4 animate-spin" />
                Processing CSV and matching with Daily Sales Form...
              </p>
            )}
            {shiftFileName && !loading && (
              <p className="text-sm text-green-600 flex items-center gap-1">
                <CheckCircle className="h-4 w-4" />
                {shiftFileName} processed and matched successfully
              </p>
            )}
            {noMatchFound && (
              <p className="text-sm text-red-600 flex items-center gap-1">
                <AlertTriangle className="h-4 w-4" />
                No Daily Sales Form found for this shift date
              </p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Comparison Results */}
      {comparison && (
        <div className="space-y-6">
          {/* Comparison Table */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg font-semibold">🔍 Shift Comparison Results</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full border-collapse">
                  <thead>
                    <tr className="border-b border-gray-200">
                      <th className="text-left py-3 px-2 font-semibold text-gray-900">Metric</th>
                      <th className="text-right py-3 px-2 font-semibold text-gray-900">Daily Sales Form</th>
                      <th className="text-right py-3 px-2 font-semibold text-gray-900">POS Shift Report</th>
                      <th className="text-center py-3 px-2 font-semibold text-gray-900">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {comparison.map((item, idx) => (
                      <tr 
                        key={idx} 
                        className={`border-b border-gray-100 ${
                          !item.match ? 'bg-red-50' : 'bg-green-50'
                        }`}
                      >
                        <td className="py-3 px-2 font-medium text-gray-900">{item.label}</td>
                        <td className="py-3 px-2 text-right font-mono">{formatCurrency(item.daily)}</td>
                        <td className="py-3 px-2 text-right font-mono">{formatCurrency(item.shift)}</td>
                        <td className="py-3 px-2 text-center">
                          {item.match ? (
                            <CheckCircle className="inline h-5 w-5 text-green-500" />
                          ) : (
                            <AlertTriangle className="inline h-5 w-5 text-red-500" />
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>

          {/* Jussi's Response */}
          <Card className="border-blue-200 bg-blue-50">
            <CardHeader>
              <CardTitle className="text-lg font-semibold text-blue-900">
                🧠 Jussi's Analysis
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="whitespace-pre-line text-blue-800 font-medium">
                {getJussiComment()}
              </div>
            </CardContent>
          </Card>

          {/* Future Extension Placeholder */}
          <Card className="border-gray-300 bg-gray-50">
            <CardHeader>
              <CardTitle className="text-lg font-semibold text-gray-700">
                🚀 Future Enhancements
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2 text-gray-600">
                <p>• Receipt item comparison</p>
                <p>• Modifier matching analysis</p>
                <p>• Detailed variance summaries</p>
                <p>• Historical comparison trends</p>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Instructions */}
      {!comparison && (
        <Card className="border-blue-200 bg-blue-50">
          <CardHeader>
            <CardTitle className="text-lg font-semibold text-blue-900">
              📋 Instructions
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2 text-blue-800">
              <p>1. Upload your POS Shift Report CSV file</p>
              <p>2. Jussi will auto-match the corresponding Daily Sales & Stock Form based on date</p>
              <p>3. The system compares both reports and highlights discrepancies</p>
              <p>4. Tolerance level: ±50 THB for all comparisons</p>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default ShiftComparison;