// ==== Manager Checklist types ====
export type ChecklistQuestion = {
  id: string;
  text: string;             // question (English/Thai ok)
  area?: string;            // e.g., "Kitchen", "Cashier", "Front"
  active: boolean;          // toggle without deleting
};

export type NightlyDraw = {
  dateISO: string;          // "YYYY-MM-DD" (TH)
  questionIds: string[];    // 5 randomized ids (or N)
  createdAtISO: string;
};

export type ChecklistSubmission = {
  id: string;
  dateISO: string;
  completedAtISO: string;
  managerName: string;
  attesterPhotoUrl?: string;
  answers: { questionId: string; value: boolean; note?: string }[];
  shiftNotes?: string;              // anonymous free text
};

export interface ManagerChecklistStorage {
  listQuestions(): Promise<ChecklistQuestion[]>;
  upsertQuestion(q: Omit<ChecklistQuestion,"id"> & { id?: string }): Promise<ChecklistQuestion>;
  deleteQuestion(id: string): Promise<void>;

  getOrCreateNightlyDraw(dateISO: string, count: number): Promise<NightlyDraw>;
  getSubmission(dateISO: string): Promise<ChecklistSubmission | null>;
  saveSubmission(s: ChecklistSubmission): Promise<void>;
}

// ==== In-memory (replace with DB if you want) ====
const MC_QUESTIONS: ChecklistQuestion[] = [
  { id: "q1", text: "Fridge temps logged accurately", area:"Kitchen", active:true },
  { id: "q2", text: "Handwash station stocked (soap/towels)", area:"Kitchen", active:true },
  { id: "q3", text: "Cash counted & matched to report", area:"Cashier", active:true },
  { id: "q4", text: "Waste recorded correctly", area:"Kitchen", active:true },
  { id: "q5", text: "Dining area clean & sanitized", area:"Front", active:true },
  { id: "q6", text: "ตรวจสอบความสะอาดของเครื่องมือทำอาหาร (Check cleanliness of cooking utensils)", area:"Kitchen", active:true },
  { id: "q7", text: "ตรวจสอบระบบระบายอากาศและดูดควัน (Check ventilation and exhaust systems)", area:"Kitchen", active:true },
  { id: "q8", text: "ตรวจสอบการจัดเก็บวัตถุดิบให้ถูกต้อง (Verify proper raw material storage)", area:"Kitchen", active:true },
  { id: "q9", text: "ตรวจสอบความสะอาดของเคาน์เตอร์หน้าร้าน (Check front counter cleanliness)", area:"Cashier", active:true },
  { id: "q10", text: "ตรวจสอบการทำงานของระบบสั่งอาหาร (Check ordering system functionality)", area:"Cashier", active:true },
  { id: "q11", text: "นับเงินในลิ้นชักและบันทึกยอด (Count cash drawer and record totals)", area:"Cashier", active:true },
  { id: "q12", text: "Equipment temperature checks completed", area:"Kitchen", active:true },
  { id: "q13", text: "Food storage areas organized properly", area:"Kitchen", active:true },
  { id: "q14", text: "Customer service area presentable", area:"Front", active:true },
  { id: "q15", text: "Receipt printer supplies adequate", area:"Cashier", active:true },
];
const MC_DRAWS: NightlyDraw[] = [];
const MC_SUBMISSIONS: ChecklistSubmission[] = [];

// seeded RNG (stable per date)
function seededRng(seed: string) {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < seed.length; i++) { 
    h ^= seed.charCodeAt(i); 
    h += (h<<1) + (h<<4) + (h<<7) + (h<<8) + (h<<24); 
  }
  return () => (h = Math.imul(48271, h >>> 0) % 0x7fffffff) / 0x7fffffff;
}

export class ManagerChecklistStore implements ManagerChecklistStorage {
  async listQuestions() { return MC_QUESTIONS.slice(); }

  async upsertQuestion(q: Omit<ChecklistQuestion,"id"> & { id?: string }) {
    if (q.id) {
      const i = MC_QUESTIONS.findIndex(x=>x.id===q.id);
      if (i>=0) { 
        MC_QUESTIONS[i] = { ...MC_QUESTIONS[i], ...q, id:q.id }; 
        return MC_QUESTIONS[i]; 
      }
    }
    const id = "q" + Math.random().toString(36).slice(2,8);
    const created = { id, text:q.text, area:q.area, active:q.active ?? true };
    MC_QUESTIONS.push(created);
    return created;
  }
  
  async deleteQuestion(id: string) { 
    const i = MC_QUESTIONS.findIndex(x=>x.id===id); 
    if (i>=0) MC_QUESTIONS.splice(i,1);
  }

  async getOrCreateNightlyDraw(dateISO: string, count: number) {
    const exist = MC_DRAWS.find(d=>d.dateISO===dateISO);
    if (exist) return exist;
    
    const rng = seededRng(dateISO);
    const pool = MC_QUESTIONS.filter(q=>q.active);
    const picked: string[] = [];
    
    if (pool.length <= count) {
      picked.push(...pool.map(p=>p.id));
    } else {
      const copy = pool.slice();
      for (let i=0; i<count; i++){
        const idx = Math.floor(rng()*copy.length);
        picked.push(copy[idx].id); 
        copy.splice(idx,1);
      }
    }
    
    const draw: NightlyDraw = { 
      dateISO, 
      questionIds: picked, 
      createdAtISO: new Date().toISOString() 
    };
    MC_DRAWS.push(draw); 
    return draw;
  }

  async getSubmission(dateISO:string) {
    return MC_SUBMISSIONS.find(s=>s.dateISO===dateISO) || null;
  }
  
  async saveSubmission(s: ChecklistSubmission) {
    const i = MC_SUBMISSIONS.findIndex(x=>x.dateISO===s.dateISO);
    if (i>=0) MC_SUBMISSIONS[i] = s; 
    else MC_SUBMISSIONS.push(s);
  }
}

// singleton
export const managerChecklistStore = new ManagerChecklistStore();