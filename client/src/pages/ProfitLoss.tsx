import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { TrendingUp, TrendingDown, DollarSign, PieChart } from "lucide-react";

interface PLRowData {
  code: string;
  label: string;
  months: number[];
  total: number;
  isExpense?: boolean;
  isCalculated?: boolean;
  isPercentage?: boolean;
}

interface PLData {
  [key: string]: PLRowData;
}

export default function ProfitLoss() {
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [includeShiftPurchases, setIncludeShiftPurchases] = useState(false);

  // Fetch P&L data
  const { data: plData, isLoading } = useQuery<PLData>({
    queryKey: ['/api/finance/pl', selectedYear, includeShiftPurchases],
    retry: 1,
  });

  const formatCurrency = (amount: number) => {
    return `฿${amount.toLocaleString('en-US', { 
      minimumFractionDigits: 2, 
      maximumFractionDigits: 2 
    })}`;
  };

  const formatPercentage = (amount: number) => {
    return `${(amount * 100).toFixed(1)}%`;
  };

  const getMonthName = (month: number) => {
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
                   'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    return months[month - 1];
  };

  // Define P&L structure with groupings
  const plStructure = [
    {
      title: "Revenue",
      rows: [
        'TOTAL_GROSS_REVENUE',
        'FOOD_GROSS',
        'FOOD_DISCOUNT',
        'FOOD_NET',
        'DRINK_GROSS', 
        'DRINK_DISCOUNT',
        'DRINK_NET',
        'DISCOUNTS_TOTAL',
        'NET_REV_EX_FEES',
        'PAYMENT_FEES',
        'NET_REV_INC_FEES'
      ]
    },
    {
      title: "Cost of Goods Sold",
      rows: [
        'COGS_FOOD',
        'COGS_BEVERAGE', 
        'COGS_TOTAL'
      ]
    },
    {
      title: "Gross Profit",
      rows: [
        'GROSS_PROFIT',
        'GROSS_MARGIN'
      ]
    },
    {
      title: "Operating Expenses",
      rows: [
        'WAGES',
        'TIPS_QR',
        'BONUS_PAY',
        'STAFF_FROM_ACCOUNT',
        'RENT',
        'ADMIN',
        'ADVERTISING_GRAB',
        'ADVERTISING_OTHER',
        'DELIVERY_FEE_DISCOUNT',
        'DIRECTOR_PAYMENT',
        'DISCOUNT_MERCHANT_FUNDED',
        'FITTINGS',
        'KITCHEN_SUPPLIES',
        'MARKETING',
        'MARKETING_SUCCESS_FEE',
        'MISC',
        'PRINTERS',
        'RENOVATIONS',
        'SUBSCRIPTIONS',
        'STATIONARY',
        'TRAVEL',
        'UTILITIES',
        'MISC_CASH_PURCHASES',
        'TOTAL_EXPENSES'
      ]
    },
    {
      title: "Earnings",
      rows: [
        'EBIT',
        'INTEREST_EXPENSE',
        'EBT',
        'INCOME_TAX',
        'NET_EARNINGS'
      ]
    }
  ];

  // Summary cards data
  const summaryCards = [
    {
      title: "Total Net Revenue",
      value: plData?.NET_REV_INC_FEES?.total || 0,
      icon: DollarSign,
      trend: "up",
    },
    {
      title: "Total COGS",
      value: plData?.COGS_TOTAL?.total || 0,
      icon: TrendingDown,
      trend: "down",
    },
    {
      title: "Gross Profit",
      value: plData?.GROSS_PROFIT?.total || 0,
      icon: TrendingUp,
      trend: "up",
    },
    {
      title: "EBIT",
      value: plData?.EBIT?.total || 0,
      icon: PieChart,
      trend: (plData?.EBIT?.total || 0) > 0 ? "up" : "down",
    },
  ];

  return (
    <div className="bg-app min-h-screen px-6 sm:px-8 py-5" style={{ fontFamily: 'Poppins, sans-serif' }}>
      {/* Header Section */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-4">
        <h1 className="text-[32px] font-extrabold tracking-tight text-[var(--heading)]">
          Profit & Loss
        </h1>
        
        {/* Controls */}
        <div className="flex flex-col sm:flex-row gap-3">
          <Select value={selectedYear.toString()} onValueChange={(value) => setSelectedYear(parseInt(value))}>
            <SelectTrigger className="w-32">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {[2023, 2024, 2025, 2026].map(year => (
                <SelectItem key={year} value={year.toString()}>{year}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          
          <div className="flex items-center space-x-2">
            <Switch
              id="include-shift"
              checked={includeShiftPurchases}
              onCheckedChange={setIncludeShiftPurchases}
            />
            <Label htmlFor="include-shift" className="text-sm">Include shift purchases</Label>
          </div>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mt-6">
        {summaryCards.map((card, index) => (
          <Card key={index}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">{card.title}</CardTitle>
              <card.icon className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{formatCurrency(card.value)}</div>
              <div className={`flex items-center text-xs ${
                card.trend === 'up' ? 'text-green-600' : 'text-red-600'
              }`}>
                {card.trend === 'up' ? (
                  <TrendingUp className="h-3 w-3 mr-1" />
                ) : (
                  <TrendingDown className="h-3 w-3 mr-1" />
                )}
                Year to date
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* P&L Table */}
      <Card className="mt-6">
        <CardHeader>
          <CardTitle className="text-[18px] font-semibold text-[var(--heading)]">
            Financial Statement - {selectedYear}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex items-center justify-center h-32">
              <div className="text-sm text-muted-foreground">Loading P&L data...</div>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b">
                    <th className="text-left py-3 px-2 font-medium">Account</th>
                    {Array.from({ length: 12 }, (_, i) => (
                      <th key={i} className="text-right py-3 px-2 font-medium min-w-20">
                        {getMonthName(i + 1)}
                      </th>
                    ))}
                    <th className="text-right py-3 px-2 font-medium min-w-24">Full Year</th>
                  </tr>
                </thead>
                <tbody>
                  {plStructure.map((section, sectionIndex) => (
                    <tbody key={sectionIndex}>
                      {/* Section Header */}
                      <tr>
                        <td colSpan={14} className="pt-6 pb-2">
                          <div className="flex items-center gap-2">
                            <Badge variant="outline" className="text-xs">
                              {section.title}
                            </Badge>
                            <Separator className="flex-1" />
                          </div>
                        </td>
                      </tr>
                      
                      {/* Section Rows */}
                      {section.rows.map((rowCode) => {
                        const rowData = plData?.[rowCode];
                        if (!rowData) return null;
                        
                        const isTotal = rowCode.includes('TOTAL') || rowCode.includes('NET_') || 
                                       rowCode === 'GROSS_PROFIT' || rowCode === 'EBIT';
                        
                        return (
                          <tr key={rowCode} className={`border-b border-gray-50 ${isTotal ? 'font-medium' : ''}`}>
                            <td className={`py-2 px-2 ${isTotal ? 'font-medium' : ''}`}>
                              {rowData.label}
                            </td>
                            {rowData.months.map((amount, monthIndex) => (
                              <td key={monthIndex} className="text-right py-2 px-2">
                                {rowData.isPercentage ? 
                                  formatPercentage(amount) : 
                                  formatCurrency(amount)
                                }
                              </td>
                            ))}
                            <td className={`text-right py-2 px-2 ${isTotal ? 'font-medium' : ''}`}>
                              {rowData.isPercentage ? 
                                formatPercentage(rowData.total) : 
                                formatCurrency(rowData.total)
                              }
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Export Actions */}
      <div className="flex justify-end mt-6">
        <Button variant="outline" className="mr-2">
          Export CSV
        </Button>
        <Button variant="outline">
          Export Excel
        </Button>
      </div>
    </div>
  );
}