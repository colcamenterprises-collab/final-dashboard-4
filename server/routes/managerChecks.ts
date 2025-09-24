import { Router } from 'express';
import { db } from '../db';
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
// GET /api/manager-check/questions?salesId=123
router.get('/questions', async (req, res) => {
  try {
    const salesId = Number(req.query.salesId);
    if (!salesId) return res.status(400).json({ error: 'salesId required' });

    // Sample questions for Manager Quick Check
    const sampleQuestions = [
      { id: 1, text: "Fryer oil area wiped, no spills or residue", category: "Hygiene" },
      { id: 2, text: "Fridge seals wiped and intact", category: "Equipment" },
      { id: 3, text: "Handwash sink stocked (soap, towels)", category: "Food Safety" },
      { id: 4, text: "Cash register balanced and secured", category: "Security" }
    ];

    res.json({
      required: REQUIRED,
      status: 'PENDING',
      dailyCheckId: salesId, // Use salesId as dailyCheckId for simplicity
      questions: sampleQuestions
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

    // For now, just log the submission and return success
    console.log('Manager Check submitted:', { dailyCheckId, answeredBy, answers: answers.length });

    res.json({ ok: true, dailyCheckId, status: 'COMPLETED' });
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

export default router;