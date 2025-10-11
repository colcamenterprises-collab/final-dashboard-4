import { Router } from 'express';
import { db } from '../db';
import { managerChecklists } from '../../shared/schema';
import { sql } from 'drizzle-orm';
import crypto from 'crypto';

const router = Router();

const REQUIRED = process.env.CHECKLIST_REQUIRED === 'true';

// deterministic sample up to 4 questions by day + salesId
function pickQuestions(questions: any[], salesId: number) {
  const day = new Date().toISOString().slice(0, 10);
  const seed = crypto.createHash('sha256').update(`${day}:${salesId}`).digest('hex');
  const arr = [...questions].sort((a, b) => {
    const ha = crypto.createHash('sha256').update(seed + String(a.id)).digest('hex');
    const hb = crypto.createHash('sha256').update(seed + String(b.id)).digest('hex');
    return ha.localeCompare(hb);
  });
  return arr.slice(0, 4);
}

// Simplified version using existing manager checklist system
// GET /api/manager-check/questions?salesId=123&lang=en
router.get('/questions', async (req, res) => {
  try {
    const salesId = Number(req.query.salesId) || Math.floor(Date.now() / 1000); // Use timestamp if no salesId
    const lang = (req.query.lang as string) || 'en';

    // Fetch questions from database with language support
    const allQuestions = await db.execute(sql`
      SELECT 
        id, 
        CASE 
          WHEN ${lang} = 'th' AND text_th IS NOT NULL THEN text_th
          ELSE COALESCE(text_en, text)
        END as text,
        category
      FROM "ManagerCheckQuestion" 
      WHERE enabled = true 
      ORDER BY id
    `);

    // Pick deterministic subset of questions
    const selectedQuestions = pickQuestions(allQuestions.rows || allQuestions, salesId);

    res.json({
      required: REQUIRED,
      status: 'PENDING',
      dailyCheckId: salesId, // Use salesId as dailyCheckId for simplicity
      questions: selectedQuestions
    });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Server error' });
  }
});

// POST /api/manager-check/submit
// body: { dailyCheckId, answeredBy, managerPin?, answers: [{questionId, response, note?, photoUrl?}] }
router.post('/submit', async (req, res) => {
  try {
    const { dailyCheckId, answeredBy, managerPin, answers } = req.body || {};
    if (!dailyCheckId || !answeredBy || !Array.isArray(answers)) {
      return res.status(400).json({ error: 'dailyCheckId, answeredBy, answers[] required' });
    }

    // Save manager checklist to database using Drizzle
    const [record] = await db.insert(managerChecklists).values({
      shiftId: String(dailyCheckId),
      managerName: answeredBy,
      tasksAssigned: answers.map((a: any) => ({ questionId: a.questionId })),
      tasksCompleted: answers,
      signedAt: new Date()
    }).returning();
    
    return res.json({ ok: true, id: record.id, status: "COMPLETED" });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Server error' });
  }
});

// MEGA PATCH: disable skipping
router.all('/skip', (_req, res) => res.status(410).json({ error: "Gone: manager check cannot be skipped" }));

// GET /api/manager-check/admin/questions - List all questions for admin management
router.get('/admin/questions', async (req, res) => {
  try {
    const questions = await db.execute(sql`
      SELECT 
        id, 
        text, 
        text_en, 
        text_th, 
        category, 
        enabled, 
        weight,
        created_at,
        updated_at
      FROM "ManagerCheckQuestion" 
      ORDER BY category, id
    `);

    res.json({
      questions: questions.rows || questions,
      total: (questions.rows || questions).length
    });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Server error' });
  }
});

export default router;
import crypto from "crypto";
// FIX 2025-10-11: ensure 4 questions always available (EN/TH)
async function getFourQuestions(lang:string){
  try {
    const qs = await prisma.managerCheckQuestion.findMany({ where:{ enabled: true }, orderBy:{ id:'asc' } });
    const defaults = [
      { id: 101, text_en: "Clean grill surfaces", text_th: "ทำความสะอาดเตาย่าง" },
      { id: 102, text_en: "Wipe down prep stations", text_th: "เช็ดทำความสะอาดโต๊ะเตรียมอาหาร" },
      { id: 103, text_en: "Sanitize cutting boards", text_th: "ฆ่าเชื้อเขียง" },
      { id: 104, text_en: "Clean fryer filters", text_th: "ทำความสะอาดไส้กรองทอด" },
      { id: 105, text_en: "Secure cash drawer", text_th: "ล็อคลิ้นชักเงิน" },
      { id: 106, text_en: "Count register till", text_th: "นับเงินทอนเริ่มต้น" }
    ];
    const pool = (qs?.length? qs : defaults).map(q=>({ id:q.id, en:q.text_en??q.text, th:q.text_th??q.text }));
    const day = new Date().toISOString().slice(0,10);
    const seed = crypto.createHash('sha256').update(day).digest('hex');
    const sorted = [...pool].sort((a,b)=>{
      const ha=crypto.createHash('sha256').update(seed+String(a.id)).digest('hex');
      const hb=crypto.createHash('sha256').update(seed+String(b.id)).digest('hex');
      return ha.localeCompare(hb);
    });
    const pick = sorted.slice(0,4);
    return pick.map(q=>({ id:q.id, text: lang==='th'? (q.th||q.en): (q.en||q.th) }));
  } catch (e){
    return [
      { id: 201, text: lang==='th'?"ทำความสะอาดเตาย่าง":"Clean grill surfaces" },
      { id: 202, text: lang==='th'?"เช็ดทำความสะอาดโต๊ะเตรียมอาหาร":"Wipe down prep stations" },
      { id: 203, text: lang==='th'?"ฆ่าเชื้อเขียง":"Sanitize cutting boards" },
      { id: 204, text: lang==='th'?"ทำความสะอาดไส้กรองทอด":"Clean fryer filters" },
    ];
  }
}
