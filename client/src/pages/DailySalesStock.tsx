import React, { useState } from 'react';
import DailyShiftForm from './DailyShiftForm';
import DraftFormsLibrary from './DraftFormsLibrary';
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

const DailySalesStock = () => {
  return (
    <div className="container mx-auto p-4 max-w-7xl">
      <div className="mb-6">
        <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 mb-2">Daily Sales & Stock</h1>
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