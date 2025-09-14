import React, { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

type Task = {
  id: number;
  taskName: string;
  taskDetail?: string;
  zone: string;
  shiftPhase: string;
};

interface Props {
  shiftId: string;
  open: boolean;
  onClose: () => void;
}

export default function ManagerChecklistModal({ shiftId, open, onClose }: Props) {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [checked, setChecked] = useState<number[]>([]);
  const [managerName, setManagerName] = useState("");
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (open) {
      setLoading(true);
      fetch(`/api/checklists/random?zone=Kitchen&phase=End&count=3`)
        .then((res) => res.json())
        .then((data) => {
          setTasks(data);
          setChecked([]); // Reset checked items
          setLoading(false);
        })
        .catch((error) => {
          console.error('Failed to fetch tasks:', error);
          setLoading(false);
        });
    }
  }, [open]);

  const toggleCheck = (id: number) => {
    setChecked((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  };

  const handleSubmit = async () => {
    if (submitting) return;
    
    setSubmitting(true);
    try {
      const completed = tasks.filter((t) => checked.includes(t.id));
      const response = await fetch("/api/checklists/complete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          shiftId,
          managerName,
          tasks: completed,
        }),
      });

      if (response.ok) {
        console.log('Manager checklist submitted successfully');
        onClose();
        // Reset form state
        setChecked([]);
        setManagerName("");
      } else {
        console.error('Failed to submit checklist');
      }
    } catch (error) {
      console.error('Error submitting checklist:', error);
    } finally {
      setSubmitting(false);
    }
  };

  const allTasksChecked = tasks.length > 0 && checked.length === tasks.length;
  const canSubmit = allTasksChecked && managerName.trim().length > 0 && !submitting;

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle className="text-lg font-semibold text-gray-900 dark:text-gray-100">
            Manager Checklist
          </DialogTitle>
        </DialogHeader>
        
        <div className="space-y-4">
          {loading ? (
            <div className="text-center py-4 text-gray-500">Loading tasks...</div>
          ) : (
            <>
              <div className="space-y-3">
                <Label className="text-sm font-medium text-gray-700 dark:text-gray-300">
                  Complete all required tasks:
                </Label>
                {tasks.map((task) => (
                  <div key={task.id} className="flex items-start space-x-3 p-3 border border-gray-200 dark:border-gray-700 rounded-lg">
                    <Checkbox
                      id={`task-${task.id}`}
                      checked={checked.includes(task.id)}
                      onCheckedChange={() => toggleCheck(task.id)}
                      className="mt-0.5"
                      data-testid={`checkbox-task-${task.id}`}
                    />
                    <div className="flex-1">
                      <Label 
                        htmlFor={`task-${task.id}`}
                        className="text-sm font-medium text-gray-900 dark:text-gray-100 cursor-pointer"
                      >
                        {task.taskName}
                      </Label>
                      {task.taskDetail && (
                        <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                          {task.taskDetail}
                        </p>
                      )}
                      <div className="text-xs text-gray-400 dark:text-gray-500 mt-1">
                        {task.zone} • {task.shiftPhase}
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              <div className="space-y-2">
                <Label htmlFor="manager-name" className="text-sm font-medium text-gray-700 dark:text-gray-300">
                  Manager Name
                </Label>
                <Input
                  id="manager-name"
                  type="text"
                  placeholder="Enter manager name"
                  value={managerName}
                  onChange={(e) => setManagerName(e.target.value)}
                  className="w-full"
                  data-testid="input-manager-name"
                />
              </div>

              <div className="flex justify-end space-x-2 pt-4">
                <Button
                  variant="outline"
                  onClick={onClose}
                  disabled={submitting}
                  data-testid="button-cancel"
                >
                  Cancel
                </Button>
                <Button
                  onClick={handleSubmit}
                  disabled={!canSubmit}
                  className="bg-emerald-600 hover:bg-emerald-700 text-white"
                  data-testid="button-submit"
                >
                  {submitting ? "Submitting..." : "Submit Checklist"}
                </Button>
              </div>

              {tasks.length > 0 && (
                <div className="text-xs text-gray-500 dark:text-gray-400 text-center">
                  {checked.length} of {tasks.length} tasks completed
                </div>
              )}
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}