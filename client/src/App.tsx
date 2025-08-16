// src/App.tsx
import { BrowserRouter, Routes, Route, useLocation } from "react-router-dom";
import { Suspense } from "react";
import PageShell from "./layouts/PageShell";
import Sidebar from "./components/Sidebar";
import Overview from "./pages/Overview";
import DailySalesStock from "./pages/DailySalesStock";
import DailySalesLibrary from "./pages/DailySalesLibrary";
import Expenses from "./pages/Expenses";
import NotFound from "./pages/NotFound";
import { isAllowedPath, ROUTES } from "./router/RouteRegistry";

function Guard({ children }: { children: JSX.Element }) {
  const { pathname } = useLocation();
  return isAllowedPath(pathname) ? children : <NotFound />;
}

export default function App() {
  return (
    <BrowserRouter>
      <div className="min-h-screen w-full flex bg-neutral-50">
        <Sidebar />
        <PageShell>
          <Suspense fallback={<div className="p-6">Loading…</div>}>
            <Routes>
              <Route path={ROUTES.OVERVIEW} element={<Guard><Overview /></Guard>} />
              <Route path={ROUTES.DAILY_SALES_STOCK} element={<Guard><DailySalesStock /></Guard>} />
              <Route path={ROUTES.DAILY_SALES_LIBRARY} element={<Guard><DailySalesLibrary /></Guard>} />
              <Route path={ROUTES.EXPENSES} element={<Guard><Expenses /></Guard>} />
              <Route path="*" element={<NotFound />} />
            </Routes>
          </Suspense>
        </PageShell>
      </div>
    </BrowserRouter>
  );
}