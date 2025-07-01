import { useState, createContext, useContext } from "react";
import { Link, useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Bell, Search, Menu, X, DollarSign } from "lucide-react";

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
  { path: "/", label: "Dashboard" },
  { path: "/daily-stock-sales", label: "Daily Stock & Sales" },
  { path: "/shopping-list", label: "Shopping List" },
  { path: "/finance", label: "Finance" },
  { path: "/expenses", label: "Expenses" },
  { path: "/pos-loyverse", label: "POS Loyverse" },
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
      <div className="min-h-screen bg-white font-inter">
        {/* Navigation Header */}
        <nav className="restaurant-nav px-4 sm:px-6 py-4">
          <div className="flex items-center justify-between max-w-7xl mx-auto">
            <div className="flex items-center space-x-4 sm:space-x-8">
              {/* Logo */}
              <div className="flex items-center">
                <img 
                  src="@assets/Restaurant Hub Customli_1751389710505.png" 
                  alt="Restaurant Hub Customli Logo" 
                  className="h-[35px] w-auto object-contain"
                />
              </div>
            
            {/* Desktop Navigation Items */}
            <div className="hidden lg:flex space-x-4 xl:space-x-6">
              {navigationItems.map((item) => (
                <Link key={item.path} href={item.path}>
                  <Button
                    variant={location === item.path ? "default" : "ghost"}
                    className={`px-3 xl:px-6 py-2 rounded-lg font-medium transition-colors text-sm xl:text-base ${
                      location === item.path 
                        ? "restaurant-primary" 
                        : "text-gray-700 hover:text-gray-900"
                    }`}
                  >
                    {item.label}
                  </Button>
                </Link>
              ))}
            </div>
          </div>
          
          <div className="flex items-center space-x-2 sm:space-x-4">
            {/* Search - Hidden on mobile, shown on tablet+ */}
            <div className="relative hidden md:block">
              <Input
                type="text"
                placeholder="Search..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10 pr-4 py-2 w-48 lg:w-64 focus:ring-2 focus:ring-primary focus:border-transparent"
              />
              <Search className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
            </div>
            
            {/* Mobile Search Button */}
            <Button variant="ghost" size="icon" className="md:hidden">
              <Search className="h-5 w-5 text-gray-400" />
            </Button>
            
            {/* Currency Selector */}
            <div className="flex items-center space-x-2">
              <DollarSign className="h-4 w-4 text-gray-400 hidden sm:block" />
              <Select value={currency} onValueChange={setCurrency}>
                <SelectTrigger className="w-20 h-8 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="THB">THB</SelectItem>
                  <SelectItem value="USD">USD</SelectItem>
                </SelectContent>
              </Select>
            </div>
            
            {/* Notifications */}
            <Button variant="ghost" size="icon" className="relative">
              <Bell className="h-4 w-4 sm:h-5 sm:w-5 text-gray-400" />
              <Badge 
                variant="default" 
                className="absolute -top-1 -right-1 restaurant-primary text-xs h-4 w-4 sm:h-5 sm:w-5 flex items-center justify-center p-0"
              >
                5
              </Badge>
            </Button>
            
            {/* Profile */}
            <Avatar className="w-6 h-6 sm:w-8 sm:h-8 restaurant-primary">
              <AvatarFallback className="bg-primary text-primary-foreground font-semibold text-xs sm:text-sm">
                M
              </AvatarFallback>
            </Avatar>

            {/* Mobile Menu Button */}
            <Button 
              variant="ghost" 
              size="icon" 
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
        </div>

        {/* Mobile Navigation Menu */}
        {mobileMenuOpen && (
          <div className="lg:hidden mt-4 pb-4 border-t border-gray-200">
            <div className="flex flex-col space-y-2 pt-4">
              {navigationItems.map((item) => (
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
                    {item.label}
                  </Button>
                </Link>
              ))}
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
    </CurrencyContext.Provider>
  );
}
