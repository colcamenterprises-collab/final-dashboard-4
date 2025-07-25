import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Trash2, Eye, Search, FileText, Archive } from "lucide-react";
import { Link } from "wouter";
import { apiRequest } from "@/lib/queryClient";

interface DraftForm {
  id: number;
  name: string;
  shift: string;
  isDraft: boolean;
  createdAt: string;
  updatedAt: string;
}

interface Form {
  id: number;
  name: string;
  shift: string;
  isDraft: boolean;
  createdAt: string;
  updatedAt: string;
  grabSales?: number;
  aroiDeeSales?: number;
  qrScanSales?: number;
  cashSales?: number;
}

export default function DraftFormsLibrary() {
  const [searchQuery, setSearchQuery] = useState("");
  const queryClient = useQueryClient();

  // Fetch draft forms
  const { data: drafts = [], isLoading: draftsLoading } = useQuery({
    queryKey: ["/api/daily-stock-sales/drafts"],
  });

  // Fetch completed forms
  const { data: forms = [], isLoading: formsLoading } = useQuery({
    queryKey: ["/api/daily-stock-sales"],
  });

  // Delete mutation
  const deleteMutation = useMutation({
    mutationFn: (id: number) => apiRequest(`/api/daily-stock-sales/${id}`, {
      method: "DELETE",
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/daily-stock-sales/drafts"] });
      queryClient.invalidateQueries({ queryKey: ["/api/daily-stock-sales"] });
    },
  });

  const filteredDrafts = drafts.filter((draft: DraftForm) =>
    draft.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    draft.shift.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const filteredForms = forms.filter((form: Form) =>
    form.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    form.shift.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const formatCurrency = (amount: number | undefined) => {
    if (!amount) return "฿0.00";
    return `฿${amount.toFixed(2)}`;
  };

  const calculateTotal = (form: Form) => {
    const total = (form.grabSales || 0) + (form.aroiDeeSales || 0) + (form.qrScanSales || 0) + (form.cashSales || 0);
    return formatCurrency(total);
  };

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Forms Management</h1>
          <p className="text-gray-600 mt-2">Manage draft forms and view completed form library</p>
        </div>
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
        <Input
          placeholder="Search forms by name or shift..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="pl-10"
        />
      </div>

      <Tabs defaultValue="drafts" className="w-full">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="drafts" className="flex items-center gap-2">
            <FileText className="h-4 w-4" />
            Draft Forms ({drafts.length})
          </TabsTrigger>
          <TabsTrigger value="library" className="flex items-center gap-2">
            <Archive className="h-4 w-4" />
            Form Library ({forms.length})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="drafts" className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-semibold">Draft Forms</h2>
            <Badge variant="secondary">{filteredDrafts.length} drafts</Badge>
          </div>

          {draftsLoading ? (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {[...Array(3)].map((_, i) => (
                <Card key={i} className="animate-pulse">
                  <CardHeader>
                    <div className="h-4 bg-gray-200 rounded w-3/4"></div>
                    <div className="h-3 bg-gray-200 rounded w-1/2"></div>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2">
                      <div className="h-3 bg-gray-200 rounded"></div>
                      <div className="h-3 bg-gray-200 rounded w-3/4"></div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : filteredDrafts.length === 0 ? (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-12">
                <FileText className="h-12 w-12 text-gray-400 mb-4" />
                <h3 className="text-lg font-medium text-gray-900 mb-2">No draft forms found</h3>
                <p className="text-gray-500 text-center">
                  {searchQuery ? "No drafts match your search criteria." : "Start creating forms to see drafts here."}
                </p>
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {filteredDrafts.map((draft: DraftForm) => (
                <Card key={draft.id} className="hover:shadow-md transition-shadow">
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-lg">{draft.name}</CardTitle>
                      <Badge variant="outline" className="text-orange-600 border-orange-600">
                        Draft
                      </Badge>
                    </div>
                    <CardDescription>{draft.shift}</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      <div className="text-sm text-gray-600">
                        <p>Created: {new Date(draft.createdAt).toLocaleDateString()}</p>
                        <p>Updated: {new Date(draft.updatedAt).toLocaleDateString()}</p>
                      </div>
                      <div className="flex gap-2">
                        <Link href={`/form/${draft.id}`}>
                          <Button variant="outline" size="sm" className="flex-1">
                            <Eye className="h-4 w-4 mr-2" />
                            View
                          </Button>
                        </Link>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => deleteMutation.mutate(draft.id)}
                          disabled={deleteMutation.isPending}
                          className="text-red-600 border-red-600 hover:bg-red-50"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="library" className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-semibold">Form Library</h2>
            <Badge variant="secondary">{filteredForms.length} completed forms</Badge>
          </div>

          {formsLoading ? (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {[...Array(6)].map((_, i) => (
                <Card key={i} className="animate-pulse">
                  <CardHeader>
                    <div className="h-4 bg-gray-200 rounded w-3/4"></div>
                    <div className="h-3 bg-gray-200 rounded w-1/2"></div>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2">
                      <div className="h-3 bg-gray-200 rounded"></div>
                      <div className="h-3 bg-gray-200 rounded w-3/4"></div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : filteredForms.length === 0 ? (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-12">
                <Archive className="h-12 w-12 text-gray-400 mb-4" />
                <h3 className="text-lg font-medium text-gray-900 mb-2">No completed forms found</h3>
                <p className="text-gray-500 text-center">
                  {searchQuery ? "No forms match your search criteria." : "Complete some forms to see them here."}
                </p>
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {filteredForms.map((form: Form) => (
                <Card key={form.id} className="hover:shadow-md transition-shadow">
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-lg">{form.name}</CardTitle>
                      <Badge variant="default" className="bg-green-100 text-green-800 border-green-200">
                        Completed
                      </Badge>
                    </div>
                    <CardDescription>{form.shift}</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      <div className="text-sm">
                        <p className="font-medium text-gray-900">Total Sales: {calculateTotal(form)}</p>
                        <p className="text-gray-600">Date: {new Date(form.createdAt).toLocaleDateString()}</p>
                      </div>
                      <div className="flex gap-2">
                        <Link href={`/form/${form.id}`}>
                          <Button variant="outline" size="sm" className="flex-1">
                            <Eye className="h-4 w-4 mr-2" />
                            View Details
                          </Button>
                        </Link>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => deleteMutation.mutate(form.id)}
                          disabled={deleteMutation.isPending}
                          className="text-red-600 border-red-600 hover:bg-red-50"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}