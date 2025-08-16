/**
 * ⚠️ LOCKED FILE — Do not replace or refactor without Cam's written approval.
 * This is the FINAL implementation used in production. All alternatives were removed on purpose.
 */

import React from 'react';

export default function ManagerChecklistStatusCard() {
  return (
    <div className="rounded-2xl bg-white shadow-sm border p-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-gray-900">Manager's Checklist</h3>
        <span className="text-xs text-gray-500">Daily Status</span>
      </div>
      
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-sm text-gray-600">Today's Tasks</span>
          <span className="text-sm font-medium text-emerald-600">8/12 Complete</span>
        </div>
        
        <div className="w-full bg-gray-200 rounded-full h-2">
          <div className="bg-emerald-500 h-2 rounded-full" style={{ width: '67%' }}></div>
        </div>
        
        <div className="flex items-center justify-between text-xs text-gray-500">
          <span>4 remaining</span>
          <span>Updated 2h ago</span>
        </div>
        
        <button className="w-full mt-4 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 font-medium py-2 px-4 rounded-lg transition-colors">
          Complete Tasks →
        </button>
      </div>
    </div>
  );
}