import { useQuery } from '@tanstack/react-query';
import { Card, CardHeader, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Eye, Download, FileText } from "lucide-react";
import { Link } from "wouter";

const FormLibrary = () => {
  const { data: forms = [], isLoading } = useQuery({
    queryKey: ['/api/daily-stock-sales'],
  });

  if (isLoading) {
    return (
      <div className="p-6">
        <div className="animate-pulse">
          <div className="h-6 bg-gray-200 rounded w-48 mb-4"></div>
          <div className="space-y-3">
            <div className="h-4 bg-gray-200 rounded"></div>
            <div className="h-4 bg-gray-200 rounded w-5/6"></div>
            <div className="h-4 bg-gray-200 rounded w-4/6"></div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <Card>
        <CardHeader>
          <div className="flex justify-between items-center">
            <h1 className="text-2xl font-semibold text-left">Form Library</h1>
            <Link href="/daily-shift-form">
              <Button className="flex items-center gap-2">
                <FileText className="h-4 w-4" />
                New Form
              </Button>
            </Link>
          </div>
        </CardHeader>
        <CardContent>
          {forms.length === 0 ? (
            <div className="text-center py-8">
              <p className="text-gray-500">No forms found</p>
              <Link href="/daily-shift-form">
                <Button className="mt-4">Create First Form</Button>
              </Link>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>ID</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead>Completed By</TableHead>
                  <TableHead>Shift Type</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Total Sales</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {forms.map((form: any) => (
                  <TableRow key={form.id}>
                    <TableCell>{form.id}</TableCell>
                    <TableCell>
                      {form.shiftDate ? new Date(form.shiftDate).toLocaleDateString() : 'N/A'}
                    </TableCell>
                    <TableCell>{form.completedBy || 'Unknown'}</TableCell>
                    <TableCell>{form.shiftType || 'N/A'}</TableCell>
                    <TableCell>
                      <Badge variant={form.isDraft ? "secondary" : "default"}>
                        {form.isDraft ? "Draft" : "Completed"}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {form.totalSales ? `฿${parseFloat(form.totalSales).toFixed(2)}` : 'N/A'}
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-2">
                        <Link href={`/form/${form.id}`}>
                          <Button variant="outline" size="sm">
                            <Eye className="h-4 w-4" />
                          </Button>
                        </Link>
                        <Button variant="outline" size="sm">
                          <Download className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default FormLibrary;