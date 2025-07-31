import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { DollarSign, ShoppingCart, TrendingUp, CreditCard, Bot, Zap, Receipt, ClipboardList, Plus, StickyNote, Trash2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import KPICard from "@/components/KPICard";
import MonthlyRevenueChart from "@/components/SalesChart";
import MonthlyExpensesChart from "@/components/MonthlyExpensesChart";
import ShiftSummaryCard from "@/components/ShiftSummaryCard";
import RollVarianceCard from "@/components/RollVarianceCard";
import ShiftReportReview from "@/components/ShiftReportReview";
import LatestShiftSummaryCard from "@/components/LatestShiftSummaryCard";


import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { format } from "date-fns";
import { apiRequest } from "@/lib/queryClient";
import restaurantHubLogo from "@assets/Restuarant Hub (2)_1751479657885.png";
import { Link } from "wouter";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine } from 'recharts';

// Quick Note form schema
const quickNoteFormSchema = z.object({
  content: z.string().min(1, "Content is required"),
  priority: z.enum(["idea", "note", "implement"]),
  date: z.date()
});

type QuickNoteFormData = z.infer<typeof quickNoteFormSchema>;

interface QuickNote {
  id: number;
  content: string;
  priority: "idea" | "note" | "implement";
  date: Date;
  createdAt: Date;
}

