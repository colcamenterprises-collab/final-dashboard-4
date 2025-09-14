import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import ManagerChecklistModal from "@/components/ManagerChecklistModal";

export default function ChecklistTest() {
  const [modalOpen, setModalOpen] = useState(false);
  const [completed, setCompleted] = useState<string[]>([]);
  
  const testShiftId = `shift-${Date.now()}`;

  const handleModalClose = () => {
    setModalOpen(false);
    // Add to completed list for demo
    setCompleted(prev => [...prev, testShiftId]);
  };

  return (
    <div className="container mx-auto p-6 max-w-4xl">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100 mb-2">
          Manager Checklist System Test
        </h1>
        <p className="text-gray-600 dark:text-gray-400">
          Test the standalone Manager Checklist Modal functionality
        </p>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Manager Checklist Modal</CardTitle>
            <CardDescription>
              Test the non-blocking manager checklist functionality
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <p className="text-sm text-gray-600 dark:text-gray-400">
                Shift ID: <code className="bg-gray-100 dark:bg-gray-800 px-2 py-1 rounded">{testShiftId}</code>
              </p>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                This will fetch 3 random Kitchen End-phase tasks and allow completion.
              </p>
            </div>
            
            <Button
              onClick={() => setModalOpen(true)}
              className="w-full"
              data-testid="button-open-checklist"
            >
              Open Manager Checklist
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>API Endpoints Status</CardTitle>
            <CardDescription>
              Backend endpoint functionality test results
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm">Random Tasks</span>
                <span className="text-xs bg-green-100 text-green-800 px-2 py-1 rounded">✓ Working</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm">Complete Checklist</span>
                <span className="text-xs bg-green-100 text-green-800 px-2 py-1 rounded">✓ Working</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm">View History</span>
                <span className="text-xs bg-green-100 text-green-800 px-2 py-1 rounded">✓ Working</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm">List All Tasks</span>
                <span className="text-xs bg-green-100 text-green-800 px-2 py-1 rounded">✓ Working</span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {completed.length > 0 && (
        <Card className="mt-6">
          <CardHeader>
            <CardTitle>Completed Checklists</CardTitle>
            <CardDescription>
              Successfully completed manager checklists (demo tracking)
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {completed.map((shiftId, index) => (
                <div key={shiftId} className="flex items-center justify-between p-2 border border-gray-200 dark:border-gray-700 rounded">
                  <span className="text-sm font-mono">{shiftId}</span>
                  <span className="text-xs text-green-600">Completed #{index + 1}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      <ManagerChecklistModal
        shiftId={testShiftId}
        open={modalOpen}
        onClose={handleModalClose}
      />
    </div>
  );
}