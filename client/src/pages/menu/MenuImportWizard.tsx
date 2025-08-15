import { useState } from "react";
import { importMenuCSV, commitMenuImport } from "@/lib/uploader";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Upload, FileText, CheckCircle, AlertCircle } from "lucide-react";

const PRESETS = {
  loyverse: { 
    items: ["Item", "SKU", "Category", "Price", "Quantity"], 
    modifiers: ["Modifier", "Quantity", "Sales"],
    sales: ["Item", "Price", "Quantity", "Sales"]
  },
  grab: { 
    items: ["Item Name", "SKU", "Category", "Price", "Quantity"],
    modifiers: ["Modifier", "Quantity", "Sales"],
    sales: ["Item Name", "Price", "Quantity", "Sales"]
  }
};

export default function MenuImportWizard() {
  const [source, setSource] = useState<"loyverse" | "grab">("loyverse");
  const [mode, setMode] = useState<"items" | "modifiers" | "sales">("items");
  const [file, setFile] = useState<File | null>(null);
  const [rows, setRows] = useState<any[]>([]);
  const [headers, setHeaders] = useState<string[]>([]);
  const [mappings, setMappings] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);
  const [step, setStep] = useState<"upload" | "mapping" | "preview" | "complete">("upload");
  const [error, setError] = useState<string>("");

  async function handleFileUpload() {
    if (!file) return;

    setLoading(true);
    setError("");

    try {
      const data = await importMenuCSV(file, source, mode);
      setRows(data.rows);
      setHeaders(data.headers);
      
      // Auto-suggest mappings based on column names
      const presetFields = PRESETS[source][mode] || [];
      const autoMappings: Record<string, string> = {};
      
      for (const field of presetFields) {
        const matchingHeader = data.headers.find((h: string) => 
          h.toLowerCase().includes(field.toLowerCase().split(" ")[0])
        );
        if (matchingHeader) {
          autoMappings[field.toLowerCase()] = matchingHeader;
        }
      }
      
      setMappings(autoMappings);
      setStep("mapping");
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }

  async function handleCommit() {
    setLoading(true);
    setError("");

    try {
      await commitMenuImport({ rows, mappings, source, mode });
      setStep("complete");
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }

  function resetWizard() {
    setFile(null);
    setRows([]);
    setHeaders([]);
    setMappings({});
    setStep("upload");
    setError("");
  }

  return (
    <div className="max-w-6xl mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Menu Import Wizard</h1>
        {step !== "upload" && (
          <Button variant="outline" onClick={resetWizard}>
            Start Over
          </Button>
        )}
      </div>

      {/* Step Indicator */}
      <div className="flex items-center gap-4 mb-8">
        {["upload", "mapping", "preview", "complete"].map((s, i) => (
          <div key={s} className="flex items-center">
            <div className={`flex items-center justify-center w-8 h-8 rounded-full ${
              step === s ? "bg-emerald-600 text-white" : 
              i < ["upload", "mapping", "preview", "complete"].indexOf(step) ? "bg-emerald-200 text-emerald-800" : 
              "bg-gray-200 text-gray-600"
            }`}>
              {i < ["upload", "mapping", "preview", "complete"].indexOf(step) ? 
                <CheckCircle className="w-4 h-4" /> : i + 1
              }
            </div>
            {i < 3 && <div className="w-12 h-0.5 bg-gray-300" />}
          </div>
        ))}
      </div>

      {error && (
        <Card className="p-4 border-red-200 bg-red-50">
          <div className="flex items-center gap-2 text-red-700">
            <AlertCircle className="w-4 h-4" />
            <span>{error}</span>
          </div>
        </Card>
      )}

      {/* Step 1: Upload */}
      {step === "upload" && (
        <Card className="p-6">
          <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <Label>POS System</Label>
                <Select value={source} onValueChange={(value: "loyverse" | "grab") => setSource(value)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="loyverse">Loyverse</SelectItem>
                    <SelectItem value="grab">Grab</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label>Import Type</Label>
                <Select value={mode} onValueChange={(value: "items" | "modifiers" | "sales") => setMode(value)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="items">Menu Items</SelectItem>
                    <SelectItem value="modifiers">Modifiers</SelectItem>
                    <SelectItem value="sales">Sales Summary</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label>CSV File</Label>
                <Input
                  type="file"
                  accept=".csv"
                  onChange={(e) => setFile(e.target.files?.[0] || null)}
                />
              </div>
            </div>

            <div className="flex justify-center">
              <Button 
                onClick={handleFileUpload}
                disabled={!file || loading}
                className="bg-emerald-600 hover:bg-emerald-700"
              >
                {loading ? "Processing..." : "Upload & Parse CSV"}
                <Upload className="w-4 h-4 ml-2" />
              </Button>
            </div>
          </div>
        </Card>
      )}

      {/* Step 2: Column Mapping */}
      {step === "mapping" && (
        <Card className="p-6">
          <div className="space-y-4">
            <h3 className="text-lg font-semibold">Map CSV Columns</h3>
            <p className="text-gray-600">Match your CSV columns to the required fields:</p>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {PRESETS[source][mode].map((field) => (
                <div key={field} className="space-y-2">
                  <Label>{field}</Label>
                  <Select 
                    value={mappings[field.toLowerCase()] || ""} 
                    onValueChange={(value) => setMappings(prev => ({ ...prev, [field.toLowerCase()]: value }))}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select column..." />
                    </SelectTrigger>
                    <SelectContent>
                      {headers.map((header) => (
                        <SelectItem key={header} value={header}>{header}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              ))}
            </div>

            <div className="flex justify-between pt-4">
              <Button variant="outline" onClick={() => setStep("upload")}>
                Back
              </Button>
              <Button 
                onClick={() => setStep("preview")}
                className="bg-emerald-600 hover:bg-emerald-700"
              >
                Preview Data
              </Button>
            </div>
          </div>
        </Card>
      )}

      {/* Step 3: Preview */}
      {step === "preview" && (
        <Card className="p-6">
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold">Preview Import Data</h3>
              <span className="text-sm text-gray-600">{rows.length} rows to import</span>
            </div>
            
            <div className="border rounded-lg overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow>
                    {Object.values(mappings).map((header) => (
                      <TableHead key={header}>{header}</TableHead>
                    ))}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.slice(0, 5).map((row, i) => (
                    <TableRow key={i}>
                      {Object.values(mappings).map((header) => (
                        <TableCell key={header}>{row[header as string] || "-"}</TableCell>
                      ))}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
            
            {rows.length > 5 && (
              <p className="text-sm text-gray-600 text-center">
                Showing first 5 rows of {rows.length} total rows
              </p>
            )}

            <div className="flex justify-between pt-4">
              <Button variant="outline" onClick={() => setStep("mapping")}>
                Back to Mapping
              </Button>
              <Button 
                onClick={handleCommit}
                disabled={loading}
                className="bg-emerald-600 hover:bg-emerald-700"
              >
                {loading ? "Importing..." : `Import ${rows.length} Records`}
              </Button>
            </div>
          </div>
        </Card>
      )}

      {/* Step 4: Complete */}
      {step === "complete" && (
        <Card className="p-6 text-center">
          <div className="space-y-4">
            <CheckCircle className="w-16 h-16 text-emerald-600 mx-auto" />
            <h3 className="text-xl font-semibold">Import Complete!</h3>
            <p className="text-gray-600">
              Successfully imported {rows.length} {mode} from {source}
            </p>
            <Button 
              onClick={resetWizard}
              className="bg-emerald-600 hover:bg-emerald-700"
            >
              Import Another File
            </Button>
          </div>
        </Card>
      )}
    </div>
  );
}