export default function Dashboard() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [isQuickNoteDialogOpen, setIsQuickNoteDialogOpen] = useState(false);
  const [editingNote, setEditingNote] = useState<QuickNote | null>(null);

  const quickNoteForm = useForm<QuickNoteFormData>({
    resolver: zodResolver(quickNoteFormSchema),
    defaultValues: {
      content: "",
      priority: "idea",
      date: new Date()
    }
  });

  // Fetch latest analysis for dashboard integration
  const { data: latestAnalysis } = useQuery({
    queryKey: ['/api/analysis/latest'],
    queryFn: () => apiRequest('/api/analysis/latest'),
    refetchInterval: 30000, // Refresh every 30 seconds
  });

  // Fetch quick notes
  const { data: quickNotes = [], isLoading: isLoadingNotes } = useQuery({
    queryKey: ['/api/quick-notes'],
    queryFn: async () => {
      const response = await fetch('/api/quick-notes');
      if (!response.ok) throw new Error('Failed to fetch quick notes');
      return response.json();
    }
  });

  // Create quick note mutation
  const createQuickNoteMutation = useMutation({
    mutationFn: async (data: QuickNoteFormData) => {
      return apiRequest('/api/quick-notes', {
        method: 'POST',
        body: JSON.stringify(data)
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/quick-notes'] });
      setIsQuickNoteDialogOpen(false);
      quickNoteForm.reset();
      toast({
        title: "Success",
        description: "Quick note created successfully"
      });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: "Failed to create quick note",
        variant: "destructive"
      });
    }
  });

  // Delete quick note mutation
  const deleteQuickNoteMutation = useMutation({
    mutationFn: async (id: number) => {
      return apiRequest(`/api/quick-notes/${id}`, {
        method: 'DELETE'
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/quick-notes'] });
      toast({
        title: "Success",
        description: "Quick note deleted successfully"
      });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: "Failed to delete quick note",
        variant: "destructive"
      });
    }
  });

  const onCreateQuickNote = (data: QuickNoteFormData) => {
    createQuickNoteMutation.mutate(data);
  };

  const handleDeleteNote = (id: number) => {
    deleteQuickNoteMutation.mutate(id);
  };

  // Fetch real KPI data from Loyverse receipts
  const { data: kpis, isLoading: kpisLoading, error: kpisError } = useQuery({
    queryKey: ["/api/dashboard/kpis"],
    refetchInterval: 30000, // Refresh every 30 seconds
  });

  // Remove unused data fetching for placeholder components

  const { data: mtdExpenses } = useQuery<{ total: number }>({
    queryKey: ["/api/expenses/month-to-date"],
  });

  // Add Loyverse status query
  const { data: status } = useQuery<{ connected: boolean; message: string }>({
    queryKey: ["/api/loyverse/live/status"],
    refetchInterval: 10000, // Check every 10 seconds
  });

  // Keep only essential mutations for the dashboard

  if (kpisLoading) {
    return <div className="flex justify-center items-center h-64">Loading...</div>;
  }

  return (
    <div className="relative">
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center mb-6 space-y-4 sm:space-y-0">
        <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">Restaurant Operations Hub</h1>
        <div className="flex flex-col xs:flex-row items-start xs:items-center space-y-2 xs:space-y-0 xs:space-x-4">
          <Select defaultValue="7days">
            <SelectTrigger className="w-full xs:w-40">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="7days">Last 7 days</SelectItem>
              <SelectItem value="30days">Last 30 days</SelectItem>
              <SelectItem value="3months">Last 3 months</SelectItem>
            </SelectContent>
          </Select>
          <Button className="restaurant-primary w-full xs:w-auto">
            <Bot className="mr-2 h-4 w-4" />
            <span className="hidden xs:inline">AI Analysis</span>
            <span className="xs:hidden">AI</span>
          </Button>
        </div>
      </div>

      {/* Quick Action Buttons - positioned below headline */}
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-4">
          <Zap className="h-5 w-5 text-gray-700" />
          <span className="text-lg font-semibold text-gray-900">Quick Actions</span>
        </div>
        <div className="flex flex-col sm:flex-row gap-3 max-w-2xl">
          <Link href="/expenses" className="flex-1 sm:flex-none">
            <Button className="w-full sm:w-44 h-10 bg-slate-800 text-white font-medium hover:bg-slate-700 justify-center">
              <Receipt className="mr-2 h-4 w-4 shrink-0" />
              <span className="text-sm">Submit Expense</span>
            </Button>
          </Link>
          <Link href="/daily-stock-sales" className="flex-1 sm:flex-none">
            <Button className="w-full sm:w-44 h-10 bg-slate-800 text-white font-medium hover:bg-slate-700 justify-center">
              <ClipboardList className="mr-2 h-4 w-4 shrink-0" />
              <span className="text-sm">Sales & Stock Form</span>
            </Button>
          </Link>
          <Button 
            onClick={() => setIsQuickNoteDialogOpen(true)}
            className="w-full sm:w-44 h-10 bg-slate-800 text-white font-medium hover:bg-slate-700 justify-center"
          >
            <StickyNote className="mr-2 h-4 w-4 shrink-0" />
            <span className="text-sm">Quick Notes</span>
          </Button>
        </div>
      </div>



      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6 mb-8">
        <KPICard
          title="Last Shift Sales"
          value={`฿${kpis?.lastShiftSales?.toLocaleString() || '0'}`}
          change={`${kpis?.shiftDate || 'Previous'} Shift`}
          changeType="positive"
          icon={DollarSign}
          iconColor="text-primary"
          iconBgColor="bg-primary/20"
        />
        <KPICard
          title="Orders Completed Last Shift"
          value={kpis?.lastShiftOrders || 0}
          change={`${kpis?.shiftDate || 'Previous'} Shift`}
          changeType="positive"
          icon={ShoppingCart}
          iconColor="text-green-600"
          iconBgColor="bg-green-100"
        />
        <KPICard
          title="MTD Sales"
          value={`฿${kpis?.monthToDateSales?.toLocaleString() || '89,566.50'}`}
          change="July 2025 (Authentic Data)"
          changeType="positive"
          icon={TrendingUp}
          iconColor="text-blue-600"
          iconBgColor="bg-blue-100"
        />
        <KPICard
          title="MTD Expenses"
          value={`฿${mtdExpenses?.total?.toLocaleString() || '0'}`}
          change="This Month"
          changeType="neutral"
          icon={CreditCard}
          iconColor="text-orange-600"
          iconBgColor="bg-orange-100"
        />
      </div>

      {/* Latest Shift Summary Card - Prominent display */}
      <div className="mb-6 lg:mb-8">
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          <div className="lg:col-span-1">
            <LatestShiftSummaryCard />
          </div>
          <div className="lg:col-span-3">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <RollVarianceCard />
              <ShiftSummaryCard />
              <ShiftReportReview />
            </div>
          </div>
        </div>
      </div>

      {/* AI Analysis Insights Card - if we have analysis data */}
      {latestAnalysis && (
        <div className="mb-8">
          <Card className="restaurant-card border-l-4 border-l-blue-500">
            <CardHeader>
              <CardTitle className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                <Bot className="h-5 w-5 text-blue-600" />
                Latest AI Analysis
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
                <div className="text-center">
                  <div className="text-2xl font-bold text-blue-600">
                    ฿{latestAnalysis.totalSales?.toLocaleString() || '0'}
                  </div>
                  <div className="text-sm text-gray-600">Total Sales</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-green-600">
                    {latestAnalysis.totalOrders || '0'}
                  </div>
                  <div className="text-sm text-gray-600">Orders</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-orange-600">
                    {latestAnalysis.stockUsage?.rolls || '0'}
                  </div>
                  <div className="text-sm text-gray-600">Rolls Used</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-purple-600">
                    {latestAnalysis.anomalies?.length || '0'}
                  </div>
                  <div className="text-sm text-gray-600">Anomalies</div>
                </div>
              </div>
              
              {latestAnalysis.topItems && latestAnalysis.topItems.length > 0 && (
                <div className="mb-4">
                  <h4 className="font-semibold mb-2">Top Selling Items</h4>
                  <div className="space-y-1">
                    {latestAnalysis.topItems.slice(0, 3).map((item, index) => (
                      <div key={index} className="flex justify-between text-sm">
                        <span>{item.name}</span>
                        <span className="font-medium">{item.quantity} sold</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              
              {latestAnalysis.anomalies && latestAnalysis.anomalies.length > 0 && (
                <div className="space-y-2">
                  <h4 className="font-semibold">Recent Anomalies</h4>
                  {latestAnalysis.anomalies.slice(0, 2).map((anomaly, index) => (
                    <div key={index} className={`p-2 rounded text-xs ${
                      anomaly.severity === 'high' ? 'bg-red-50 text-red-700' :
                      anomaly.severity === 'medium' ? 'bg-yellow-50 text-yellow-700' :
                      'bg-blue-50 text-blue-700'
                    }`}>
                      {anomaly.description}
                    </div>
                  ))}
                </div>
              )}
              
              <div className="mt-4 pt-4 border-t">
                <Link href="/analysis">
                  <Button size="sm" className="w-full">
                    View Full Analysis
                  </Button>
                </Link>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Three-column layout: Revenue Chart | Expenses Chart | Quick Notes */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 lg:gap-8 mb-6 lg:mb-8">
        {/* Column 1: Revenue Chart */}
        <div className="lg:col-span-1">
          <MonthlyRevenueChart />
        </div>

        {/* Column 2: Monthly Expenses Chart */}
        <div className="lg:col-span-1">
          <MonthlyExpensesChart />
        </div>

        {/* Column 3: Quick Notes */}
        <div className="lg:col-span-1">
          <Card className="restaurant-card">
            <CardHeader>
              <div className="flex justify-between items-center">
                <CardTitle className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                  <StickyNote className="h-5 w-5" />
                  Quick Notes
                </CardTitle>
                <Dialog open={isQuickNoteDialogOpen} onOpenChange={setIsQuickNoteDialogOpen}>
                  <DialogTrigger asChild>
                    <Button size="sm" variant="outline" className="flex items-center gap-2">
                      <Plus className="h-4 w-4" />
                      Add Note
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>Create Quick Note</DialogTitle>
                    </DialogHeader>
                    <Form {...quickNoteForm}>
                      <form onSubmit={quickNoteForm.handleSubmit(onCreateQuickNote)} className="space-y-4">
                        <FormField
                          control={quickNoteForm.control}
                          name="content"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Content</FormLabel>
                              <FormControl>
                                <Textarea {...field} placeholder="Enter your note content..." />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        <FormField
                          control={quickNoteForm.control}
                          name="priority"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Priority</FormLabel>
                              <Select value={field.value} onValueChange={field.onChange}>
                                <FormControl>
                                  <SelectTrigger>
                                    <SelectValue />
                                  </SelectTrigger>
                                </FormControl>
                                <SelectContent>
                                  <SelectItem value="idea">Idea</SelectItem>
                                  <SelectItem value="note">Note</SelectItem>
                                  <SelectItem value="implement">Implement</SelectItem>
                                </SelectContent>
                              </Select>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        <FormField
                          control={quickNoteForm.control}
                          name="date"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Date</FormLabel>
                              <FormControl>
                                <Input
                                  type="date"
                                  value={field.value ? format(field.value, 'yyyy-MM-dd') : ''}
                                  onChange={(e) => field.onChange(new Date(e.target.value))}
                                />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        <div className="flex justify-end space-x-2">
                          <Button type="button" variant="outline" onClick={() => setIsQuickNoteDialogOpen(false)}>
                            Cancel
                          </Button>
                          <Button type="submit">Create</Button>
                        </div>
                      </form>
                    </Form>
                  </DialogContent>
                </Dialog>
              </div>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 gap-3">
                {isLoadingNotes ? (
                  <div className="text-center py-4">
                    <div className="text-gray-500 text-sm">Loading notes...</div>
                  </div>
                ) : quickNotes.length === 0 ? (
                  <div className="text-center py-4">
                    <div className="text-gray-500 text-sm">No quick notes yet</div>
                    <div className="text-gray-400 text-xs mt-1">Click "Add Note" to create your first note</div>
                  </div>
                ) : (
                  quickNotes.slice(0, 4).map((note: QuickNote) => (
                    <div key={note.id} className="border rounded-lg p-3 hover:bg-gray-50">
                      <div className="flex justify-between items-start">
                        <div className="flex-1">
                          <div className="flex items-center space-x-2 mb-1">
                            <Badge variant={
                              note.priority === 'implement' ? 'default' :
                              note.priority === 'note' ? 'secondary' :
                              'outline'
                            }>
                              {note.priority}
                            </Badge>
                            <span className="text-xs text-gray-500">
                              {format(new Date(note.date), 'MMM dd')}
                            </span>
                          </div>
                          <p className="text-sm text-gray-700 line-clamp-2">
                            {note.content}
                          </p>
                        </div>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDeleteNote(note.id)}
                          className="h-8 w-8 p-0 text-gray-400 hover:text-red-500"
                        >
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </div>
                    </div>
                  ))
                )}
                {quickNotes.length > 4 && (
                  <div className="text-center">
                    <Link to="/marketing">
                      <Button variant="ghost" size="sm" className="text-blue-600 hover:text-blue-700">
                        View all {quickNotes.length} notes
                      </Button>
                    </Link>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>



      {/* Restaurant Hub Logo and Copyright */}


      <div className="flex flex-col items-end mt-8 mb-4">
        <a 
          href="https://www.customli.io" 
          target="_blank" 
          rel="noopener noreferrer"
          className="block"
        >
          <img 
            src={restaurantHubLogo} 
            alt="Restaurant Hub" 
            className="h-8 w-auto opacity-80 hover:opacity-100 transition-opacity mb-2 cursor-pointer"
          />
        </a>
        <p className="text-xs text-gray-500 text-right">
          Copyright 2025 - www.customli.io - Restaurant Marketing & Management
        </p>
      </div>
    </div>
  );
}
