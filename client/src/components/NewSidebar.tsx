// src/components/Sidebar.tsx
import { NavLink } from "react-router-dom";
import { ROUTES } from "../router/RouteRegistry";

const linkBase =
  "flex items-center gap-3 px-4 py-2 rounded-xl hover:bg-emerald-600/10";
const linkActive = "bg-emerald-600 text-white hover:bg-emerald-600";

export default function Sidebar() {
  const nav = [
    { label: "Overview", to: ROUTES.OVERVIEW },
    { label: "Daily Sales & Stock", to: ROUTES.DAILY_SALES_STOCK },
    { label: "Daily Sales Library", to: ROUTES.DAILY_SALES_LIBRARY },
  ];

  return (
    <aside className="w-72 border-r bg-white min-h-screen">
      <div className="px-5 py-4 border-b">
        <div className="font-extrabold text-lg">Smash Brothers</div>
      </div>
      <nav className="p-4 space-y-1">
        {nav.map((n) => (
          <NavLink
            key={n.to}
            to={n.to}
            end={n.to === ROUTES.OVERVIEW}
            className={({ isActive }) =>
              `${linkBase} ${isActive ? linkActive : "text-neutral-800"}`
            }
          >
            <span>{n.label}</span>
          </NavLink>
        ))}
      </nav>
    </aside>
  );
}