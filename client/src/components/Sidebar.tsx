import { Link, useLocation } from "wouter";
import { ChevronDown, ChevronUp } from "lucide-react";
import { useState } from "react";

const sections = [
  {
    title: "Home",
    items: [{ label: "Home", to: "/dashboard" }]
  },
  {
    title: "Operations",
    items: [
      { label: "Daily Sales & Stock", to: "/daily-stock-sales" },
      { label: "Daily Sales Library", to: "/daily-sales-library" },
      { label: "Manager's Nightly Checklist", to: "/managers/nightly-checklist" },
      { label: "Expenses", to: "/expenses" },
      { label: "Upload Statements", to: "/uploads" },
      { label: "Receipts", to: "/receipts" },
      { label: "Shift Summary", to: "/shift-summary" }
    ]
  },
  {
    title: "Finance",
    items: [
      { label: "Profit & Loss", to: "/pl" },
      { label: "Analysis", to: "/finance/analysis" }
    ]
  },
  {
    title: "Menu Mgmt",
    items: [
      { label: "Cost Calculator", to: "/menu/cost-calculator" },
      { label: "Ingredient Mgmt", to: "/menu/ingredients" },
      { label: "Recipe Cards", to: "/menu/recipes" }
    ]
  },
  {
    title: "Marketing",
    items: [
      { label: "Social Media AI", to: "/marketing" }
    ]
  }
];

export default function Sidebar() {
  const [location] = useLocation();
  const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set(sections.map(s => s.title)));

  const toggleSection = (sectionTitle: string) => {
    const newExpanded = new Set(expandedSections);
    if (newExpanded.has(sectionTitle)) {
      newExpanded.delete(sectionTitle);
    } else {
      newExpanded.add(sectionTitle);
    }
    setExpandedSections(newExpanded);
  };

  return (
    <aside
      className="
        w-64 shrink-0 bg-white border-r border-slate-200
        pt-6 md:pt-8
      "
    >
      {/* Logo row — lowered to align with page header */}
      <div className="px-4 pb-5">
        <div className="flex items-center gap-3">
          <div className="h-9 w-9 rounded-md bg-emerald-600 flex items-center justify-center text-white font-bold">
            S
          </div>
          <div className="text-lg font-semibold tracking-tight">Smash Brothers</div>
        </div>
      </div>

      {/* Navigation */}
      <nav className="px-3 pb-6 overflow-y-auto">
        {sections.map((section) => {
          const isExpanded = expandedSections.has(section.title);
          return (
            <div key={section.title} className="mb-5">
              <button
                onClick={() => toggleSection(section.title)}
                className="w-full flex items-center justify-between px-2 py-1.5 text-sm font-bold text-slate-900 hover:text-slate-700 transition-colors"
              >
                <span>{section.title}</span>
                {isExpanded ? (
                  <ChevronUp className="h-4 w-4" />
                ) : (
                  <ChevronDown className="h-4 w-4" />
                )}
              </button>

              {isExpanded && (
                <ul className="mt-2 space-y-1">
                  {section.items.map((item) => {
                    const isActive = location === item.to;
                    return (
                      <li key={item.to}>
                        <Link
                          href={item.to}
                          className={`
                            flex items-center gap-2 rounded-lg px-2.5 py-2
                            text-[15px] text-slate-900 transition-colors
                            ${
                              isActive
                                ? "bg-emerald-50 ring-1 ring-emerald-200"
                                : "hover:bg-slate-50"
                            }
                          `}
                        >
                          <span className="truncate">{item.label}</span>
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          );
        })}
      </nav>
    </aside>
  );
}