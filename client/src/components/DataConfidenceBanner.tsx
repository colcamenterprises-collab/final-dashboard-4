import { useQuery } from "@tanstack/react-query";
import { AlertCircle, CheckCircle, AlertTriangle } from "lucide-react";

interface DataConfidenceResult {
  ok: boolean;
  status: "GREEN" | "YELLOW" | "RED";
  reasons: string[];
}

export default function DataConfidenceBanner() {
  return null;
}
