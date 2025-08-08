import { useState, createContext, useContext, useEffect } from "react";
import { Link, useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { 
  Bell, Search, Menu, X, DollarSign, Home, ClipboardList, ShoppingCart, Calculator, Receipt, BarChart3, ChefHat, Activity, TrendingUp, Package, Megaphone, PieChart, FileText,
  ChevronDown, ChevronRight, MessageCircle, Sun, Moon, UserPlus, Settings, LogOut, FolderOpen, LineChart, DollarSign as Finance, Utensils, FileSpreadsheet, BarChart, AlertTriangle,
  Clock, GitCompare, Edit
} from "lucide-react";
import gradientLogo from "@assets/Gradient - Dark Blue - Just logo_1751392842484.png";


// Currency Context
const CurrencyContext = createContext<{
  currency: string;
  setCurrency: (currency: string) => void;
  formatCurrency: (amount: number) => string;
}>({
  currency: 'THB',
  setCurrency: () => {},
  formatCurrency: (amount: number) => `฿${amount.toFixed(2)}`
});

export const useCurrency = () => useContext(CurrencyContext);

interface LayoutProps {
  children: React.ReactNode;
}

// Updated consolidated navigation structure as per user requirements
const navigationStructure = [
  {
    id: "operations",
    label: "Sales & Operations",
    icon: ShoppingCart,
    expandable: true,
    items: [
      { path: "/daily-sales", label: "Daily Sales Form", icon: ClipboardList },
      { path: "/daily-stock", label: "Daily Stock Form", icon: Package },
      { path: "/form-library", label: "Form Library", icon: FileText },
    ]
  },
  {
    id: "finance",
    label: "Finance",
    icon: DollarSign,
    path: "/finance"
  },
  {
    id: "menu-mgmt",
    label: "Menu Mgmt",
    icon: Utensils,
    expandable: true,
    path: "/recipes", // Main page for collapsed state
    items: [
      { path: "/recipes", label: "Recipes", icon: ChefHat },
      { path: "/ingredients", label: "Ingredients", icon: Package },
      { path: "/ingredients-table", label: "Edit Ingredients", icon: Edit },
    ]
  },
  {
    id: "marketing",
    label: "Marketing",
    icon: Megaphone,
    path: "/marketing"
  },
  {
    id: "settings",
    label: "Settings",
    icon: Settings,
    expandable: true,
    path: "/placeholder/business-info", // Main page for collapsed state
    items: [
      { path: "/placeholder/business-info", label: "Business Info", icon: FileText },
      { path: "/placeholder/logo", label: "Logo", icon: Settings },
      { path: "/placeholder/api-keys", label: "API Keys", icon: Settings },
      { path: "/placeholder/theme", label: "Theme", icon: Settings },
      { path: "/placeholder/employees", label: "Employee", icon: UserPlus },
    ]
  }
];

export default function Layout({ children }: LayoutProps) {
  const [location] = useLocation();
  const [searchQuery, setSearchQuery] = useState("");
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [currency, setCurrency] = useState("THB");
  const [isExpanded, setIsExpanded] = useState(true); // Expanded by default - full sidebar
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({
    operations: false,
    finance: false,
    "menu-mgmt": false,
    "daily-sales-form": false,
    reporting: false,
    analysis: false,
    purchasing: false,
    settings: false
  });

  // Close mobile menu on route change
  useEffect(() => {
    setMobileMenuOpen(false);
  }, [location]);
  const [darkMode, setDarkMode] = useState(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('darkMode') === 'true';
    }
    return false;
  });

  const formatCurrency = (amount: number) => {
    if (currency === "THB") {
      return `฿${amount.toFixed(2)}`;
    } else {
      return `$${amount.toFixed(2)}`;
    }
  };

  const toggleSection = (sectionId: string) => {
    setExpandedSections(prev => ({
      ...prev,
      [sectionId]: !prev[sectionId]
    }));
  };

  const toggleDarkMode = () => {
    const newDarkMode = !darkMode;
    setDarkMode(newDarkMode);
    document.documentElement.classList.toggle('dark', newDarkMode);
    localStorage.setItem('darkMode', newDarkMode.toString());
  };

  const toggleExpanded = () => {
    setIsExpanded(!isExpanded);
    // Close all sections when minimizing
    if (isExpanded) {
      setExpandedSections({
        operations: false,
        finance: false,
        "menu-mgmt": false,
        "daily-sales-form": false,
        reporting: false,
        analysis: false,
        purchasing: false,
        settings: false
      });
    }
  };

  // Initialize dark mode on load
  useState(() => {
    if (darkMode) {
      document.documentElement.classList.add('dark');
    }
  });

  return (
    <CurrencyContext.Provider value={{ currency, setCurrency, formatCurrency }}>
      <div className={`min-h-screen font-poppins flex ${darkMode ? 'dark' : ''}`}>
        {/* Mobile Drawer - Hidden on desktop */}
        <aside className={`fixed inset-y-0 left-0 z-40 w-64 sidebar-menu transform transition-transform duration-200 md:hidden
          ${mobileMenuOpen ? 'translate-x-0' : '-translate-x-full'}`}>
          <div className="p-4 border-b border-gray-700 flex items-center justify-between">
            <div className="font-semibold text-white">Menu</div>
            <button 
              className="w-10 h-10 border rounded-lg text-white hover:bg-white/10" 
              onClick={() => setMobileMenuOpen(false)} 
              aria-label="Close menu"
            >
              ×
            </button>
          </div>
          
          {/* Mobile Navigation Content */}
          <div className="flex flex-col py-4 px-2 h-full">
            {/* Logo */}
            <div className="flex items-center gap-3 mb-6 px-1">
              <img 
                src={gradientLogo} 
                alt="Restaurant Hub Logo" 
                className="h-8 w-8 object-contain"
              />
              <span className="font-semibold text-white">Restaurant Hub</span>
            </div>
            
            {/* Dashboard Link */}
            <Link href="/">
              <Button
                variant="ghost"
                className={`w-full mb-2 p-2 justify-start ${
                  location === "/" 
                    ? "bg-white/20 text-white" 
                    : "text-white hover:bg-white/10"
                }`}
              >
                <Home className="h-4 w-4" />
                <span className="ml-3">Dashboard</span>
              </Button>
            </Link>
            
            {/* Navigation Sections */}
            <div className="space-y-1 flex-1 overflow-y-auto">
              {navigationStructure.map((section) => {
                const SectionIcon = section.icon;
                
                if (!section.expandable) {
                  return (
                    <Link key={section.id} href={section.path!}>
                      <Button
                        variant="ghost"
                        className={`w-full p-2 justify-start ${
                          location === section.path
                            ? "bg-white/20 text-white"
                            : "text-white hover:bg-white/10"
                        }`}
                      >
                        <SectionIcon className="h-4 w-4" />
                        <span className="ml-3">{section.label}</span>
                      </Button>
                    </Link>
                  );
                }
                
                const hasActiveChild = section.items?.some(item => location === item.path);
                
                return (
                  <div key={section.id}>
                    <Button
                      variant="ghost"
                      onClick={() => toggleSection(section.id)}
                      className={`w-full p-2 justify-between ${
                        hasActiveChild || expandedSections[section.id]
                          ? "bg-white/20 text-white"
                          : "text-white hover:bg-white/10"
                      }`}
                    >
                      <div className="flex items-center">
                        <SectionIcon className="h-4 w-4" />
                        <span className="ml-3">{section.label}</span>
                      </div>
                      {expandedSections[section.id] ? 
                        <ChevronDown className="h-4 w-4" /> : 
                        <ChevronRight className="h-4 w-4" />
                      }
                    </Button>
                    
                    {expandedSections[section.id] && section.items && (
                      <div className="ml-6 space-y-1 mt-1">
                        {section.items.map((item) => {
                          const ItemIcon = item.icon;
                          const isPlaceholder = item.path?.startsWith('/placeholder');
                          
                          return (
                            <Link key={item.path} href={item.path || '#'}>
                              <Button
                                variant="ghost"
                                size="sm"
                                className={`w-full justify-start text-sm p-2 ${
                                  location === item.path
                                    ? "bg-white/20 text-white"
                                    : "text-white/80 hover:bg-white/10"
                                } ${isPlaceholder ? 'opacity-60' : ''}`}
                              >
                                <ItemIcon className="h-3 w-3" />
                                <span className="ml-2">{item.label}</span>
                                {isPlaceholder && <span className="ml-auto text-xs">Soon</span>}
                              </Button>
                            </Link>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </aside>
        
        {/* Mobile Overlay */}
        {mobileMenuOpen && <div className="fixed inset-0 z-30 bg-black/30 md:hidden" onClick={() => setMobileMenuOpen(false)} />}

        {/* Desktop Sidebar */}
        <div className={`${isExpanded ? 'w-64' : 'w-16'} sidebar-menu hidden md:flex flex-col py-4 px-2 fixed left-0 top-0 h-full z-50 border-r border-gray-700 transition-all duration-300`}>
          {/* Minimize/Expand Toggle */}
          <Button
            variant="ghost"
            onClick={toggleExpanded}
            className="mb-4 p-2 text-white hover:bg-white/10"
            title={isExpanded ? "Minimize Sidebar" : "Expand Sidebar"}
          >
            <ChevronRight className={`h-4 w-4 transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
          </Button>

          {/* Logo */}
          <div className={`flex items-center gap-3 mb-6 px-1 ${!isExpanded && 'justify-center'}`}>
            <img 
              src={gradientLogo} 
              alt="Restaurant Hub Logo" 
              className="h-8 w-8 object-contain"
            />
            {isExpanded && <span className="font-semibold text-white">Restaurant Hub</span>}
          </div>
          
          {/* Dashboard Link */}
          <Link href="/">
            <Button
              variant="ghost"
              className={`w-full mb-2 p-2 ${!isExpanded && 'justify-center'} ${isExpanded && 'justify-start'} ${
                location === "/" 
                  ? "bg-white/20 text-white" 
                  : "text-white hover:bg-white/10"
              }`}
              title="Dashboard"
            >
              <Home className="h-4 w-4" />
              {isExpanded && <span className="ml-3">Dashboard</span>}
            </Button>
          </Link>
          
          {/* Navigation Sections - Scrollable */}
          <div className="space-y-1 flex-1 overflow-y-auto sidebar-scroll">
            {navigationStructure.map((section) => {
              const SectionIcon = section.icon;
              
              if (!section.expandable) {
                // Simple menu item - always clickable
                return (
                  <Link key={section.id} href={section.path!}>
                    <Button
                      variant="ghost"
                      className={`w-full p-2 ${!isExpanded && 'justify-center'} ${isExpanded && 'justify-start'} ${
                        location === section.path
                          ? "bg-white/20 text-white"
                          : "text-white hover:bg-white/10"
                      }`}
                      title={section.label}
                    >
                      <SectionIcon className="h-4 w-4" />
                      {isExpanded && <span className="ml-3">{section.label}</span>}
                    </Button>
                  </Link>
                );
              }
              
              // Expandable section with main item link
              const hasActiveChild = section.items?.some(item => location === item.path);
              const mainItemPath = section.path || section.items?.[0]?.path || '#';
              
              return (
                <div key={section.id}>
                  {!isExpanded ? (
                    // Collapsed state - icon links to first sub-item
                    <Link href={mainItemPath}>
                      <Button
                        variant="ghost"
                        className={`w-full p-2 justify-center ${
                          hasActiveChild || location === mainItemPath
                            ? "bg-white/20 text-white"
                            : "text-white hover:bg-white/10"
                        }`}
                        title={section.label}
                      >
                        <SectionIcon className="h-4 w-4" />
                      </Button>
                    </Link>
                  ) : (
                    // Expanded state - section header with expand/collapse
                    <Button
                      variant="ghost"
                      className={`w-full p-2 justify-between text-white hover:bg-white/10 ${
                        hasActiveChild ? "bg-white/10" : ""
                      }`}
                      onClick={() => toggleSection(section.id)}
                      title={section.label}
                    >
                      <div className="flex items-center">
                        <SectionIcon className="h-4 w-4" />
                        <span className="ml-3">{section.label}</span>
                      </div>
                      {expandedSections[section.id] ? 
                        <ChevronDown className="h-4 w-4" /> : 
                        <ChevronRight className="h-4 w-4" />
                      }
                    </Button>
                  )}
                  
                  {isExpanded && expandedSections[section.id] && section.items && (
                    <div className="ml-6 space-y-1 mt-1">
                      {section.items.map((item) => {
                        const ItemIcon = item.icon;
                        const isPlaceholder = item.path?.startsWith('/placeholder');
                        
                        // Handle nested items - remove this complex logic
                        
                        // Regular menu item
                        return (
                          <Link key={item.path} href={item.path || '#'}>
                            <Button
                              variant="ghost"
                              size="sm"
                              className={`w-full justify-start text-sm p-2 ${
                                location === item.path
                                  ? "bg-white/20 text-white"
                                  : "text-white/80 hover:bg-white/10"
                              } ${isPlaceholder ? 'opacity-60' : ''}`}
                              title={item.label}
                            >
                              <ItemIcon className="h-3 w-3" />
                              <span className="ml-2">{item.label}</span>
                              {isPlaceholder && <span className="ml-auto text-xs">Soon</span>}
                            </Button>
                          </Link>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
          
          {/* Bottom Section - Chat & Controls */}
          <div className="space-y-2 mt-auto">
            <Link href="/placeholder/chat">
              <Button 
                variant="ghost" 
                className={`w-full p-2 text-white hover:bg-white/10 ${!isExpanded && 'justify-center'} ${isExpanded && 'justify-start'}`}
                title="Chat Support"
              >
                <MessageCircle className="h-4 w-4" />
                {isExpanded && <span className="ml-3">Chat Support</span>}
              </Button>
            </Link>
            
            {isExpanded && (
              <div className="flex items-center justify-center px-3 py-2">
                <div className="flex items-center gap-2">
                  <Sun className="h-4 w-4 text-white/60" />
                  <Switch 
                    checked={darkMode}
                    onCheckedChange={toggleDarkMode}
                    className="data-[state=checked]:bg-white/20"
                  />
                  <Moon className="h-4 w-4 text-white/60" />
                </div>
              </div>
            )}
            
            <Link href="/placeholder/employees">
              <Button 
                variant="ghost" 
                className={`w-full p-2 text-white hover:bg-white/10 ${!isExpanded && 'justify-center'} ${isExpanded && 'justify-start'}`}
                title="Employees"
              >
                <UserPlus className="h-4 w-4" />
                {isExpanded && <span className="ml-3">Employees</span>}
              </Button>
            </Link>
          </div>
        </div>

        {/* Main Content Area */}
        <div className="flex-1 md:ml-64 bg-white dark:bg-gray-950 transition-all duration-300">
          {/* Top Navigation Header */}
          <nav className="restaurant-nav px-3 md:px-6 py-4 border-b border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-950">
            <div className="flex items-center justify-between max-w-7xl mx-auto">
              <div className="flex items-center space-x-4 sm:space-x-8">
                {/* Hamburger menu button for mobile */}
                <button
                  className="md:hidden inline-flex items-center justify-center w-10 h-10 rounded-lg border"
                  onClick={() => setMobileMenuOpen(true)}
                  aria-label="Open menu"
                >
                  ☰
                </button>
              </div>

              {/* Right side controls */}
              <div className="flex items-center space-x-3 sm:space-x-4">
                {/* Search Bar - Hidden on mobile */}
                <div className="relative hidden md:block">
                  <Input
                    type="text"
                    placeholder="Search..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-10 pr-4 py-2 w-64 focus:ring-2 focus:ring-primary focus:border-transparent"
                  />
                  <Search className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                </div>

                {/* Currency Selector */}
                <Select value={currency} onValueChange={setCurrency}>
                  <SelectTrigger className="w-20 h-9 text-sm">
                    <SelectValue>
                      <div className="flex items-center">
                        <DollarSign className="h-3 w-3 mr-1" />
                        {currency}
                      </div>
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="THB">
                      <div className="flex items-center">
                        <span className="mr-2">฿</span>
                        THB
                      </div>
                    </SelectItem>
                    <SelectItem value="USD">
                      <div className="flex items-center">
                        <span className="mr-2">$</span>
                        USD
                      </div>
                    </SelectItem>
                  </SelectContent>
                </Select>

                {/* Notifications */}
                <Button variant="ghost" size="sm" className="relative p-2">
                  <Bell className="h-5 w-5 text-gray-600" />
                  <Badge 
                    variant="destructive" 
                    className="absolute -top-1 -right-1 h-5 w-5 rounded-full p-0 flex items-center justify-center text-xs"
                  >
                    3
                  </Badge>
                </Button>

                {/* Profile */}
                <Avatar className="h-8 w-8">
                  <AvatarFallback className="bg-primary text-primary-foreground text-sm">
                    RH
                  </AvatarFallback>
                </Avatar>
              </div>
            </div>

            {/* Mobile Navigation Menu */}
            {mobileMenuOpen && (
              <div className="lg:hidden mt-4 pb-4 border-t border-gray-200 dark:border-gray-700">
                <div className="flex flex-col space-y-2 pt-4">
                  <Link href="/">
                    <Button
                      variant={location === "/" ? "default" : "ghost"}
                      className="w-full justify-start px-4 py-3 rounded-lg font-medium transition-colors"
                      onClick={() => setMobileMenuOpen(false)}
                    >
                      <Home className="h-4 w-4 mr-3" />
                      Dashboard
                    </Button>
                  </Link>
                  
                  {navigationStructure.map((section) => {
                    const SectionIcon = section.icon;
                    const hasActiveChild = section.items?.some((item: any) => 
                      item.path === location
                    );
                    
                    return (
                      <div key={section.id} className="space-y-1">
                        {/* Section Header */}
                        <Button
                          variant="ghost"
                          className={`w-full justify-between px-4 py-3 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 font-medium ${
                            hasActiveChild ? "bg-gray-100 dark:bg-gray-800" : ""
                          }`}
                          onClick={() => toggleSection(section.id)}
                        >
                          <div className="flex items-center">
                            <SectionIcon className="h-4 w-4 mr-3" />
                            <span>{section.label}</span>
                          </div>
                          {expandedSections[section.id] ? 
                            <ChevronDown className="h-4 w-4" /> : 
                            <ChevronRight className="h-4 w-4" />
                          }
                        </Button>
                        
                        {/* Section Items */}
                        {expandedSections[section.id] && section.items && (
                          <div className="ml-6 space-y-1">
                            {section.items.map((item) => {
                              const ItemIcon = item.icon;
                              const isPlaceholder = item.path?.startsWith('/placeholder');
                              
                              // Remove complex nested logic to fix TypeScript errors
                              
                              // Regular menu item
                              return (
                                <Link key={item.path} href={item.path || '#'}>
                                  <Button
                                    variant="ghost"
                                    className={`w-full justify-start px-4 py-2 text-sm ${
                                      location === item.path
                                        ? "bg-primary/10 text-primary"
                                        : "text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800"
                                    } ${isPlaceholder ? 'opacity-60' : ''}`}
                                    onClick={() => setMobileMenuOpen(false)}
                                  >
                                    <ItemIcon className="h-3 w-3 mr-2" />
                                    <span>{item.label}</span>
                                    {isPlaceholder && <span className="ml-auto text-xs">Soon</span>}
                                  </Button>
                                </Link>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    );
                  })}
                  
                  {/* Mobile Menu Management Section */}
                  <div className="space-y-1 pt-4 border-t border-gray-200 dark:border-gray-700">
                    <Button
                      variant="ghost"
                      className="w-full justify-between px-4 py-3 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 font-medium"
                      onClick={() => toggleSection('management')}
                    >
                      <div className="flex items-center">
                        <ChefHat className="h-4 w-4 mr-3" />
                        <span>Menu Management</span>
                      </div>
                      {expandedSections['management'] ? 
                        <ChevronDown className="h-4 w-4" /> : 
                        <ChevronRight className="h-4 w-4" />
                      }
                    </Button>
                    
                    {expandedSections['management'] && (
                      <div className="ml-6 space-y-1">
                        <Link href="/recipe-management">
                          <Button
                            variant="ghost"
                            className={`w-full justify-start px-4 py-2 text-sm ${
                              location === "/recipe-management"
                                ? "bg-primary/10 text-primary"
                                : "text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800"
                            }`}
                            onClick={() => setMobileMenuOpen(false)}
                          >
                            <Utensils className="h-3 w-3 mr-2" />
                            <span>Recipes & Ingredients</span>
                          </Button>
                        </Link>
                        <Link href="/marketing">
                          <Button
                            variant="ghost"
                            className={`w-full justify-start px-4 py-2 text-sm ${
                              location === "/marketing"
                                ? "bg-primary/10 text-primary"
                                : "text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800"
                            }`}
                            onClick={() => setMobileMenuOpen(false)}
                          >
                            <Megaphone className="h-3 w-3 mr-2" />
                            <span>Marketing</span>
                          </Button>
                        </Link>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}
          </nav>

          {/* Main Content */}
          <main className="p-3 md:p-6">
            <div className="mx-auto w-full max-w-6xl">
              {children}
            </div>
          </main>
        </div>
      </div>


    </CurrencyContext.Provider>
  );
}