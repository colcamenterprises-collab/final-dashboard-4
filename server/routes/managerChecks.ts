import { Router } from 'express';
import { prisma } from "../../lib/prisma";
import { db } from '../db';
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
    const salesId = Number(req.query.salesId);
    const lang = (req.query.lang as string) || 'en';
    if (!salesId) return res.status(400).json({ error: 'salesId required' });

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

    // Save manager checklist to database
    const record = await prisma.managerChecklist.create({
      data: {
        shiftId: String(dailyCheckId),
        managerName: answeredBy,
        tasksAssigned: answers.map((a: any) => ({ questionId: a.questionId })),
        tasksCompleted: answers,
        signedAt: new Date()
      }
    });
    return res.json({ ok: true, id: record.id, status: "COMPLETED" });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Server error' });
  }
});

// POST /api/manager-check/skip
// body: { salesId, reason }
router.post('/skip', async (req, res) => {
  try {
    const { salesId, reason } = req.body || {};
    if (!salesId || !reason) return res.status(400).json({ error: 'salesId and reason required' });

    console.log('Manager Check skipped:', { salesId, reason });

    res.json({ ok: true, dailyCheckId: salesId, status: 'SKIPPED' });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Server error' });
  }
});

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
