// src/App.tsx
import { BrowserRouter, Routes, Route, useLocation, Navigate } from "react-router-dom";
import { Suspense } from "react";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import PageShell from "./layouts/PageShell";
import NewSidebar from "./components/NewSidebar";
import Overview from "./pages/Overview";
import DailySalesStock from "./pages/DailySalesStock";
import DailySalesLibrary from "./pages/DailySalesLibrary";
import NotFound from "./pages/NotFound";
import { ROUTES, isAllowedPath } from "./router/RouteRegistry";

function GuardedRoute({ children }: { children: JSX.Element }) {
  const { pathname } = useLocation();
  if (!isAllowedPath(pathname)) return <NotFound />;
  return children;
}

function App() {
  return (
    <BrowserRouter>
      <div className="min-h-screen w-full flex bg-neutral-50">
        <NewSidebar />
        <PageShell>
          <Suspense fallback={<div className="p-6">Loading…</div>}>
            <Routes>
              <Route
                path={ROUTES.OVERVIEW}
                element={
                  <GuardedRoute>
                    <Overview />
                  </GuardedRoute>
                }
              />
              <Route
                path={ROUTES.DAILY_SALES_STOCK}
                element={
                  <GuardedRoute>
                    <DailySalesStock />
                  </GuardedRoute>
                }
              />
              <Route
                path={ROUTES.DAILY_SALES_LIBRARY}
                element={
                  <GuardedRoute>
                    <DailySalesLibrary />
                  </GuardedRoute>
                }
              />
              {/* Hard-redirect any unknown path to NotFound (guard will still run) */}
              <Route path="*" element={<NotFound />} />
            </Routes>
          </Suspense>
        </PageShell>
      </div>
    </BrowserRouter>
  );
}

function AppWrapper() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <App />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default AppWrapper;