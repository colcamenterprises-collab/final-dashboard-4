// src/components/Sidebar.tsx
import { NavLink } from "react-router-dom";
import { ROUTES } from "../router/RouteRegistry";

const item = "block px-4 py-2 rounded-xl hover:bg-emerald-600/10";
const active = "bg-emerald-600 text-white hover:bg-emerald-600";
const group = "px-4 pt-4 pb-2 text-xs font-semibold tracking-wide text-neutral-400";

const Link = ({ to, children }: { to: string; children: React.ReactNode }) => (
  <NavLink to={to} className={({ isActive }) => `${item} ${isActive ? active : ""}`}>
    {children}
  </NavLink>
);

export default function Sidebar() {
  return (
    <aside className="w-72 border-r bg-white min-h-screen">
      <div className="px-5 py-4 border-b">
        <div className="font-extrabold text-lg">Smash Brothers</div>
      </div>

      <nav className="p-4">
        <div className={group}>Dashboard</div>
        <Link to={ROUTES.OVERVIEW}>Overview</Link>

        <div className={group}>Operations</div>
        <Link to={ROUTES.DAILY_SALES_STOCK}>Daily Sales & Stock</Link>
        <Link to={ROUTES.DAILY_SALES_LIBRARY}>Daily Sales Library</Link>
        <Link to={ROUTES.UPLOAD_STATEMENTS}>Upload Statements</Link>
        <Link to={ROUTES.RECEIPTS}>Receipts</Link>
        <Link to={ROUTES.SHIFT_SUMMARY}>Shift Summary</Link>

        <div className={group}>Finance</div>
        <Link to={ROUTES.PROFIT_LOSS}>Profit & Loss</Link>

        <div className={group}>Menu Mgmt</div>
        <Link to={ROUTES.COST_CALCULATOR}>Cost Calculator</Link>
        <Link to={ROUTES.INGREDIENTS}>Ingredients</Link>

        <div className={group}>Managers</div>
        <Link to={ROUTES.NIGHTLY_CHECKLIST}>Nightly Checklist</Link>
        <Link to={ROUTES.JUSSI_AI}>Jussi (Ops AI)</Link>
        <Link to={ROUTES.JANE_ACCOUNTS}>Jane (Accounting)</Link>
      </nav>
    </aside>
  );
}