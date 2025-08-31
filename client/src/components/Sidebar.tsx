import { NavLink } from "react-router-dom";
import {
  LayoutGrid, CalendarCheck, Library, LineChart, TrendingUp,
  Calculator, Sandwich, ClipboardCheck, Bot, FileSpreadsheet,
  Upload, FileText, ChevronLeft, ChevronRight, Database
} from "lucide-react";
import { useState } from "react";
import { ROUTES } from "../router/RouteRegistry";
import logoImg from "@assets/Yellow Circle - Black Logo_1756650531149.png";

type LinkProps = {
  to: string;
  label: string;
  Icon: React.ComponentType<{ className?: string }>;
  collapsed: boolean;
};

const baseItem =
  "flex items-center gap-3 px-4 py-2 rounded-lg transition-colors hover:bg-black hover:text-white";
const activeItem =
  "bg-emerald-600 text-white hover:bg-emerald-600";

function SLink({ to, label, Icon, collapsed, onClose }: LinkProps & { onClose?: () => void }) {
  return (
    <NavLink
      to={to}
      className={({ isActive }) =>
        `${baseItem} ${isActive ? activeItem : ""} text-[12px] text-black`
      }
      onClick={onClose}
    >
      <Icon className="h-5 w-5 shrink-0" />
      {!collapsed && <span className="leading-none">{label}</span>}
    </NavLink>
  );
}

interface SidebarProps {
  className?: string;
  onClose?: () => void;
}

export default function Sidebar({ className = "", onClose }: SidebarProps = {}) {
  const [collapsed, setCollapsed] = useState(false);
  const width = collapsed ? "w-[84px]" : "w-72";

  return (
    <aside
      className={`${className} ${width} border-r bg-white min-h-screen transition-[width] duration-200`}
    >
      {/* Logo at top-left */}
      <div className="p-3 border-b">
        <img 
          src={logoImg} 
          alt="Smash Brothers Burgers" 
          className="w-[60px] h-[60px] object-contain"
        />
      </div>
      
      {/* Collapse toggle */}
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
          onClose={onClose}
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
          onClose={onClose}
        />
        <SLink
          to={ROUTES.DAILY_SALES_LIBRARY}
          Icon={Library}
          label="Daily Sales Library"
          collapsed={collapsed}
          onClose={onClose}
        />
        <SLink
          to={ROUTES.ANALYSIS}
          Icon={LineChart}
          label="Analysis"
          collapsed={collapsed}
          onClose={onClose}
        />
        <SLink
          to={ROUTES.EXPENSES}
          Icon={FileSpreadsheet}
          label="Expenses"
          collapsed={collapsed}
          onClose={onClose}
        />
        <SLink
          to={ROUTES.SHIFT_REPORTS}
          Icon={ClipboardCheck}
          label="Shift Reports"
          collapsed={collapsed}
          onClose={onClose}
        />
        <SLink
          to={ROUTES.NIGHTLY_CHECKLIST}
          Icon={ClipboardCheck}
          label="Nightly Checklist"
          collapsed={collapsed}
          onClose={onClose}
        />
        <SLink
          to={ROUTES.JUSSI_AI}
          Icon={Bot}
          label="Jussi (Ops AI)"
          collapsed={collapsed}
          onClose={onClose}
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
          onClose={onClose}
        />
        <SLink
          to={ROUTES.JANE_ACCOUNTS}
          Icon={FileSpreadsheet}
          label="Jane (Accounting)"
          collapsed={collapsed}
          onClose={onClose}
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
          onClose={onClose}
        />
        <SLink
          to={ROUTES.INGREDIENTS}
          Icon={Sandwich}
          label="Ingredients"
          collapsed={collapsed}
          onClose={onClose}
        />
        <SLink
          to={ROUTES.MENU_MGR}
          Icon={LayoutGrid}
          label="Menu Manager"
          collapsed={collapsed}
          onClose={onClose}
        />
        <SLink
          to={ROUTES.MENU_IMPORT}
          Icon={Upload}
          label="Import Menu"
          collapsed={collapsed}
          onClose={onClose}
        />
        <SLink
          to={ROUTES.MENU_DESC_TOOL}
          Icon={FileText}
          label="Description Tool"
          collapsed={collapsed}
          onClose={onClose}
        />

        {/* Deep analysis links stay nested under Analysis (kept routable but hidden here) */}
        <div className="hidden">
          {/* keep for direct routing if someone pastes a URL */}
        </div>
      </nav>
    </aside>
  );
}