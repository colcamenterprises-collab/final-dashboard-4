import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card, CardHeader, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Trash2, Eye, Edit } from 'lucide-react';
import { Link } from 'wouter';

interface DraftForm {
  id: number;
  shiftDate: string;
  completedBy: string;
  shiftType: string;
  isDraft: boolean;
  totalSales?: number;
  totalExpenses?: number;
}

const DraftForms = () => {
  const { data: forms = [], isLoading, refetch } = useQuery<DraftForm[]>({
    queryKey: ['/api/daily-stock-sales/drafts'],
  });

  const deleteDraft = async (id: number) => {
    if (confirm('Are you sure you want to delete this draft?')) {
      try {
        const response = await fetch(`/api/daily-stock-sales/${id}`, {
          method: 'DELETE',
        });
        if (response.ok) {
          refetch();
        }
      } catch (error) {
        console.error('Failed to delete draft:', error);
      }
    }
  };

  return (
    <div className="container mx-auto p-6">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">Draft Forms & Form Library</h1>
            <p className="text-gray-600">Manage saved drafts and view historical forms</p>
          </div>
          <div className="flex gap-2">
            <Button asChild>
              <Link href="/daily-shift-form">
                Create New Form
              </Link>
            </Button>
            <Button variant="outline" asChild>
              <Link href="/purchasing">
                Shopping Requirements
              </Link>
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="text-center py-8">Loading forms...</div>
          ) : forms.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              No draft forms found. Create a new form to get started.
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
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {forms.map((form) => (
                  <TableRow key={form.id}>
                    <TableCell>{form.id}</TableCell>
                    <TableCell>
                      {new Date(form.shiftDate).toLocaleDateString()}
                    </TableCell>
                    <TableCell>{form.completedBy}</TableCell>
                    <TableCell>{form.shiftType}</TableCell>
                    <TableCell>
                      <Badge variant={form.isDraft ? "secondary" : "default"}>
                        {form.isDraft ? "Draft" : "Complete"}
                      </Badge>
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
                        {form.isDraft && (
                          <Button
                            size="sm"
                            variant="outline"
                            asChild
                          >
                            <Link href={`/daily-shift-form?draft=${form.id}`}>
                              <Edit className="h-4 w-4" />
                            </Link>
                          </Button>
                        )}
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => deleteDraft(form.id)}
                        >
                          <Trash2 className="h-4 w-4" />
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

export default DraftForms;