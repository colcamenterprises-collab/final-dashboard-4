import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import PageShell from "@/layouts/PageShell";

export default function Ingredients() {
  const [csvContent, setCsvContent] = useState("");
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: ingredientsData, isLoading } = useQuery({
    queryKey: ["/api/costing/ingredients"],
  });

  const importMutation = useMutation({
    mutationFn: async (csv: string) => {
      const r = await fetch("/api/costing/ingredients/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ csv }),
      });

      // If server didn't return JSON OK, read the text so we don't get the '<!DOCTYPE' error
      if (!r.ok) {
        const msg = await r.text();
        throw new Error(`Import failed: ${msg}`);
      }
      const j = await r.json();
      if (!j.ok) throw new Error(j.error || "Import failed");
      return j;
    },
    onSuccess: (data) => {
      toast({ title: "Success", description: `Imported ${data.imported} ingredients` });
      queryClient.invalidateQueries({ queryKey: ["/api/costing/ingredients"] });
      setCsvContent("");
    },
    onError: (error: any) => {
      console.error(error);
      toast({ title: "Error", description: error.message || "Import failed", variant: "destructive" });
    }
  });

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (e) => {
        setCsvContent(e.target?.result as string);
      };
      reader.readAsText(file);
    }
  };

  const handleImport = () => {
    if (csvContent.trim()) {
      importMutation.mutate(csvContent);
    }
  };

  const ingredients = ingredientsData?.list || [];

  return (
    <PageShell>
      <div className="space-y-6">
        <h1 className="h1">Ingredients</h1>

        {/* CSV Import Section */}
        <div className="rounded-2xl border bg-white p-6">
          <h2 className="h2 mb-4">Import from CSV</h2>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-2">
                Upload CSV (name, unit, unitCost, supplier)
              </label>
              <input
                type="file"
                accept=".csv"
                onChange={handleFileUpload}
                className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-emerald-50 file:text-emerald-700 hover:file:bg-emerald-100"
              />
            </div>
            {csvContent && (
              <div>
                <label className="block text-sm font-medium mb-2">CSV Preview:</label>
                <textarea
                  value={csvContent.substring(0, 500)}
                  readOnly
                  className="w-full h-32 p-3 border rounded-xl text-sm font-mono"
                />
              </div>
            )}
            <button
              onClick={handleImport}
              disabled={!csvContent.trim() || importMutation.isPending}
              className="px-4 py-2 bg-emerald-600 text-white rounded-xl hover:bg-emerald-700 disabled:opacity-50"
            >
              {importMutation.isPending ? "Importing..." : "Import Ingredients"}
            </button>
          </div>
        </div>

        {/* Ingredients List */}
        <div className="rounded-2xl border bg-white p-6">
          <h2 className="h2 mb-4">Current Ingredients</h2>
          {isLoading ? (
            <div className="text-center py-8">Loading...</div>
          ) : ingredients.length === 0 ? (
            <div className="text-center py-8 text-gray-500">No ingredients found</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b">
                    <th className="text-left py-2">Name</th>
                    <th className="text-left py-2">Unit</th>
                    <th className="text-left py-2">Unit Cost (฿)</th>
                    <th className="text-left py-2">Supplier</th>
                  </tr>
                </thead>
                <tbody>
                  {ingredients.map((ingredient: any) => (
                    <tr key={ingredient.id} className="border-b">
                      <td className="py-2">{ingredient.name}</td>
                      <td className="py-2">{ingredient.unit}</td>
                      <td className="py-2">{Number(ingredient.unitCost).toFixed(2)}</td>
                      <td className="py-2">{ingredient.supplier || "-"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </PageShell>
  );
}