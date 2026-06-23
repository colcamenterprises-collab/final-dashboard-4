import type { JSX } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { usePinAuth } from "@/components/PinLoginGate";

export default function ProtectedRoute({ children }: { children: JSX.Element }) {
  const { currentUser } = usePinAuth();
  const location = useLocation();

  if (!currentUser) {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  }

  return children;
}
