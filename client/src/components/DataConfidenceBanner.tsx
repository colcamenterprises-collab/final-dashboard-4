import { useQuery } from "@tanstack/react-query";
import { AlertCircle, CheckCircle, AlertTriangle } from "lucide-react";

interface DataConfidenceResult {
  ok: boolean;
  status: "GREEN" | "YELLOW" | "RED";
  reasons: string[];
}

export default function DataConfidenceBanner() {
  const { data, isLoading } = useQuery<DataConfidenceResult>({
    queryKey: ["/api/data-confidence"],
    refetchInterval: 60000,
  });

  if (isLoading || !data?.ok) return null;

  const { status, reasons } = data;

  if (status === "GREEN") {
    return (
      <div className="bg-emerald-50 border-b border-emerald-200 px-4 py-2 flex items-center gap-2" data-testid="banner-green">
        <CheckCircle className="w-4 h-4 text-emerald-600" />
        <span className="text-xs text-emerald-700 font-medium">All data verified</span>
      </div>
    );
  }

  if (status === "YELLOW") {
    return (
      <div className="bg-amber-50 border-b border-amber-200 px-4 py-2 flex items-center gap-2" data-testid="banner-yellow">
        <AlertTriangle className="w-4 h-4 text-amber-600" />
        <span className="text-xs text-amber-700 font-medium">Some data incomplete</span>
        <span className="text-xs text-amber-600 ml-2">{reasons.join(" • ")}</span>
      </div>
    );
  }

  return (
    <div className="bg-red-50 border-b border-red-200 px-4 py-2 flex items-center gap-2" data-testid="banner-red">
      <AlertCircle className="w-4 h-4 text-red-600" />
      <span className="text-xs text-red-700 font-medium">Action required</span>
      <span className="text-xs text-red-600 ml-2">{reasons.join(" • ")}</span>
    </div>
  );
}
