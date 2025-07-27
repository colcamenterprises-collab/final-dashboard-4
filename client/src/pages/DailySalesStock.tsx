import React, { useState } from 'react';
import DailyShiftForm from './DailyShiftFormMobile';
import DraftFormsLibrary from './DraftFormsLibrary';
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Link } from "wouter";
import { ShoppingCart, Package, DollarSign, BarChart3 } from "lucide-react";

const DailySalesStock = () => {
  return (
    <div className="container mx-auto p-3 sm:p-4 lg:p-6 max-w-7xl">
      <div className="mb-4 sm:mb-6">
        <h1 className="text-xl sm:text-2xl lg:text-3xl font-bold text-gray-900 mb-1 sm:mb-2">Operations & Sales</h1>
        <p className="text-gray-600 text-xs sm:text-sm lg:text-base">Manage daily operations, purchasing, expenses, and reporting</p>
        
        {/* Navigation to other Operations sections */}
        <div className="flex flex-wrap gap-2 mt-3 sm:mt-4">
          <Link href="/purchasing">
            <Button variant="outline" className="px-3 py-2">
              <ShoppingCart className="h-4 w-4 mr-2" />
              Purchasing
            </Button>
          </Link>
          <Link href="/expenses">
            <Button variant="outline" className="px-3 py-2">
              <DollarSign className="h-4 w-4 mr-2" />
              Expenses
            </Button>
          </Link>
          <Link href="/reports-analysis">
            <Button variant="outline" className="px-3 py-2">
              <BarChart3 className="h-4 w-4 mr-2" />
              Reports & Analysis
            </Button>
          </Link>
          <Button variant="outline" className="px-3 py-2 bg-gray-200 text-gray-800 border-gray-300 cursor-default">
            <Package className="h-4 w-4 mr-2" />
            Daily Sales & Stock (Current)
          </Button>
        </div>
      </div>

      <div className="mb-4 sm:mb-6">
        <h2 className="text-lg sm:text-xl font-semibold text-gray-900 mb-1 sm:mb-2">Daily Sales & Stock</h2>
        <p className="text-gray-600 text-xs sm:text-sm lg:text-base">Complete your daily shift reporting and manage form drafts</p>
      </div>

      <Tabs defaultValue="form" className="w-full">
        <TabsList className="grid w-full grid-cols-2 mb-4 sm:mb-6">
          <TabsTrigger value="form" className="text-xs sm:text-sm lg:text-base">Submit Form</TabsTrigger>
          <TabsTrigger value="drafts" className="text-xs sm:text-sm lg:text-base">Drafts & Library</TabsTrigger>
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