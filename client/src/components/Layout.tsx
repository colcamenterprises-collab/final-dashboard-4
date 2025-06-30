import { useState } from "react";
import { Link, useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Bell, Search, Utensils, FolderSync } from "lucide-react";

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

  return (
    <div className="min-h-screen bg-white font-inter">
      {/* Navigation Header */}
      <nav className="restaurant-nav px-6 py-4">
        <div className="flex items-center justify-between max-w-7xl mx-auto">
          <div className="flex items-center space-x-8">
            {/* Logo */}
            <div className="flex items-center space-x-2">
              <div className="w-8 h-8 bg-gray-900 rounded-full flex items-center justify-center">
                <Utensils className="text-white text-sm" />
              </div>
            </div>
            
            {/* Navigation Items */}
            <div className="flex space-x-6">
              {navigationItems.map((item) => (
                <Link key={item.path} href={item.path}>
                  <Button
                    variant={location === item.path ? "default" : "ghost"}
                    className={`px-6 py-2 rounded-lg font-medium transition-colors ${
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
          
          <div className="flex items-center space-x-4">
            {/* Search */}
            <div className="relative">
              <Input
                type="text"
                placeholder="Search..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10 pr-4 py-2 w-64 focus:ring-2 focus:ring-primary focus:border-transparent"
              />
              <Search className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
            </div>
            
            {/* Notifications */}
            <Button variant="ghost" size="icon" className="relative">
              <Bell className="h-5 w-5 text-gray-400" />
              <Badge 
                variant="default" 
                className="absolute -top-1 -right-1 restaurant-primary text-xs h-5 w-5 flex items-center justify-center p-0"
              >
                5
              </Badge>
            </Button>
            
            {/* Profile */}
            <Avatar className="w-8 h-8 restaurant-primary">
              <AvatarFallback className="bg-primary text-primary-foreground font-semibold">
                M
              </AvatarFallback>
            </Avatar>
          </div>
        </div>
      </nav>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-6 py-8">
        {children}
      </main>
    </div>
  );
}
