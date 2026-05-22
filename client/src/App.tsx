import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { QueryClientProvider } from "@tanstack/react-query";
import { queryClient } from "./lib/queryClient";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ErrorBoundary } from "./components/ErrorBoundary";
import { AuthProvider } from "./auth/AuthProvider";
import ProtectedRoute from "./auth/ProtectedRoute";
import PinLoginGate, { usePinAuth } from "./components/PinLoginGate";
import PageShell from "./layouts/PageShell";
import Home from "./pages/Home";
import Login from "./pages/auth/Login";
import DailySalesForm from "./pages/operations/daily-sales/Form";
import DailyStock from "./pages/operations/DailyStock";
import DailySalesV2Library from "./pages/operations/daily-sales-v2/Library";
import PurchasingPage from "./pages/operations/Purchasing";
import NotFound from "./pages/NotFound";

function OwnerRoute({ children }: { children: JSX.Element }) {
  const { currentUser } = usePinAuth();
  if (currentUser?.role !== "owner") {
    return <Navigate to="/dashboard" replace />;
  }
  return children;
}

export default function App() {
  return (
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <AuthProvider>
          <TooltipProvider>
            <BrowserRouter>
              <PinLoginGate>
                <Routes>
                  <Route path="/" element={<Navigate to="/dashboard" replace />} />
                  <Route path="/login" element={<Login />} />
                  <Route element={<PageShell />}>
                    <Route path="/dashboard" element={<ProtectedRoute><Home /></ProtectedRoute>} />
                    <Route path="/operations/daily-sales" element={<ProtectedRoute><DailySalesForm /></ProtectedRoute>} />
                    <Route path="/operations/daily-sales/edit/:id" element={<ProtectedRoute><DailySalesForm /></ProtectedRoute>} />
                    <Route path="/operations/daily-stock" element={<ProtectedRoute><DailyStock /></ProtectedRoute>} />
                    <Route path="/operations/daily-sales-v2/library" element={<ProtectedRoute><OwnerRoute><DailySalesV2Library /></OwnerRoute></ProtectedRoute>} />
                    <Route path="/operations/daily-sales-library" element={<Navigate to="/operations/daily-sales-v2/library" replace />} />
                    <Route path="/operations/purchasing" element={<ProtectedRoute><PurchasingPage /></ProtectedRoute>} />
                    <Route path="*" element={<NotFound />} />
                  </Route>
                </Routes>
                <Toaster />
              </PinLoginGate>
            </BrowserRouter>
          </TooltipProvider>
        </AuthProvider>
      </QueryClientProvider>
    </ErrorBoundary>
  );
}
