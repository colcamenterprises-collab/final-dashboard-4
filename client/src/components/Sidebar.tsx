import { NavLink } from "react-router-dom";
import {
  LayoutGrid, CalendarCheck, Library, LineChart, Upload, Receipt,
  TrendingUp, Calculator, Sandwich, ClipboardCheck, Bot, FileSpreadsheet,
  ChevronLeft, ChevronRight
} from "lucide-react";
import { useState } from "react";
import { ROUTES } from "../router/RouteRegistry";

const item =
  "flex items-center gap-3 px-4 py-2 rounded-xl hover:bg-emerald-600/10 transition-colors";
const active = "bg-emerald-600 text-white hover:bg-emerald-600";
const group = "px-4 pt-4 pb-2 text-xs font-semibold tracking-wide text-neutral-400";

function SLink({ to, icon: Icon, children, collapsed }:{
  to:string; icon:any; children:string; collapsed:boolean;
}) {
  return (
    <NavLink to={to} className={({isActive}) => `${item} ${isActive?active:""}`}>
      <Icon className="h-5 w-5 shrink-0" />
      {!collapsed && <span className="text-base">{children}</span>}
    </NavLink>
  );
}

export default function Sidebar() {
  const [collapsed, setCollapsed] = useState(false);
  const width = collapsed ? "w-[84px]" : "w-72";

  return (
    <aside className={`${width} border-r bg-white min-h-screen transition-[width] duration-200`}>
      <div className="px-3 py-3 border-b flex items-center justify-between">
        {/* empty block so logo only lives in Topbar */}
        <button
          aria-label="Toggle sidebar"
          className="ml-auto rounded-xl border p-2"
          onClick={() => setCollapsed(v => !v)}
        >
          {collapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
        </button>
      </div>

      <nav className="p-3">
        <div className={group}>{!collapsed && "Dashboard"}</div>
        <SLink to={ROUTES.HOME} icon={LayoutGrid} collapsed={collapsed}>Home</SLink>

        <div className={group}>{!collapsed && "Operations"}</div>
        <SLink to={ROUTES.DAILY_SALES_STOCK} icon={CalendarCheck} collapsed={collapsed}>Daily Sales & Stock</SLink>
        <SLink to={ROUTES.DAILY_SALES_LIBRARY} icon={Library} collapsed={collapsed}>Daily Sales Library</SLink>
        <SLink to={ROUTES.ANALYSIS} icon={LineChart} collapsed={collapsed}>Analysis</SLink>

        <div className={group}>{!collapsed && "Finance"}</div>
        <SLink to={ROUTES.PROFIT_LOSS} icon={TrendingUp} collapsed={collapsed}>Profit & Loss</SLink>

        <div className={group}>{!collapsed && "Menu Mgmt"}</div>
        <SLink to={ROUTES.COST_CALCULATOR} icon={Calculator} collapsed={collapsed}>Cost Calculator</SLink>
        <SLink to={ROUTES.INGREDIENTS} icon={Sandwich} collapsed={collapsed}>Ingredients</SLink>

        <div className={group}>{!collapsed && "Managers"}</div>
        <SLink to={ROUTES.NIGHTLY_CHECKLIST} icon={ClipboardCheck} collapsed={collapsed}>Nightly Checklist</SLink>
        <SLink to={ROUTES.JUSSI_AI} icon={Bot} collapsed={collapsed}>Jussi (Ops AI)</SLink>
        <SLink to={ROUTES.JANE_ACCOUNTS} icon={FileSpreadsheet} collapsed={collapsed}>Jane (Accounting)</SLink>

        {/* Hidden direct links (now inside Analysis), keep for deep routes if needed */}
        <div className="hidden">
          <SLink to={ROUTES.UPLOAD_STATEMENTS} icon={Upload} collapsed={collapsed}>Upload Statements</SLink>
          <SLink to={ROUTES.RECEIPTS} icon={Receipt} collapsed={collapsed}>Receipts</SLink>
        </div>
      </nav>
    </aside>
  );
}