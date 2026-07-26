import fs from "node:fs";

const sidebarPath = "client/src/components/navigation/ModernSidebar.tsx";

if (!fs.existsSync(sidebarPath)) {
  throw new Error(`Missing required file: ${sidebarPath}`);
}

let sidebar = fs.readFileSync(sidebarPath, "utf8");

// All sidebar groups must start closed.
sidebar = sidebar.replaceAll("defaultOpen: true", "defaultOpen: false");

// Do not automatically reopen the group for the current route on initial load/navigation.
const autoOpenEffect = `  useEffect(() => {
    const path = location.pathname;
    for (const group of navigationGroups) {
      const hasActiveItem = group.items.some(
        (item) => path === item.to || path.startsWith(item.to + "/")
      );
      if (hasActiveItem) {
        setOpenGroups(prev => {
          if (prev.has(group.title)) return prev;
          const next = new Set(prev);
          next.add(group.title);
          return next;
        });
        break;
      }
    }
  }, [location.pathname]);

`;
sidebar = sidebar.replace(autoOpenEffect, "");

// Ensure the initial state is explicitly empty, even if an old defaultOpen flag remains.
sidebar = sidebar.replace(
  `  const [openGroups, setOpenGroups] = useState<Set<string>>(
    new Set(navigationGroups.filter(g => g.defaultOpen).map(g => g.title))
  );`,
  `  const [openGroups, setOpenGroups] = useState<Set<string>>(new Set());`,
);

// Move Finance directly below Reporting while preserving the Finance block exactly.
const financePattern = /\n  \{\n    title: "Finance",[\s\S]*?\n  \},/;
const financeMatch = sidebar.match(financePattern);
if (!financeMatch) {
  throw new Error("Could not find Finance navigation block.");
}
const financeBlock = financeMatch[0];
sidebar = sidebar.replace(financeBlock, "");

const reportingPattern = /(\n  \{\n    title: "Reporting",[\s\S]*?\n  \},)/;
if (!reportingPattern.test(sidebar)) {
  throw new Error("Could not find Reporting navigation block.");
}
sidebar = sidebar.replace(reportingPattern, `$1${financeBlock}`);

fs.writeFileSync(sidebarPath, sidebar);
console.log("Sidebar updated: Finance now follows Reporting and all groups start collapsed.");
