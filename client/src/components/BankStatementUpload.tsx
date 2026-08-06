import { useState, useCallback } from "react";
import { useDropzone } from "react-dropzone";
import { useQueryClient } from "@tanstack/react-query";
import { Upload, FileText, AlertCircle, CheckCircle } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Progress } from "@/components/ui/progress";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";

interface UploadResult {
  batchId: string;
  inserted: number;
  skippedDupes: number;
  format: string;
  source?: string;
  layout?: string;
  depositsCaptured?: number;
  businessExpensesActivated?: number;
  reportingReady?: boolean;
  activationError?: string;
}

interface BankStatementUploadProps {
  onUploadComplete?: (result: UploadResult) => void;
}

async function readUploadError(response: Response): Promise<string> {
  const contentType = response.headers.get('content-type') || '';
  if (contentType.includes('application/json')) {
    const error = await response.json().catch(() => ({}));
    const primary = error.reason || error.error || error.message;
    const detailLines = error.details?.rowErrors?.length ? ` Details: ${error.details.rowErrors.join(' ')}` : '';
    return `${primary || `Upload failed with status ${response.status}`}${detailLines}`;
  }

  const text = await response.text().catch(() => '');
  return text || `Upload failed with status ${response.status}`;
}

export function BankStatementUpload({ onUploadComplete }: BankStatementUploadProps) {
  const [isUploading, setIsUploading] = useState(false);
  const [source, setSource] = useState("CSV");
  const [result, setResult] = useState<UploadResult | null>(null);
  const [uploadError, setUploadError] = useState("");
  const [progress, setProgress] = useState(0);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const activateForReporting = useCallback(async (uploadResult: UploadResult) => {
    try {
      const activation = await apiRequest(`/api/finance/bank-imports/${encodeURIComponent(uploadResult.batchId)}/finalize`, {
        method: 'POST',
      });
      const readyResult: UploadResult = {
        ...uploadResult,
        businessExpensesActivated: Number(activation.activated || activation.created || 0),
        reportingReady: true,
        activationError: undefined,
      };
      setResult(readyResult);
      setUploadError("");
      setProgress(100);
      queryClient.invalidateQueries({ queryKey: ["/api/finance/expenses-dashboard"] });
      queryClient.invalidateQueries({ queryKey: ["/api/bank-imports"] });
      onUploadComplete?.(readyResult);
      return readyResult;
    } catch (error: any) {
      const message = error?.message || "Failed to activate imported withdrawals for reporting";
      const partialResult: UploadResult = {
        ...uploadResult,
        reportingReady: false,
        activationError: message,
      };
      setResult(partialResult);
      setUploadError(`The statement was uploaded, but automatic business-expense activation failed: ${message}`);
      setProgress(90);
      toast({
        title: "Statement uploaded — reporting activation needs retry",
        description: message,
        variant: "destructive",
      });
      return partialResult;
    }
  }, [onUploadComplete, queryClient, toast]);

  const onDrop = useCallback(async (acceptedFiles: File[]) => {
    const file = acceptedFiles[0];
    if (!file) return;

    if (!file.name.toLowerCase().endsWith('.csv')) {
      toast({
        title: "Invalid file type",
        description: "Please upload a CSV file only.",
        variant: "destructive",
      });
      return;
    }

    setIsUploading(true);
    setUploadError("");
    setProgress(10);

    try {
      const formData = new FormData();
      formData.append('csv', file);
      formData.append('source', source);

      setProgress(50);

      const response = await fetch('/api/bank-imports', {
        method: 'POST',
        body: formData,
      });

      setProgress(80);

      if (!response.ok) {
        throw new Error(await readUploadError(response));
      }

      const uploadResult: UploadResult = await response.json();
      setResult(uploadResult);
      setProgress(90);

      const activated = await activateForReporting(uploadResult);
      if (activated.reportingReady) {
        toast({
          title: "Upload complete",
          description: `${activated.businessExpensesActivated || 0} withdrawals are already in Business Expenses under Review. ${activated.depositsCaptured || 0} deposit(s) remain reconciliation-only.`,
        });
      }
    } catch (error: any) {
      console.error('Upload error:', error);
      setUploadError(error.message || "Failed to process CSV file");
      toast({
        title: "Upload failed",
        description: error.message || "Failed to process CSV file",
        variant: "destructive",
      });
      setProgress(0);
    } finally {
      setIsUploading(false);
    }
  }, [source, toast, activateForReporting]);

  const retryActivation = useCallback(async () => {
    if (!result) return;
    setIsUploading(true);
    setUploadError("");
    setProgress(90);
    try {
      await activateForReporting(result);
    } finally {
      setIsUploading(false);
    }
  }, [activateForReporting, result]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'text/csv': ['.csv'],
    },
    multiple: false,
    disabled: isUploading,
  });

  const resetUpload = () => {
    setResult(null);
    setUploadError("");
    setProgress(0);
  };

  if (result) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CheckCircle className={`h-5 w-5 ${result.reportingReady ? 'text-green-600' : 'text-orange-600'}`} />
            {result.reportingReady ? 'Upload Complete — Reporting Ready' : 'Statement Uploaded'}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            <div className="text-sm">
              <div className="flex justify-between">
                <span>Bank source:</span>
                <span className="font-medium">{result.source || source}</span>
              </div>
              <div className="flex justify-between">
                <span>Parser format:</span>
                <span className="font-medium">{result.format}</span>
              </div>
              <div className="flex justify-between">
                <span>Transactions imported:</span>
                <span className="font-medium text-green-600">{result.inserted}</span>
              </div>
              <div className="flex justify-between">
                <span>Business expenses activated:</span>
                <span className="font-medium text-green-600">{result.businessExpensesActivated || 0}</span>
              </div>
              <div className="flex justify-between">
                <span>Default category:</span>
                <span className="font-medium">Review</span>
              </div>
              <div className="flex justify-between">
                <span>Deposits captured separately:</span>
                <span className="font-medium text-green-600">{result.depositsCaptured || 0}</span>
              </div>
              {result.skippedDupes > 0 && (
                <div className="flex justify-between">
                  <span>Duplicates skipped:</span>
                  <span className="font-medium text-orange-600">{result.skippedDupes}</span>
                </div>
              )}
            </div>

            {uploadError && (
              <div className="rounded-md border border-orange-200 bg-orange-50 p-3 text-xs text-orange-800">
                <div className="font-semibold">Reporting activation incomplete</div>
                <div className="mt-1 whitespace-pre-wrap">{uploadError}</div>
              </div>
            )}
            
            <div className="flex flex-wrap gap-2 pt-2">
              {result.reportingReady ? (
                <Button onClick={() => onUploadComplete?.(result)} className="flex-1">
                  Review / Mark Personal
                </Button>
              ) : (
                <Button onClick={retryActivation} disabled={isUploading} className="flex-1">
                  {isUploading ? 'Activating...' : 'Retry Reporting Activation'}
                </Button>
              )}
              <Button variant="outline" onClick={resetUpload} disabled={isUploading}>
                Upload Another
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Upload className="h-5 w-5" />
          Bank Statement Upload
        </CardTitle>
        <div className="text-sm text-muted-foreground">
          Upload a statement and withdrawals immediately become Business Expenses under Review. Mark only exceptions as Personal.
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="source">Bank Source</Label>
            <Select value={source} onValueChange={setSource}>
              <SelectTrigger>
                <SelectValue placeholder="Select bank" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="KBank">KBank</SelectItem>
                <SelectItem value="SCB">Siam Commercial Bank</SelectItem>
                <SelectItem value="CSV">Generic CSV</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div
            {...getRootProps()}
            className={`
              border-2 border-dashed rounded-lg p-6 text-center cursor-pointer transition-colors
              ${isDragActive ? 'border-blue-400 bg-blue-50' : 'border-gray-300 hover:border-gray-400'}
              ${isUploading ? 'pointer-events-none opacity-60' : ''}
            `}
          >
            <input {...getInputProps()} />
            <div className="space-y-2">
              <FileText className="h-8 w-8 mx-auto text-gray-400" />
              {isDragActive ? (
                <p className="text-blue-600">Drop the CSV file here...</p>
              ) : (
                <div>
                  <p className="text-gray-600">Drag & drop a CSV file here, or click to select</p>
                  <p className="text-xs text-gray-500 mt-1">Supports KBank, SCB, and generic CSV formats</p>
                </div>
              )}
            </div>
          </div>

          {uploadError && (
            <div className="rounded-md border border-red-200 bg-red-50 p-3 text-xs text-red-700">
              <div className="font-semibold">Upload failed</div>
              <div className="mt-1 whitespace-pre-wrap">{uploadError}</div>
            </div>
          )}

          {isUploading && (
            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span>{progress >= 80 ? 'Activating expenses for reporting...' : 'Processing CSV...'}</span>
                <span>{progress}%</span>
              </div>
              <Progress value={progress} className="h-2" />
            </div>
          )}

          <div className="text-xs text-gray-500 space-y-1 pt-2 border-t">
            <div className="flex items-center gap-1">
              <AlertCircle className="h-3 w-3" />
              <span className="font-medium">Expected CSV columns:</span>
            </div>
            <div className="ml-4">
              <div><strong>KBank:</strong> Date, Description, Amount (THB), Reference</div>
              <div><strong>SCB:</strong> Date, Description, Withdrawal, Deposit</div>
              <div><strong>Generic:</strong> Date, Description, Amount</div>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
