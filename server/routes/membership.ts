import { Router } from 'express';

const router = Router();

type Member = { id: string; name: string; email: string; phone: string; totalSpend: number };
let members: Member[] = [];

function randomId(existing: string[] = []) {
  let id: string;
  do { id = Math.floor(100000 + Math.random()*900000).toString(); }
  while (existing.includes(id));
  return id;
}

router.post('/register', async (req, res) => {
  try {
    const { name, email, phone } = req.body || {};
    if (!name || !email || !phone) return res.status(400).json({ error: 'name, email, phone required' });

    const id = randomId(members.map(m => m.id));
    const token = process.env.LOYVERSE_API_TOKEN;

    if (token) {
      const resp = await fetch('https://api.loyverse.com/v1.0/customers', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        },
        body: JSON.stringify({
          name,
          email,
          phone_number: phone,
          tags: ['SBB Membership'],
          note: `SBB Member ${id}`,
        }),
      });
      if (!resp.ok) {
        const text = await resp.text();
        console.warn('Loyverse create customer failed:', resp.status, text);
      }
    }

    const member: Member = { id, name, email, phone, totalSpend: 0 };
    members.unshift(member);
    return res.json(member);
  } catch (e: any) {
    console.error(e);
    return res.status(500).json({ error: 'server_error' });
  }
});

router.post('/:id/spend', async (req, res) => {
  try {
    const id = req.params.id;
    const { amount } = req.body || {};
    const n = parseFloat(amount);
    if (!id || isNaN(n) || n <= 0) return res.status(400).json({ error: 'bad_request' });

    const idx = members.findIndex(m => m.id === id);
    if (idx === -1) return res.status(404).json({ error: 'not_found' });
    members[idx].totalSpend += n;

    return res.json({ ok: true, member: members[idx] });
  } catch (e: any) {
    console.error(e);
    return res.status(500).json({ error: 'server_error' });
  }
});

router.get('/', (req, res) => {
  res.json({ members });
});

export default router;
