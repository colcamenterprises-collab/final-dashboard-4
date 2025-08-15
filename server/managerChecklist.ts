// Manager's Nightly Checklist System
// Randomized daily operational tasks with Thai language support and photo evidence

const kitchenTasks = [
  { id: "k1", text: "Check all equipment temperatures and log readings", requiresNote: true },
  { id: "k2", text: "Clean and sanitize all prep surfaces", requiresPhoto: true },
  { id: "k3", text: "Verify all food items are properly labeled with dates", requiresNote: true },
  { id: "k4", text: "Check freezer and refrigerator organization", requiresPhoto: true },
  { id: "k5", text: "Inspect hand washing stations - soap, towels, sanitizer", requiresPhoto: true },
  { id: "k6", text: "Review oil quality and filter status", requiresNote: true },
  { id: "k7", text: "Check grill temperature consistency", requiresNote: true },
  { id: "k8", text: "Verify proper food storage containers and lids", requiresPhoto: true },
  { id: "k9", text: "Clean and organize spice/seasoning area", requiresPhoto: true },
  { id: "k10", text: "Check all kitchen timers are working properly" },
  { id: "k11", text: "ตรวจสอบความสะอาดของเครื่องมือทำอาหาร (Check cleanliness of cooking utensils)", requiresPhoto: true },
  { id: "k12", text: "ตรวจสอบระบบระบายอากาศและดูดควัน (Check ventilation and exhaust systems)" },
  { id: "k13", text: "ตรวจสอบการจัดเก็บวัตถุดิบให้ถูกต้อง (Verify proper raw material storage)", requiresNote: true }
];

const cashierTasks = [
  { id: "c1", text: "Count and verify cash register totals", requiresNote: true },
  { id: "c2", text: "Check POS system connectivity and backup", requiresNote: true },
  { id: "c3", text: "Verify receipt printer paper and toner levels" },
  { id: "c4", text: "Clean and organize customer service area", requiresPhoto: true },
  { id: "c5", text: "Check card reader functionality with test transaction", requiresNote: true },
  { id: "c6", text: "Verify menu boards are clean and current", requiresPhoto: true },
  { id: "c7", text: "Count and secure promotional materials" },
  { id: "c8", text: "Check customer seating area cleanliness", requiresPhoto: true },
  { id: "c9", text: "Verify all payment methods are functioning" },
  { id: "c10", text: "Check loyalty program system status", requiresNote: true },
  { id: "c11", text: "ตรวจสอบความสะอาดของเคาน์เตอร์หน้าร้าน (Check front counter cleanliness)", requiresPhoto: true },
  { id: "c12", text: "ตรวจสอบการทำงานของระบบสั่งอาหาร (Check ordering system functionality)", requiresNote: true },
  { id: "c13", text: "นับเงินในลิ้นชักและบันทึกยอด (Count cash drawer and record totals)", requiresNote: true }
];

// Pseudo-random shuffle based on date to ensure same tasks on same date
function shuffleWithSeed(array: any[], seed: string): any[] {
  const arr = [...array];
  let hash = 0;
  for (let i = 0; i < seed.length; i++) {
    const char = seed.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32-bit integer
  }
  
  for (let i = arr.length - 1; i > 0; i--) {
    // Generate deterministic "random" index based on hash
    hash = (hash * 1103515245 + 12345) & 0x7fffffff;
    const j = hash % (i + 1);
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

export function generateDailyChecklist(dateISO: string, role: "kitchen" | "cashier", taskCount: number = 8) {
  const tasks = role === "kitchen" ? kitchenTasks : cashierTasks;
  const seed = `${dateISO}-${role}`;
  const shuffled = shuffleWithSeed(tasks, seed);
  
  return shuffled.slice(0, Math.min(taskCount, tasks.length)).map(task => ({
    taskId: task.id,
    text: task.text,
    requiresPhoto: task.requiresPhoto,
    requiresNote: task.requiresNote
  }));
}

export interface ChecklistSubmission {
  id?: number;
  dateISO: string;
  role: "kitchen" | "cashier";
  managerName: string;
  items: Array<{
    taskId: string;
    text: string;
    done: boolean;
    note?: string;
    photoUrl?: string;
  }>;
  completedAt: Date;
}

// In-memory storage for demo (replace with database in production)
const submissions: ChecklistSubmission[] = [];
let nextId = 1;

export function saveChecklistSubmission(submission: Omit<ChecklistSubmission, 'id' | 'completedAt'>): ChecklistSubmission {
  const saved: ChecklistSubmission = {
    ...submission,
    id: nextId++,
    completedAt: new Date()
  };
  submissions.push(saved);
  return saved;
}

export function getChecklistHistory(role: "kitchen" | "cashier", limit: number = 30): ChecklistSubmission[] {
  return submissions
    .filter(s => s.role === role)
    .sort((a, b) => b.completedAt.getTime() - a.completedAt.getTime())
    .slice(0, limit);
}