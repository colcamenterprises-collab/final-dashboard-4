import { NavLink } from "react-router-dom";
import {
  LayoutGrid, CalendarCheck, Library, LineChart, TrendingUp,
  Calculator, Sandwich, ClipboardCheck, Bot, FileSpreadsheet,
  Upload, FileText, ChevronLeft, ChevronRight, Database
} from "lucide-react";
import { useState } from "react";
import { ROUTES } from "../router/RouteRegistry";

type LinkProps = {
  to: string;
  label: string;
  Icon: React.ComponentType<{ className?: string }>;
  collapsed: boolean;
};

const baseItem =
  "flex items-center gap-3 px-4 py-2 rounded-xl transition-colors hover:bg-emerald-600/10";
const activeItem =
  "bg-emerald-600 text-white hover:bg-emerald-600";

function SLink({ to, label, Icon, collapsed }: LinkProps) {
  return (
    <NavLink
      to={to}
      className={({ isActive }) =>
        `${baseItem} ${isActive ? activeItem : ""} text-[12px] text-black`
      }
    >
      <Icon className="h-5 w-5 shrink-0" />
      {!collapsed && <span className="leading-none">{label}</span>}
    </NavLink>
  );
}

export default function Sidebar() {
  const [collapsed, setCollapsed] = useState(false);
  const width = collapsed ? "w-[84px]" : "w-72";

  return (
    <aside
      className={`${width} border-r bg-white min-h-screen transition-[width] duration-200`}
    >
      {/* top row with collapse toggle */}
      <div className="px-3 py-3 border-b flex items-center justify-end">
        <button
          aria-label="Toggle sidebar"
          className="rounded-xl border p-2"
          onClick={() => setCollapsed((v) => !v)}
        >
          {collapsed ? (
            <ChevronRight className="h-4 w-4" />
          ) : (
            <ChevronLeft className="h-4 w-4" />
          )}
        </button>
      </div>

      <nav className="p-3">
        {/* Dashboard */}
        <div className={!collapsed ? "px-4 pt-4 pb-2" : "px-3 pt-4 pb-2"}>
          {!collapsed && (
            <div className="text-[14px] font-semibold text-black leading-none">
              Dashboard
            </div>
          )}
        </div>
        <SLink
          to={ROUTES.HOME}
          Icon={LayoutGrid}
          label="Home"
          collapsed={collapsed}
        />

        {/* Operations */}
        <div className={!collapsed ? "px-4 pt-4 pb-2" : "px-3 pt-4 pb-2"}>
          {!collapsed && (
            <div className="text-[14px] font-semibold text-black leading-none">
              Operations
            </div>
          )}
        </div>
        <SLink
          to="/operations/daily-sales"
          Icon={CalendarCheck}
          label="Daily Sales & Stock"
          collapsed={collapsed}
        />
        <SLink
          to={ROUTES.DAILY_SALES_LIBRARY}
          Icon={Library}
          label="Daily Sales Library"
          collapsed={collapsed}
        />
        <SLink
          to={ROUTES.ANALYSIS}
          Icon={LineChart}
          label="Analysis"
          collapsed={collapsed}
        />
        <SLink
          to={ROUTES.EXPENSES}
          Icon={FileSpreadsheet}
          label="Expenses"
          collapsed={collapsed}
        />
        <SLink
          to={ROUTES.SHIFT_REPORTS}
          Icon={ClipboardCheck}
          label="Shift Reports"
          collapsed={collapsed}
        />
        <SLink
          to="/operations/pos-analysis"
          Icon={Database}
          label="POS Analysis"
          collapsed={collapsed}
        />
        <SLink
          to={ROUTES.NIGHTLY_CHECKLIST}
          Icon={ClipboardCheck}
          label="Nightly Checklist"
          collapsed={collapsed}
        />
        <SLink
          to={ROUTES.JUSSI_AI}
          Icon={Bot}
          label="Jussi (Ops AI)"
          collapsed={collapsed}
        />

        {/* Finance */}
        <div className={!collapsed ? "px-4 pt-4 pb-2" : "px-3 pt-4 pb-2"}>
          {!collapsed && (
            <div className="text-[14px] font-semibold text-black leading-none">
              Finance
            </div>
          )}
        </div>
        <SLink
          to={ROUTES.PROFIT_LOSS}
          Icon={TrendingUp}
          label="Profit & Loss"
          collapsed={collapsed}
        />
        <SLink
          to={ROUTES.JANE_ACCOUNTS}
          Icon={FileSpreadsheet}
          label="Jane (Accounting)"
          collapsed={collapsed}
        />

        {/* Menu Mgmt */}
        <div className={!collapsed ? "px-4 pt-4 pb-2" : "px-3 pt-4 pb-2"}>
          {!collapsed && (
            <div className="text-[14px] font-semibold text-black leading-none">
              Menu Mgmt
            </div>
          )}
        </div>
        <SLink
          to={ROUTES.COST_CALCULATOR}
          Icon={Calculator}
          label="Cost Calculator"
          collapsed={collapsed}
        />
        <SLink
          to={ROUTES.INGREDIENTS}
          Icon={Sandwich}
          label="Ingredients"
          collapsed={collapsed}
        />
        <SLink
          to={ROUTES.MENU_MGR}
          Icon={LayoutGrid}
          label="Menu Manager"
          collapsed={collapsed}
        />
        <SLink
          to={ROUTES.MENU_IMPORT}
          Icon={Upload}
          label="Import Menu"
          collapsed={collapsed}
        />
        <SLink
          to={ROUTES.MENU_DESC_TOOL}
          Icon={FileText}
          label="Description Tool"
          collapsed={collapsed}
        />

        {/* Deep analysis links stay nested under Analysis (kept routable but hidden here) */}
        <div className="hidden">
          {/* keep for direct routing if someone pastes a URL */}
        </div>
      </nav>
    </aside>
  );
}