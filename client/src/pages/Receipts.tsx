import { useState } from 'react';
import { Card, CardHeader, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { Upload, FileText, Calculator, Package } from "lucide-react";

interface CompilationResult {
  items: { category: string; name: string; quantity: number }[];
  modifiers: { name: string; count: number }[];
  ingredients: { name: string; quantity: number; unit: string }[];
}

const Receipts = () => {
  const [files, setFiles] = useState<FileList | null>(null);
  const [shiftDate, setShiftDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [reportIds, setReportIds] = useState<number[]>([]);
  const [compilation, setCompilation] = useState<CompilationResult | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [isCompiling, setIsCompiling] = useState(false);
  const { toast } = useToast();

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFiles = e.target.files;
    if (selectedFiles && selectedFiles.length > 0) {
      const allowedTypes = ['application/pdf', 'text/csv', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'];
      const validFiles = Array.from(selectedFiles).filter(file => 
        allowedTypes.includes(file.type)
      );
      
      if (validFiles.length !== selectedFiles.length) {
        toast({
          title: "Invalid file type",
          description: "Please select only PDF, CSV, or Excel files",
          variant: "destructive",
        });
        return;
      }
      
      setFiles(selectedFiles);
    }
  };

  const handleUpload = async () => {
    if (!files || files.length === 0) {
      toast({
        title: "No files selected",
        description: "Please select files to upload",
        variant: "destructive",
      });
      return;
    }

    setIsUploading(true);
    try {
      const formData = new FormData();
      Array.from(files).forEach(file => formData.append('files', file));
      formData.append('shiftDate', shiftDate);
      
      const response = await fetch('/api/receipts/upload', { 
        method: 'POST', 
        body: formData 
      });
      
      if (!response.ok) {
        throw new Error('Upload failed');
      }
      
      const data = await response.json();
      setReportIds(data.ids);
      
      toast({
        title: "Files uploaded successfully",
        description: `${files.length} files ready for compilation`,
      });
    } catch (error) {
      console.error('Upload error:', error);
      toast({
        title: "Upload failed",
        description: "Failed to upload files. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsUploading(false);
    }
  };

  const triggerCompilation = async () => {
    if (reportIds.length === 0) return;

    setIsCompiling(true);
    try {
      const response = await fetch('/api/receipts/compile', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ reportIds })
      });
      
      if (!response.ok) {
        throw new Error('Compilation failed');
      }
      
      const data = await response.json();
      setCompilation(data);
      
      toast({
        title: "Compilation complete",
        description: "Items, modifiers, and ingredients analyzed",
      });
    } catch (error) {
      console.error('Compilation error:', error);
      toast({
        title: "Compilation failed",
        description: "Failed to analyze receipts. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsCompiling(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center space-x-2">
        <FileText className="h-6 w-6" />
        <h1 className="text-2xl font-bold">Receipts Analysis</h1>
      </div>

      <Card>
        <CardHeader>
          <h2 className="text-lg font-semibold">Upload Receipts for Shift</h2>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="shiftDate">Shift Date</Label>
            <Input
              id="shiftDate"
              type="date"
              value={shiftDate}
              onChange={(e) => setShiftDate(e.target.value)}
            />
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="fileUpload">Receipt Files (PDF, CSV, or Excel) - Multiple files supported</Label>
            <Input
              id="fileUpload"
              type="file"
              accept=".pdf,.csv,.xlsx,.xls"
              multiple
              onChange={handleFileChange}
            />
            {files && files.length > 0 && (
              <div className="text-sm text-gray-600">
                <p>Selected {files.length} file(s):</p>
                <ul className="list-disc ml-4">
                  {Array.from(files).map((file, index) => (
                    <li key={index}>
                      {file.name} ({(file.size / 1024 / 1024).toFixed(2)} MB)
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
          
          <Button 
            onClick={handleUpload} 
            disabled={!files || files.length === 0 || isUploading}
            className="w-full"
          >
            <Upload className="w-4 h-4 mr-2" />
            {isUploading ? "Uploading..." : `Upload ${files?.length || 0} Receipt Files`}
          </Button>

          {reportIds.length > 0 && (
            <Button 
              onClick={triggerCompilation} 
              disabled={isCompiling}
              className="w-full mt-4"
              variant="outline"
            >
              <Calculator className="w-4 h-4 mr-2" />
              {isCompiling ? "Analyzing..." : "Compile Items & Modifiers"}
            </Button>
          )}
        </CardContent>
      </Card>

      {compilation && (
        <div className="grid md:grid-cols-3 gap-6">
          <Card>
            <CardHeader>
              <h3 className="text-lg font-semibold flex items-center">
                <Package className="w-5 h-5 mr-2" />
                Items Sold by Category
              </h3>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {compilation.items.map((item, i) => (
                  <div key={i} className="flex justify-between items-center py-2 border-b">
                    <div>
                      <span className="font-medium">{item.name}</span>
                      <div className="text-sm text-gray-600">{item.category}</div>
                    </div>
                    <span className="font-semibold">{item.quantity}</span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <h3 className="text-lg font-semibold flex items-center">
                <Calculator className="w-5 h-5 mr-2" />
                Modifiers Sold
              </h3>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {compilation.modifiers.map((mod, i) => (
                  <div key={i} className="flex justify-between items-center py-2 border-b">
                    <span className="font-medium">{mod.name}</span>
                    <span className="font-semibold">{mod.count}</span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <h3 className="text-lg font-semibold flex items-center">
                <Package className="w-5 h-5 mr-2" />
                Ingredient Usage Summary
              </h3>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {compilation.ingredients.map((ing, i) => (
                  <div key={i} className="flex justify-between items-center py-2 border-b">
                    <span className="font-medium">{ing.name}</span>
                    <span className="font-semibold">{ing.quantity} {ing.unit}</span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
};

export default Receipts;