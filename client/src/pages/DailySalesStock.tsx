import React, { useState } from 'react';
import DailyShiftForm from './DailyShiftForm';
import DraftFormsLibrary from './DraftFormsLibrary';
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Link } from "wouter";
import { ShoppingCart, Package, DollarSign, BarChart3 } from "lucide-react";

const DailySalesStock = () => {
  return (
    <div className="container mx-auto p-4 max-w-7xl">
      <div className="mb-6">
        <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 mb-2">Operations & Sales</h1>
        <p className="text-gray-600 text-sm sm:text-base">Manage daily operations, purchasing, expenses, and reporting</p>
        
        {/* Navigation to other Operations sections */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mt-4">
          <Link href="/purchasing">
            <Button variant="outline" className="w-full h-auto p-4 flex flex-col items-center space-y-2 bg-blue-600 text-white hover:bg-blue-700 border-blue-600">
              <ShoppingCart className="h-5 w-5" />
              <span className="text-sm font-medium">Purchasing</span>
            </Button>
          </Link>
          <Link href="/expenses">
            <Button variant="outline" className="w-full h-auto p-4 flex flex-col items-center space-y-2 bg-blue-600 text-white hover:bg-blue-700 border-blue-600">
              <DollarSign className="h-5 w-5" />
              <span className="text-sm font-medium">Expenses</span>
            </Button>
          </Link>
          <Link href="/reports-analysis">
            <Button variant="outline" className="w-full h-auto p-4 flex flex-col items-center space-y-2 bg-blue-600 text-white hover:bg-blue-700 border-blue-600">
              <BarChart3 className="h-5 w-5" />
              <span className="text-sm font-medium">Reports & Analysis</span>
            </Button>
          </Link>
          <Button variant="outline" className="w-full h-auto p-4 flex flex-col items-center space-y-2 bg-gray-200 text-gray-800 border-gray-300 cursor-default">
            <Package className="h-5 w-5" />
            <span className="text-sm font-medium">Daily Sales & Stock</span>
            <span className="text-xs text-gray-600">(Current)</span>
          </Button>
        </div>
      </div>

      <div className="mb-6">
        <h2 className="text-xl font-semibold text-gray-900 mb-2">Daily Sales & Stock</h2>
        <p className="text-gray-600 text-sm sm:text-base">Complete your daily shift reporting and manage form drafts</p>
      </div>

      <Tabs defaultValue="form" className="w-full">
        <TabsList className="grid w-full grid-cols-2 mb-6">
          <TabsTrigger value="form" className="text-sm sm:text-base">Submit Form</TabsTrigger>
          <TabsTrigger value="drafts" className="text-sm sm:text-base">Drafts & Library</TabsTrigger>
        </TabsList>
        
        <TabsContent value="form" className="space-y-4">
          <DailyShiftForm />
        </TabsContent>
        
        <TabsContent value="drafts" className="space-y-4">
          <DraftFormsLibrary />
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default DailySalesStock;