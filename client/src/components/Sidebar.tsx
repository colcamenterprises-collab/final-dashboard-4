import { useLocation } from "wouter";
import { useEffect, useRef, useState, Fragment } from "react";

/* Minimal mono icons (same weight) */
const Icon = {
  grid:  <svg viewBox="0 0 24 24" className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M4 4h7v7H4zM13 4h7v7h-7zM4 13h7v7H4zM13 13h7v7h-7z"/></svg>,
  form:  <svg viewBox="0 0 24 24" className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M6 4h12v16H6z"/><path d="M8 8h8M8 12h8M8 16h6"/></svg>,
  stock: <svg viewBox="0 0 24 24" className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M3 7l9-4 9 4-9 4-9-4z"/><path d="M3 7v10l9 4 9-4V7"/></svg>,
  file:  <svg viewBox="0 0 24 24" className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M14 3H6a2 2 0 0 0-2 2v14l4-2 4 2 4-2 4 2V9z"/><path d="M14 3v6h6"/></svg>,
  chart: <svg viewBox="0 0 24 24" className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M3 3v18h18"/><path d="M7 15v3M12 10v8M17 6v12"/></svg>,
  money: <svg viewBox="0 0 24 24" className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="1.8"><circle cx="12" cy="12" r="8"/><path d="M9 9h3a3 3 0 110 6H9m3-6V7m0 10v-2"/></svg>,
  list:  <svg viewBox="0 0 24 24" className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M8 6h12M8 12h12M8 18h12"/><path d="M4 6h.01M4 12h.01M4 18h.01"/></svg>,
  meg:   <svg viewBox="0 0 24 24" className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M3 11l14-5v12L3 13z"/><path d="M17 6v12"/><path d="M6 14v5a2 2 0 0 0 2 2h2"/></svg>,
  star:  <svg viewBox="0 0 24 24" className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M12 17.3l6.18 3.7-1.64-7.03L22 9.24l-7.19-.61L12 2 9.19 8.63 2 9.24l5.46 4.73L5.82 21z"/></svg>,
  calc:  <svg viewBox="0 0 24 24" className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="1.8"><rect x="5" y="3" width="14" height="18" rx="2"/><path d="M8 7h8M8 11h3M8 15h3M13 15h3"/></svg>,
};

/* Groups + items */
const NAV = [
  {
    title: "Dashboard",
    items: [{ label: "Overview", path: "/dashboard", icon: Icon.grid }],
  },
  {
    title: "Operations",
    items: [
      { label: "Daily Sales & Stock", path: "/operations/daily", icon: Icon.form },
      { label: "Expenses",     path: "/expenses", icon: Icon.money },
      { label: "Upload Statements",   path: "/expense-upload",    icon: Icon.file },
      { label: "Receipts",     path: "/receipts", icon: Icon.file },
      { label: "Analysis",     path: "/operations/analysis", icon: Icon.chart },
      { label: "Delivery Partners", path: "/operations/delivery", icon: Icon.list },
      { label: "Shift Reports",     path: "/operations/reports",  icon: Icon.file },
    ],
  },
  {
    title: "Finance",
    items: [
      { label: "Profit & Loss",       path: "/finance/pnl",       icon: Icon.money },
      { label: "Analysis",            path: "/finance/analysis",  icon: Icon.chart },
      { label: "Forecast & Budget",   path: "/finance/forecast",  icon: Icon.list },
      { label: "Supplier Payments",   path: "/finance/suppliers", icon: Icon.list },
      { label: "Cash Flow",           path: "/finance/cashflow",  icon: Icon.money },
      { label: "Tax & Compliance",    path: "/finance/tax",       icon: Icon.file },
    ],
  },
  {
    title: "Menu Mgmt",
    items: [
      { label: "Cost Calculator",  path: "/menu/cost-calculator", icon: Icon.calc },
      { label: "Ingredient Mgmt",  path: "/ingredients",     icon: Icon.list },
      { label: "Recipe Cards",     path: "/recipes",         icon: Icon.file },
      { label: "Menu Performance", path: "/menu/performance",     icon: Icon.chart },
      { label: "Seasonal Planner", path: "/menu/seasonal",        icon: Icon.list },
    ],
  },
  {
    title: "Marketing",
    items: [
      { label: "Add Reviews",        path: "/marketing/reviews",    icon: Icon.star },
      { label: "Social Posting",     path: "/marketing/social",     icon: Icon.meg },
      { label: "Campaign Analytics", path: "/marketing/analytics",  icon: Icon.chart },
      { label: "Loyalty & Rewards",  path: "/marketing/loyalty",    icon: Icon.star },
      { label: "Email/SMS Automation", path: "/marketing/automation", icon: Icon.list },
      { label: "Promotions Manager", path: "/marketing/promotions", icon: Icon.meg },
    ],
  },
];

