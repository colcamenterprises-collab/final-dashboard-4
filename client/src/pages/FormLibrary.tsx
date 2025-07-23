import { useQuery } from '@tanstack/react-query';
import { Card, CardHeader, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Eye, Download } from 'lucide-react';
import { Link } from 'wouter';

interface Form {
  id: number;
  shiftDate: string;
  completedBy: string;
  shiftType: string;
  isDraft: boolean;
  totalSales?: number;
  totalExpenses?: number;
}

const FormLibrary = () => {
  const { data: forms = [], isLoading } = useQuery<Form[]>({
    queryKey: ['/api/daily-stock-sales/search'],
  });

  const downloadForm = async (id: number) => {
    try {
      const response = await fetch(`/api/daily-stock-sales/${id}/export`);
      if (response.ok) {
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `form-${id}.pdf`;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);
      }
    } catch (error) {
      console.error('Failed to download form:', error);
    }
  };

  return (
    <div className="container mx-auto p-6">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">Form Library</h1>
            <p className="text-gray-600">View and download historical forms</p>
          </div>
          <div className="flex gap-2">
            <Button asChild>
              <Link href="/daily-shift-form">
                Create New Form
              </Link>
            </Button>
            <Button variant="outline" asChild>
              <Link href="/draft-forms">
                View Drafts
              </Link>
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="text-center py-8">Loading forms...</div>
          ) : forms.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              No completed forms found.
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>ID</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead>Completed By</TableHead>
                  <TableHead>Shift Type</TableHead>
                  <TableHead>Total Sales</TableHead>
                  <TableHead>Total Expenses</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {forms.filter((form) => !form.isDraft).map((form) => (
                  <TableRow key={form.id}>
                    <TableCell>{form.id}</TableCell>
                    <TableCell>
                      {new Date(form.shiftDate).toLocaleDateString()}
                    </TableCell>
                    <TableCell>{form.completedBy}</TableCell>
                    <TableCell>{form.shiftType}</TableCell>
                    <TableCell>฿{form.totalSales?.toFixed(2) || '0.00'}</TableCell>
                    <TableCell>฿{form.totalExpenses?.toFixed(2) || '0.00'}</TableCell>
                    <TableCell>
                      <Badge variant="default">Complete</Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          asChild
                        >
                          <Link href={`/form/${form.id}`}>
                            <Eye className="h-4 w-4" />
                          </Link>
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => downloadForm(form.id)}
                        >
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