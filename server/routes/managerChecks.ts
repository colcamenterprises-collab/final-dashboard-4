import { Router } from 'express';
import { PrismaClient } from '@prisma/client';
import crypto from 'crypto';

const prisma = new PrismaClient();
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

// GET /api/manager-check/questions?salesId=123
router.get('/questions', async (req, res) => {
  try {
    const salesId = Number(req.query.salesId);
    if (!salesId) return res.status(400).json({ error: 'salesId required' });

    const enabled = await prisma.managerCheckQuestion.findMany({ where: { enabled: true } });
    if (!enabled.length) {
      const daily = await prisma.dailyManagerCheck.upsert({
        where: { salesId },
        update: { status: 'UNAVAILABLE' },
        create: { salesId, status: 'UNAVAILABLE' }
      });
      return res.json({ required: REQUIRED, status: 'UNAVAILABLE', dailyCheckId: daily.id, questions: [] });
    }

    const chosen = pickQuestions(enabled, salesId);
    const daily = await prisma.dailyManagerCheck.upsert({
      where: { salesId },
      update: {},
      create: { salesId, status: 'PENDING' }
    });

    // ensure items exist
    for (const q of chosen) {
      await prisma.dailyManagerCheckItem.upsert({
        where: { dailyCheckId_questionId: { dailyCheckId: daily.id, questionId: q.id } },
        update: {},
        create: { dailyCheckId: daily.id, questionId: q.id }
      });
    }

    await prisma.managerCheckQuestion.updateMany({
      where: { id: { in: chosen.map(q => q.id) } },
      data: { lastUsedAt: new Date() }
    });

    res.json({
      required: REQUIRED,
      status: 'PENDING',
      dailyCheckId: daily.id,
      questions: chosen.map(q => ({ id: q.id, text: q.text, category: q.category ?? null }))
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

    for (const a of answers) {
      if (!a?.questionId) continue;
      await prisma.dailyManagerCheckItem.updateMany({
        where: { dailyCheckId, questionId: Number(a.questionId) },
        data: { response: a.response ?? null, note: a.note ?? null, photoUrl: a.photoUrl ?? null }
      });
    }

    const updated = await prisma.dailyManagerCheck.update({
      where: { id: Number(dailyCheckId) },
      data: { answeredBy, managerPin: managerPin ?? null, status: 'COMPLETED' }
    });

    res.json({ ok: true, dailyCheckId: updated.id, status: updated.status });
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

    const daily = await prisma.dailyManagerCheck.upsert({
      where: { salesId: Number(salesId) },
      update: { status: 'SKIPPED', skipReason: reason },
      create: { salesId: Number(salesId), status: 'SKIPPED', skipReason: reason }
    });

    res.json({ ok: true, dailyCheckId: daily.id, status: daily.status });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Server error' });
  }
});

export default router;