export default function Sidebar(){
  const [location, navigate] = useLocation();
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [collapsed, setCollapsed] = useState(false);
  const railRef = useRef<HTMLDivElement>(null);

  useEffect(()=>{ // defaults: first two open
    setExpanded({ Dashboard: true, Operations: true });
  },[]);

  // Expand on hover when rail-only
  useEffect(()=>{
    const el = railRef.current;
    if (!el || !collapsed) return;
    let t: any;
    const onEnter = ()=>{ t=setTimeout(()=>setCollapsed(false), 60); };
    const onLeave = ()=>{ clearTimeout(t); setCollapsed(true); };
    el.addEventListener("mouseenter", onEnter);
    el.addEventListener("mouseleave", onLeave);
    return ()=>{ el.removeEventListener("mouseenter", onEnter); el.removeEventListener("mouseleave", onLeave); };
  },[collapsed]);

  return (
    <aside
      ref={railRef}
      className={`sb sticky top-0 h-screen shrink-0 ${collapsed ? "sb-rail" : "w-64"} transition-[width] duration-300 ease-in-out`}
    >
      {/* Top bar: logo + collapse toggle */}
      <div className="flex items-center justify-between px-4 py-4">
        <div className={`${collapsed ? "sr-only" : ""} flex items-center gap-2`}>
          {/* Logo slot */}
          <div className="w-7 h-7 rounded-md bg-[var(--brand)] text-white grid place-items-center font-bold">S</div>
          <div className="font-semibold tracking-tight text-[15px] text-[var(--heading)]">Smash Brothers</div>
        </div>
        <button
          aria-label="Toggle"
          onClick={()=>setCollapsed(v=>!v)}
          className="rounded-lg border border-gray-200 px-2 py-1 text-xs hover:bg-gray-50"
        >
          {collapsed ? "›" : "‹"}
        </button>
      </div>

      {/* Nav */}
      <nav className="px-3 pb-6 overflow-y-auto">
        {NAV.map(group=>(
          <Fragment key={group.title}>
            <button
              onClick={()=>setExpanded(s=>({ ...s, [group.title]: !s[group.title] }))}
              className={`w-full flex items-center justify-between px-2 py-2 ${collapsed ? "pointer-events-none" : ""}`}
            >
              <span className={`sb-group ${collapsed ? "sr-only" : ""}`}>{group.title}</span>
              {!collapsed && <span className={`text-gray-400 text-xs ${expanded[group.title] ? "" : "rotate-180"}`}>▾</span>}
            </button>

            {(expanded[group.title] || collapsed) && (
              <ul className="space-y-2">
                {group.items.map(item=>{
                  const active = location === item.path || location.startsWith(item.path + "/");
                  return (
                    <li key={item.path}>
                      <button
                        onClick={()=>navigate(item.path)}
                        title={collapsed ? item.label : undefined}
                        className={`sb-item w-full flex items-center ${collapsed ? "justify-center px-0" : "px-3"} ${active ? "sb-active" : "hover:bg-gray-50"}`}
                      >
                        <span className={`text-current ${collapsed ? "" : "mr-3"}`}>{item.icon}</span>
                        {collapsed ? null : <span className="text-sm">{item.label}</span>}
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </Fragment>
        ))}
      </nav>
    </aside>
  );
}