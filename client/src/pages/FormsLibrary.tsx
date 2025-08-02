import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { FileText, Download, Calendar, User, Clock, FileCheck } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface FormEntry {
  id: number;
  completedBy: string;
  shiftDate: string;
  shiftType: string;
  totalSales: number;
  totalExpenses: number;
  createdAt: string;
  pdfPath?: string;
}

const FormsLibrary = () => {
  const { toast } = useToast();
  const [forms, setForms] = useState<FormEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [downloadingForm, setDownloadingForm] = useState<number | null>(null);

  useEffect(() => {
    const fetchForms = async () => {
      try {
        const response = await fetch('/api/daily-stock-sales');
        if (response.ok) {
          const data = await response.json();
          setForms(data.sort((a: FormEntry, b: FormEntry) => 
            new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
          ));
        }
      } catch (error) {
        console.error('Failed to fetch forms:', error);
        toast({
          title: "Error",
          description: "Failed to load forms library",
          variant: "destructive",
        });
      } finally {
        setLoading(false);
      }
    };

    fetchForms();
  }, [toast]);

  const handleDownloadPDF = async (formId: number) => {
    setDownloadingForm(formId);
    try {
      const response = await fetch(`/api/daily-stock-sales/${formId}/download-pdf`);
      if (response.ok) {
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.style.display = 'none';
        a.href = url;
        a.download = `form-${formId}-daily-shift-report.pdf`;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);
        
        toast({
          title: "Success",
          description: `Form ${formId} PDF downloaded`,
        });
      } else {
        throw new Error('Download failed');
      }
    } catch (error) {
      console.error('PDF download failed:', error);
      toast({
        title: "Error", 
        description: "Failed to download PDF",
        variant: "destructive",
      });
    } finally {
      setDownloadingForm(null);
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  const formatCurrency = (amount: number) => {
    return `฿${amount.toFixed(2)}`;
  };

  if (loading) {
    return (
      <div className="forms-library">
        <div className="flex items-center justify-center h-64">
          <div className="text-center">
            <Clock className="h-8 w-8 animate-spin mx-auto mb-2" />
            <p>Loading forms library...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="forms-library container mx-auto p-4">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold mb-2">Forms Library</h1>
        <p className="text-muted-foreground">
          Access and download daily shift forms. All forms are available as PDF documents.
        </p>
      </div>

      {forms.length === 0 ? (
        <Card>
          <CardContent className="p-6 text-center">
            <FileText className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
            <h3 className="text-lg font-medium mb-2">No forms available</h3>
            <p className="text-muted-foreground">
              Complete your first daily shift form to see it here.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="forms-grid">
          {forms.map((form) => (
            <Card key={form.id} className="form-card">
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between">
                  <div>
                    <CardTitle className="form-title flex items-center gap-2">
                      <FileText className="h-4 w-4" />
                      Form {form.id}
                    </CardTitle>
                    <div className="flex items-center gap-2 mt-1">
                      <Badge variant="outline" className="text-xs">
                        {form.shiftType}
                      </Badge>
                      {form.pdfPath && (
                        <Badge variant="secondary" className="text-xs">
                          <FileCheck className="h-3 w-3 mr-1" />
                          PDF Available
                        </Badge>
                      )}
                    </div>
                  </div>
                </div>
              </CardHeader>
              
              <CardContent className="pt-0">
                <div className="space-y-2 form-meta">
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Calendar className="h-3 w-3" />
                    {formatDate(form.shiftDate)}
                  </div>
                  
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <User className="h-3 w-3" />
                    {form.completedBy || 'Unknown'}
                  </div>
                  
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Clock className="h-3 w-3" />
                    Created {formatDate(form.createdAt)}
                  </div>
                </div>

                <div className="mt-4 pt-3 border-t">
                  <div className="grid grid-cols-2 gap-2 text-sm">
                    <div>
                      <span className="text-muted-foreground">Sales:</span>
                      <p className="font-medium">{formatCurrency(form.totalSales || 0)}</p>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Expenses:</span>
                      <p className="font-medium">{formatCurrency(form.totalExpenses || 0)}</p>
                    </div>
                  </div>
                </div>

                <div className="mt-4 pt-3 border-t">
                  <Button
                    onClick={() => handleDownloadPDF(form.id)}
                    disabled={downloadingForm === form.id}
                    className="pdf-download-btn w-full bg-black text-white hover:bg-gray-800"
                  >
                    {downloadingForm === form.id ? (
                      <>
                        <Clock className="h-4 w-4 mr-2 animate-spin" />
                        Generating PDF...
                      </>
                    ) : (
                      <>
                        <Download className="h-4 w-4 mr-2" />
                        Download PDF
                      </>
                    )}
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <div className="mt-8 p-4 bg-muted/50 rounded-lg">
        <h3 className="font-medium mb-2">About Forms Library</h3>
        <p className="text-sm text-muted-foreground">
          This library contains all completed daily shift forms. Each form includes sales data, 
          expenses, inventory counts, and operational details. PDFs are generated automatically 
          and contain complete form information for record keeping and compliance.
        </p>
      </div>
    </div>
  );
};

export default FormsLibrary;