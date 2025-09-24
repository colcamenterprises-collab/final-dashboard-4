import { Router } from "express";

const router = Router();

// Simple safety wrapper so we never emulate a real person.
// We use a fictional persona "Chef Ramsay Gordon".
const SYSTEM_PROMPT = (mode:"helpful"|"ramsay") => `
You are "Chef Ramsay Gordon", a fictional chef persona.
Tone: ${mode==="ramsay" ? "blunt, sarcastic, funny, short" : "direct, helpful, concise"}.
NEVER claim to be a real person. Keep replies under 120 words.
Focus on food cost optimization, substitutions, portion control, supplier strategies, yield and waste reduction.
When something is silly, you may say: "Are you serious adding that?" sparingly.
`;

router.post("/chat", async (req, res) => {
  try {
    const { mode = "ramsay", question = "", context = {} } = req.body || {};
    const content = `
Question: ${question}
Context: ${JSON.stringify(context)}
Return: 2-4 sentences max. One concrete tip if possible.
`;
    const text = await callOpenAI(SYSTEM_PROMPT(mode), content);
    res.json({ ok: true, text });
  } catch (e:any) {
    console.error(e);
    res.json({ ok: true, text: "If the API's down, the maths still works. Check your portions and protein cost first." });
  }
});

router.post("/describe", async (req, res) => {
  try {
    const { mode = "helpful", recipeName = "", lines = [], targetPrice = 0 } = req.body || {};
    const content = `
Create a mouthwatering, concise menu description for: "${recipeName}".
Ingredients: ${lines.map((l:any)=>`${l.name} (${l.qty}${l.unit})`).join(", ")}
Style: ${mode==="ramsay"?"bold, cheeky":"elegant, inviting"}
Max 55 words. No emojis. No brand names.`;
    const text = await callOpenAI(SYSTEM_PROMPT(mode), content);
    res.json({ ok: true, text });
  } catch (e:any) {
    console.error(e);
    res.json({ ok: true, text: "Smash-griddled perfection with melty layers and crisp edges. Simple, honest, and outrageously satisfying." });
  }
});

export default router;

// --- OpenAI helper (compatible with API key via env) ---
async function callOpenAI(system:string, content:string){
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error("Missing OPENAI_API_KEY");
  
  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method:"POST",
    headers:{ "Authorization":`Bearer ${apiKey}`, "Content-Type":"application/json" },
    body: JSON.stringify({
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: system },
        { role: "user", content }
      ],
      temperature: 0.6,
      max_tokens: 180
    })
  });
  
  const j:any = await response.json();
  const text = j?.choices?.[0]?.message?.content || "";
  return text.trim();
}