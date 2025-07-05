import { useState, createContext, useContext } from "react";
import { Link, useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Bell, Search, Menu, X, DollarSign, Home, ClipboardList, ShoppingCart, Calculator, Receipt, BarChart3, ChefHat, Activity, TrendingUp } from "lucide-react";
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

const navigationItems = [
  { path: "/", label: "Dashboard", icon: Home },
  { path: "/daily-stock-sales", label: "Daily Stock & Sales", icon: ClipboardList },
  { path: "/shopping-list", label: "Shopping List", icon: ShoppingCart },
  { path: "/recipe-management", label: "Recipe Management", icon: ChefHat },
  { path: "/finance", label: "Finance", icon: Calculator },
  { path: "/expenses", label: "Expenses", icon: Receipt },
  { path: "/pos-loyverse", label: "POS Loyverse", icon: BarChart3 },
  { path: "/loyverse-live", label: "Loyverse Live", icon: Activity },
  { path: "/analysis", label: "Analysis", icon: TrendingUp },
];

export default function Layout({ children }: LayoutProps) {
  const [location] = useLocation();
  const [searchQuery, setSearchQuery] = useState("");
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [currency, setCurrency] = useState("THB");

  const formatCurrency = (amount: number) => {
    if (currency === "THB") {
      return `฿${amount.toFixed(2)}`;
    } else {
      return `$${amount.toFixed(2)}`;
    }
  };

  return (
    <CurrencyContext.Provider value={{ currency, setCurrency, formatCurrency }}>
      <div className="min-h-screen bg-white font-inter flex">
        {/* Black Sidebar */}
        <div className="w-16 bg-black flex flex-col items-center py-4 space-y-4 fixed left-0 top-0 h-full z-50">
          {/* Logo */}
          <div className="mb-6">
            <img 
              src={gradientLogo} 
              alt="Restaurant Hub Logo" 
              className="h-8 w-8 object-contain"
            />
          </div>
          
          {/* Navigation Icons */}
          <div className="flex flex-col space-y-6">
            {navigationItems.map((item) => {
              const IconComponent = item.icon;
              const isActive = location === item.path;
              
              return (
                <Link key={item.path} href={item.path}>
                  <Button
                    variant="ghost"
                    size="sm"
                    className={`p-2 h-10 w-10 rounded-lg transition-colors ${
                      isActive 
                        ? "bg-white/20 text-white" 
                        : "text-white/70 hover:text-white hover:bg-white/10"
                    }`}
                    title={item.label}
                  >
                    <IconComponent className="h-5 w-5" />
                  </Button>
                </Link>
              );
            })}
          </div>
        </div>

        {/* Main Content Area */}
        <div className="flex-1 ml-16">
          {/* Top Navigation Header */}
          <nav className="restaurant-nav px-4 sm:px-6 py-4 border-b border-gray-200">
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
              <div className="lg:hidden mt-4 pb-4 border-t border-gray-200">
                <div className="flex flex-col space-y-2 pt-4">
                  {navigationItems.map((item) => {
                    const IconComponent = item.icon;
                    return (
                      <Link key={item.path} href={item.path}>
                        <Button
                          variant={location === item.path ? "default" : "ghost"}
                          className={`w-full justify-start px-4 py-3 rounded-lg font-medium transition-colors ${
                            location === item.path 
                              ? "restaurant-primary" 
                              : "text-gray-700 hover:text-gray-900"
                          }`}
                          onClick={() => setMobileMenuOpen(false)}
                        >
                          <IconComponent className="h-4 w-4 mr-3" />
                          {item.label}
                        </Button>
                      </Link>
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
          <main className="max-w-7xl mx-auto px-4 sm:px-6 py-4 sm:py-8">
            {children}
          </main>
        </div>
      </div>
    </CurrencyContext.Provider>
  );
}