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
  const [file, setFile] = useState<File | null>(null);
  const [shiftDate, setShiftDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [reportId, setReportId] = useState<number | null>(null);
  const [compilation, setCompilation] = useState<CompilationResult | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [isCompiling, setIsCompiling] = useState(false);
  const { toast } = useToast();

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      const allowedTypes = ['application/pdf', 'text/csv', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'];
      if (allowedTypes.includes(selectedFile.type)) {
        setFile(selectedFile);
      } else {
        toast({
          title: "Invalid file type",
          description: "Please select a PDF, CSV, or Excel file",
          variant: "destructive",
        });
      }
    }
  };

  const handleUpload = async () => {
    if (!file) {
      toast({
        title: "No file selected",
        description: "Please select a file to upload",
        variant: "destructive",
      });
      return;
    }

    setIsUploading(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('shiftDate', shiftDate);
      
      const response = await fetch('/api/receipts/upload', { 
        method: 'POST', 
        body: formData 
      });
      
      if (!response.ok) {
        throw new Error('Upload failed');
      }
      
      const data = await response.json();
      setReportId(data.id);
      
      toast({
        title: "File uploaded successfully",
        description: "Ready to compile items and modifiers",
      });
    } catch (error) {
      console.error('Upload error:', error);
      toast({
        title: "Upload failed",
        description: "Failed to upload file. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsUploading(false);
    }
  };

  const triggerCompilation = async () => {
    if (!reportId) return;

    setIsCompiling(true);
    try {
      const response = await fetch('/api/receipts/compile', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ reportId })
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
            <Label htmlFor="fileUpload">Receipt File (PDF, CSV, or Excel)</Label>
            <Input
              id="fileUpload"
              type="file"
              accept=".pdf,.csv,.xlsx,.xls"
              onChange={handleFileChange}
            />
            {file && (
              <p className="text-sm text-gray-600">
                Selected: {file.name} ({(file.size / 1024 / 1024).toFixed(2)} MB)
              </p>
            )}
          </div>
          
          <Button 
            onClick={handleUpload} 
            disabled={!file || isUploading}
            className="w-full"
          >
            <Upload className="w-4 h-4 mr-2" />
            {isUploading ? "Uploading..." : "Upload Receipts"}
          </Button>

          {reportId && (
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