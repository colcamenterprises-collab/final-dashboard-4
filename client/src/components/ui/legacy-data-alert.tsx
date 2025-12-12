// PATCH L0 — Legacy Data Alert Component
// Shows warning when viewing read-only legacy data

import { AlertTriangle } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";

interface LegacyDataAlertProps {
  source?: string;
  className?: string;
}

export function LegacyDataAlert({ source, className = "" }: LegacyDataAlertProps) {
  if (source !== "legacy") {
    return null;
  }

  return (
    <Alert 
      variant="default" 
      className={`bg-amber-50 border-amber-200 ${className}`}
      data-testid="legacy-data-alert"
    >
      <AlertTriangle className="h-4 w-4 text-amber-600" />
      <AlertDescription className="text-amber-700 text-xs">
        Legacy Data (Read-Only) — Pre-Upgrade Records
      </AlertDescription>
    </Alert>
  );
}

/**
 * Hook to check if mutations should be disabled for legacy data
 */
export function useLegacyDataCheck(source?: string) {
  const isLegacy = source === "legacy";
  
  return {
    isLegacy,
    disableMutations: isLegacy,
    tooltip: isLegacy ? "Legacy record — read-only" : undefined
  };
}
