import { useState, useCallback } from "react";
import { useDropzone } from "react-dropzone";
import { Upload, FileText, AlertCircle, CheckCircle } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
}

interface BankStatementUploadProps {
  onUploadComplete?: (result: UploadResult) => void;
}

export function BankStatementUpload({ onUploadComplete }: BankStatementUploadProps) {
  const [isUploading, setIsUploading] = useState(false);
  const [source, setSource] = useState("CSV");
  const [result, setResult] = useState<UploadResult | null>(null);
  const [progress, setProgress] = useState(0);
  const { toast } = useToast();

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
        const error = await response.json();
        throw new Error(error.error || 'Upload failed');
      }

      const uploadResult: UploadResult = await response.json();
      setResult(uploadResult);
      setProgress(100);

      toast({
        title: "Upload successful",
        description: `Imported ${uploadResult.inserted} transactions, skipped ${uploadResult.skippedDupes} duplicates`,
      });

      onUploadComplete?.(uploadResult);

    } catch (error: any) {
      console.error('Upload error:', error);
      toast({
        title: "Upload failed",
        description: error.message || "Failed to process CSV file",
        variant: "destructive",
      });
      setProgress(0);
    } finally {
      setIsUploading(false);
    }
  }, [source, toast, onUploadComplete]);

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
    setProgress(0);
  };

  if (result) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CheckCircle className="h-5 w-5 text-green-600" />
            Upload Complete
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            <div className="text-sm">
              <div className="flex justify-between">
                <span>Format detected:</span>
                <span className="font-medium">{result.format}</span>
              </div>
              <div className="flex justify-between">
                <span>Transactions imported:</span>
                <span className="font-medium text-green-600">{result.inserted}</span>
              </div>
              {result.skippedDupes > 0 && (
                <div className="flex justify-between">
                  <span>Duplicates skipped:</span>
                  <span className="font-medium text-orange-600">{result.skippedDupes}</span>
                </div>
              )}
            </div>
            
            <div className="flex gap-2 pt-2">
              <Button 
                onClick={() => onUploadComplete?.(result)}
                className="flex-1"
              >
                Review Transactions
              </Button>
              <Button variant="outline" onClick={resetUpload}>
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
          Upload CSV bank statements to automatically create expense entries
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {/* Source Selection */}
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

          {/* File Upload Area */}
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
                  <p className="text-gray-600">
                    Drag & drop a CSV file here, or click to select
                  </p>
                  <p className="text-xs text-gray-500 mt-1">
                    Supports KBank, SCB, and generic CSV formats
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* Upload Progress */}
          {isUploading && (
            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span>Processing CSV...</span>
                <span>{progress}%</span>
              </div>
              <Progress value={progress} className="h-2" />
            </div>
          )}

          {/* Format Guide */}
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