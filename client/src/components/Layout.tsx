import { useState, createContext, useContext } from "react";
import { Link, useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { 
  Bell, Search, Menu, X, DollarSign, Home, ClipboardList, ShoppingCart, Calculator, Receipt, BarChart3, ChefHat, Activity, TrendingUp, Package, Megaphone, PieChart, FileText,
  ChevronDown, ChevronRight, MessageCircle, Sun, Moon, UserPlus, Settings, LogOut, FolderOpen, LineChart, DollarSign as Finance, Utensils
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

// Consolidated navigation structure matching Dribbble design
const navigationStructure = [
  {
    id: "operations",
    label: "Operations & Sales",
    icon: FolderOpen,
    expandable: true,
    items: [
      { path: "/daily-stock-sales", label: "Daily Sales & Stock Form", icon: ClipboardList },
      { path: "/shopping-list", label: "Shopping List", icon: ShoppingCart },
      { path: "/past-forms", label: "Critical Stock", icon: Package },
      { path: "/pos-loyverse", label: "Daily Receipts", icon: Receipt },
      { path: "/analysis", label: "AI Analysis", icon: TrendingUp },
      { path: "/shift-analytics", label: "Items Sold Breakdown", icon: PieChart },
      { path: "/loyverse-live", label: "Stock vs Purchased", icon: Activity },
    ]
  },
  {
    id: "finance",
    label: "Finance",
    icon: Finance,
    expandable: true,
    items: [
      { path: "/expenses", label: "Expenses", icon: Receipt },
      { path: "/finance", label: "P&L", icon: LineChart },
      { path: "/placeholder/financial-analysis", label: "Financial Analysis (AI)", icon: BarChart3 },
      { path: "/placeholder/ratios", label: "Ratio Calculations", icon: Calculator },
      { path: "/placeholder/bank-statements", label: "Bank Statement Upload", icon: FileText },
    ]
  },
  {
    id: "menu",
    label: "Menu Management",
    icon: Utensils,
    expandable: true,
    items: [
      { path: "/recipe-management", label: "Recipes", icon: ChefHat },
      { path: "/recipe-management?tab=ingredients", label: "Ingredients List", icon: Package },
      { path: "/placeholder/pricing", label: "Pricing Database", icon: DollarSign },
      { path: "/placeholder/food-costs", label: "Food Cost Calculations", icon: Calculator },
      { path: "/placeholder/ai-descriptions", label: "Food Description Generator (AI)", icon: TrendingUp },
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
    path: "/placeholder/settings"
  }
];

export default function Layout({ children }: LayoutProps) {
  const [location] = useLocation();
  const [searchQuery, setSearchQuery] = useState("");
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [currency, setCurrency] = useState("THB");
  const [expandedSections, setExpandedSections] = useState({
    operations: true,
    finance: true,
    menu: true
  });
  const [darkMode, setDarkMode] = useState(false);

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
    setDarkMode(!darkMode);
    document.documentElement.classList.toggle('dark');
    localStorage.setItem('darkMode', (!darkMode).toString());
  };

  return (
    <CurrencyContext.Provider value={{ currency, setCurrency, formatCurrency }}>
      <div className={`min-h-screen font-inter flex ${darkMode ? 'dark' : ''}`}>
        {/* Redesigned Sidebar - Dribbble Style */}
        <div className="w-64 bg-gray-100 dark:bg-gray-900 flex flex-col py-4 px-3 fixed left-0 top-0 h-full z-50 border-r border-gray-200 dark:border-gray-700">
          {/* Logo */}
          <div className="flex items-center gap-3 mb-8 px-2">
            <img 
              src={gradientLogo} 
              alt="Restaurant Hub Logo" 
              className="h-8 w-8 object-contain"
            />
            <span className="font-semibold text-gray-900 dark:text-white">Restaurant Hub</span>
          </div>
          
          {/* Dashboard Link */}
          <Link href="/">
            <Button
              variant="ghost"
              className={`w-full justify-start mb-2 ${
                location === "/" 
                  ? "bg-gray-200 dark:bg-gray-800 text-gray-900 dark:text-white" 
                  : "text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-800"
              }`}
            >
              <Home className="h-4 w-4 mr-3" />
              Dashboard
            </Button>
          </Link>
          
          {/* Navigation Sections */}
          <div className="space-y-1">
            {navigationStructure.map((section) => {
              const SectionIcon = section.icon;
              
              if (!section.expandable) {
                // Simple menu item
                return (
                  <Link key={section.id} href={section.path!}>
                    <Button
                      variant="ghost"
                      className={`w-full justify-start ${
                        location === section.path
                          ? "bg-gray-200 dark:bg-gray-800 text-gray-900 dark:text-white"
                          : "text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-800"
                      }`}
                    >
                      <SectionIcon className="h-4 w-4 mr-3" />
                      {section.label}
                    </Button>
                  </Link>
                );
              }
              
              // Expandable section
              return (
                <div key={section.id}>
                  <Button
                    variant="ghost"
                    className="w-full justify-between text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-800"
                    onClick={() => toggleSection(section.id)}
                  >
                    <div className="flex items-center">
                      <SectionIcon className="h-4 w-4 mr-3" />
                      {section.label}
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
                        const isPlaceholder = item.path.startsWith('/placeholder');
                        
                        return (
                          <Link key={item.path} href={item.path}>
                            <Button
                              variant="ghost"
                              size="sm"
                              className={`w-full justify-start text-sm ${
                                location === item.path
                                  ? "bg-gray-200 dark:bg-gray-800 text-gray-900 dark:text-white"
                                  : "text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-800"
                              } ${isPlaceholder ? 'opacity-60' : ''}`}
                            >
                              <ItemIcon className="h-3 w-3 mr-2" />
                              {item.label}
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
          <div className="mt-auto space-y-2">
            <Button variant="ghost" className="w-full justify-start text-gray-700 dark:text-gray-300">
              <MessageCircle className="h-4 w-4 mr-3" />
              Chat Support
            </Button>
            
            <div className="flex items-center justify-between px-3 py-2">
              <div className="flex items-center gap-2">
                <Sun className="h-4 w-4 text-gray-600 dark:text-gray-400" />
                <Switch 
                  checked={darkMode}
                  onCheckedChange={toggleDarkMode}
                  className="data-[state=checked]:bg-gray-700"
                />
                <Moon className="h-4 w-4 text-gray-600 dark:text-gray-400" />
              </div>
            </div>
            
            <Button variant="ghost" className="w-full justify-start text-gray-700 dark:text-gray-300">
              <UserPlus className="h-4 w-4 mr-3" />
              Employees
            </Button>
          </div>
        </div>

        {/* Main Content Area */}
        <div className="flex-1 ml-64 bg-white dark:bg-gray-950">
          {/* Top Navigation Header */}
          <nav className="restaurant-nav px-4 sm:px-6 py-4 border-b border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-950">
            <div className="flex items-center justify-between max-w-7xl mx-auto">
              <div className="flex items-center space-x-4 sm:space-x-8">
                {/* Mobile menu button */}
                <Button
                  variant="ghost"
                  size="sm"
                  className="lg:hidden"
                  onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                >
                  {mobileMenuOpen ? (
                    <X className="h-5 w-5 text-gray-700" />
                  ) : (
                    <Menu className="h-5 w-5 text-gray-700" />
                  )}
                </Button>
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
                    
                    if (!section.expandable) {
                      return (
                        <Link key={section.id} href={section.path!}>
                          <Button
                            variant={location === section.path ? "default" : "ghost"}
                            className="w-full justify-start px-4 py-3 rounded-lg font-medium transition-colors"
                            onClick={() => setMobileMenuOpen(false)}
                          >
                            <SectionIcon className="h-4 w-4 mr-3" />
                            {section.label}
                          </Button>
                        </Link>
                      );
                    }
                    
                    return (
                      <div key={section.id} className="space-y-1">
                        <Button
                          variant="ghost"
                          className="w-full justify-start px-4 py-3 rounded-lg font-medium"
                          onClick={() => toggleSection(section.id)}
                        >
                          <SectionIcon className="h-4 w-4 mr-3" />
                          {section.label}
                        </Button>
                        
                        {expandedSections[section.id] && section.items && (
                          <div className="ml-6 space-y-1">
                            {section.items.map((item) => {
                              const ItemIcon = item.icon;
                              return (
                                <Link key={item.path} href={item.path}>
                                  <Button
                                    variant={location === item.path ? "default" : "ghost"}
                                    className="w-full justify-start px-4 py-2 rounded-lg text-sm"
                                    onClick={() => setMobileMenuOpen(false)}
                                  >
                                    <ItemIcon className="h-3 w-3 mr-2" />
                                    {item.label}
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
                
                {/* Mobile Search */}
                <div className="relative mt-4 md:hidden">
                  <Input
                    type="text"
                    placeholder="Search..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-10 pr-4 py-2 w-full focus:ring-2 focus:ring-primary focus:border-transparent"
                  />
                  <Search className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                </div>
              </div>
            )}
          </nav>

          {/* Main Content */}
          <main className="max-w-7xl mx-auto px-4 sm:px-6 py-4 sm:py-8 bg-white dark:bg-gray-950 text-gray-900 dark:text-gray-100">
            {children}
          </main>
        </div>
      </div>
    </CurrencyContext.Provider>
  );
}