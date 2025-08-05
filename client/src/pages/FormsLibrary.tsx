import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { FileText, Download, Calendar, User, Clock, FileCheck, Mail, Eye, Trash2, RotateCcw } from "lucide-react";
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
  const [viewArchived, setViewArchived] = useState(false);
  const [downloadingForm, setDownloadingForm] = useState<number | null>(null);
  const [emailingForm, setEmailingForm] = useState<number | null>(null);
  const [deletingForm, setDeletingForm] = useState<number | null>(null);
  const [restoringForm, setRestoringForm] = useState<number | null>(null);
  const [emailAddress, setEmailAddress] = useState("");

  useEffect(() => {
    const fetchForms = async () => {
      setLoading(true);
      try {
        const endpoint = viewArchived ? '/api/daily-stock-sales/archived' : '/api/daily-stock-sales';
        const response = await fetch(endpoint);
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
          description: `Failed to load ${viewArchived ? 'archived' : 'active'} forms`,
          variant: "destructive",
        });
      } finally {
        setLoading(false);
      }
    };

    fetchForms();
  }, [toast, viewArchived]);

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

  const handleSendEmail = async (formId: number) => {
    if (!emailAddress) {
      toast({
        title: "Error",
        description: "Please enter an email address",
        variant: "destructive",
      });
      return;
    }

    setEmailingForm(formId);
    try {
      const response = await fetch(`/api/daily-stock-sales/${formId}/send-email`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email: emailAddress }),
      });

      if (response.ok) {
        const result = await response.json();
        toast({
          title: "Success",
          description: result.message,
        });
        setEmailAddress(""); // Clear email field
      } else {
        throw new Error('Email sending failed');
      }
    } catch (error) {
      console.error('Email sending failed:', error);
      toast({
        title: "Error",
        description: "Failed to send email",
        variant: "destructive",
      });
    } finally {
      setEmailingForm(null);
    }
  };

  const handleDeleteForm = async (formId: number) => {
    if (!confirm('Are you sure you want to remove this form from the library? It will be archived and can be recovered later if needed.')) {
      return;
    }

    setDeletingForm(formId);
    try {
      const response = await fetch(`/api/daily-stock-sales/${formId}/soft`, {
        method: 'DELETE',
      });

      if (response.ok) {
        const result = await response.json();
        toast({
          title: "Success",
          description: result.message,
        });
        
        // Remove form from local state
        setForms(forms.filter(form => form.id !== formId));
      } else {
        throw new Error('Delete failed');
      }
    } catch (error) {
      console.error('Form deletion failed:', error);
      toast({
        title: "Error",
        description: "Failed to remove form from library",
        variant: "destructive",
      });
    } finally {
      setDeletingForm(null);
    }
  };

  const handleRestoreForm = async (formId: number) => {
    if (!confirm('Are you sure you want to restore this form to the active library?')) {
      return;
    }

    setRestoringForm(formId);
    try {
      const response = await fetch(`/api/daily-stock-sales/${formId}/restore`, {
        method: 'POST',
      });

      if (response.ok) {
        const result = await response.json();
        toast({
          title: "Success",
          description: result.message,
        });
        
        // Remove form from local state since it's now active
        setForms(forms.filter(form => form.id !== formId));
      } else {
        throw new Error('Restore failed');
      }
    } catch (error) {
      console.error('Form restoration failed:', error);
      toast({
        title: "Error",
        description: "Failed to restore form",
        variant: "destructive",
      });
    } finally {
      setRestoringForm(null);
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  const formatCurrency = (amount: number | string) => {
    const numAmount = typeof amount === 'string' ? parseFloat(amount) : amount;
    return `฿${numAmount.toFixed(2)}`;
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
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-2xl font-semibold mb-2">
              Forms Library {viewArchived ? '- Archived' : '- Active'}
            </h1>
            <p className="text-muted-foreground">
              {viewArchived 
                ? 'View and restore archived daily shift forms.' 
                : 'Access and download daily shift forms. All forms are available as PDF documents.'
              }
            </p>
          </div>
          <Button 
            onClick={() => setViewArchived(!viewArchived)}
            variant="outline"
            className="bg-white dark:bg-gray-800"
          >
            {viewArchived ? "View Active Forms" : "View Archived Forms"}
          </Button>
        </div>
      </div>

      {forms.length === 0 ? (
        <Card>
          <CardContent className="p-6 text-center">
            <FileText className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
            <h3 className="text-lg font-medium mb-2">
              {viewArchived ? 'No archived forms' : 'No active forms available'}
            </h3>
            <p className="text-muted-foreground">
              {viewArchived 
                ? 'All archived forms have been restored or no forms have been archived yet.'
                : 'Complete your first daily shift form to see it here.'
              }
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
                      {formatDate(form.createdAt)}
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

                <div className="mt-4 pt-3 border-t space-y-2">
                  <Button
                    onClick={() => window.open(`/daily-shift-form?id=${form.id}`, '_blank')}
                    variant="default"
                    className="w-full bg-blue-600 text-white hover:bg-blue-700"
                  >
                    <Eye className="h-4 w-4 mr-2" />
                    View Form
                  </Button>
                  
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

                  {viewArchived ? (
                    <Button
                      onClick={() => handleRestoreForm(form.id)}
                      disabled={restoringForm === form.id}
                      variant="default"
                      className="w-full bg-green-600 text-white hover:bg-green-700"
                    >
                      {restoringForm === form.id ? (
                        <>
                          <Clock className="h-4 w-4 mr-2 animate-spin" />
                          Restoring...
                        </>
                      ) : (
                        <>
                          <RotateCcw className="h-4 w-4 mr-2" />
                          Restore Form
                        </>
                      )}
                    </Button>
                  ) : (
                    <Button
                      onClick={() => handleDeleteForm(form.id)}
                      disabled={deletingForm === form.id}
                      variant="destructive"
                      className="w-full"
                    >
                      {deletingForm === form.id ? (
                        <>
                          <Clock className="h-4 w-4 mr-2 animate-spin" />
                          Removing...
                        </>
                      ) : (
                        <>
                          <Trash2 className="h-4 w-4 mr-2" />
                          Remove from Library
                        </>
                      )}
                    </Button>
                  )}

                  <Dialog>
                    <DialogTrigger asChild>
                      <Button
                        variant="outline"
                        className="w-full"
                        disabled={emailingForm === form.id}
                      >
                        {emailingForm === form.id ? (
                          <>
                            <Clock className="h-4 w-4 mr-2 animate-spin" />
                            Sending...
                          </>
                        ) : (
                          <>
                            <Mail className="h-4 w-4 mr-2" />
                            Send via Email
                          </>
                        )}
                      </Button>
                    </DialogTrigger>
                    <DialogContent>
                      <DialogHeader>
                        <DialogTitle>Send Form {form.id} via Email</DialogTitle>
                        <DialogDescription>
                          Enter an email address to send this daily shift form as a PDF attachment.
                        </DialogDescription>
                      </DialogHeader>
                      <div className="space-y-4">
                        <div>
                          <label className="text-sm font-medium">Email Address</label>
                          <Input
                            type="email"
                            placeholder="management@smashbrothers.co.th"
                            value={emailAddress}
                            onChange={(e) => setEmailAddress(e.target.value)}
                            className="mt-1"
                          />
                        </div>
                      </div>
                      <DialogFooter>
                        <Button
                          onClick={() => handleSendEmail(form.id)}
                          disabled={!emailAddress || emailingForm === form.id}
                          className="bg-black text-white hover:bg-gray-800"
                        >
                          {emailingForm === form.id ? (
                            <>
                              <Clock className="h-4 w-4 mr-2 animate-spin" />
                              Sending...
                            </>
                          ) : (
                            <>
                              <Mail className="h-4 w-4 mr-2" />
                              Send Email
                            </>
                          )}
                        </Button>
                      </DialogFooter>
                    </DialogContent>
                  </Dialog>
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