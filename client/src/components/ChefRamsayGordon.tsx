import React, { useEffect, useMemo, useRef, useState } from "react";

const THB = (n:number)=> new Intl.NumberFormat("th-TH",{style:"currency",currency:"THB",maximumFractionDigits:0}).format(n||0);

type Ctx = {
  recipeName: string;
  ingredientCount: number;
  foodCostPct: number;
  marginPct: number;
  costPerPortionTHB: number;
  menuPrice: number;
};

const PRELOADED_TIPS = [
  "Target food cost 28–32% for burgers. Adjust portion or price.",
  "If buns are premium, trim sauce costs to balance.",
  "Standardize portion scoops. Guesswork kills margins.",
  "Track supplier price changes weekly. Lock in bulk discounts.",
  "Batch-prep sauces to cut waste and labor.",
  "Weigh proteins. A few grams over adds up fast."
];

const PRELOADED_ROASTS = [
  "Are you serious adding that? What is this, a charity?",
  "That portion cost is a disaster. Fix it, now!",
  "You're seasoning your margins with tears.",
  "I've seen better costing in a toddler's lemonade stand.",
  "That price? You trying to go bankrupt stylishly?",
  "Stop. Breathe. Re-cost the protein before serving this mess."
];

export default function ChefRamsayGordon({ mode, context }: { mode:"helpful"|"ramsay"; context: Ctx }){
  const [open, setOpen] = useState(true);
  const [messages, setMessages] = useState<{role:"chef"|"user", text:string}[]>([
    { role:"chef", text:"Right, let's cost this properly. No nonsense." }
  ]);
  const roastTimer = useRef<any>(null);

  // Reactive nudges
  useEffect(()=>{
    // Simple heuristics
    if (context.foodCostPct > 38 && mode==="ramsay") pushChef(randomFrom(PRELOADED_ROASTS));
    else if (context.foodCostPct > 32) pushChef("Food cost is creeping up. Consider portion control or price uptick.");
    if (context.costPerPortionTHB <= 0 && context.ingredientCount>0) pushChef("Add quantities to calculate costs, mate.");
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [context.foodCostPct, context.costPerPortionTHB, context.ingredientCount, mode]);

  // Random roast mode (occasional)
  useEffect(()=>{
    if (roastTimer.current) clearInterval(roastTimer.current);
    roastTimer.current = setInterval(()=>{
      if (mode==="ramsay" && Math.random() < 0.33) pushChef(randomFrom(PRELOADED_ROASTS));
      else if (Math.random() < 0.20) pushChef(randomFrom(PRELOADED_TIPS));
    }, 20000);
    return ()=> clearInterval(roastTimer.current);
  }, [mode]);

  function randomFrom<T>(arr:T[]):T{ return arr[Math.floor(Math.random()*arr.length)]; }
  function pushChef(text:string){ setMessages(m=> [...m, { role:"chef", text }]); }
  function pushUser(text:string){ setMessages(m=> [...m, { role:"user", text }]); }

  async function sendChat(q:string){
    pushUser(q);
    try {
      const r = await fetch("/api/chef/chat", { method:"POST", headers:{ "Content-Type":"application/json" }, body: JSON.stringify({ mode, question:q, context })});
      const j = await r.json();
      pushChef(j.text || "I've got nothing. Fix your inputs and try again.");
    } catch {
      pushChef("If the API's down, the maths still works. Check your portions and protein cost first.");
    }
  }

  const summary = useMemo(()=> {
    return `Name: ${context.recipeName || "Untitled"} | Price: ${THB(context.menuPrice)} | Cost/portion: ${THB(context.costPerPortionTHB)} | Food%: ${context.foodCostPct.toFixed(1)}% | Ingredients: ${context.ingredientCount}`;
  }, [context]);

  return (
    <div className="fixed right-4 bottom-4 z-50 w-[320px]">
      <div className="rounded-2xl shadow-lg border bg-white overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-3 py-2 bg-[#0d9488] text-white">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-full bg-white/20 border border-white/30 overflow-hidden">
              {/* Placeholder avatar */}
              <img alt="Chef Ramsay Gordon" src="https://picsum.photos/seed/chef-ramsay-gordon/64/64" className="w-full h-full object-cover"/>
            </div>
            <div className="text-sm font-semibold">Chef Ramsay Gordon</div>
          </div>
          <button onClick={()=>setOpen(!open)} className="text-xs underline">{open?"Minimize":"Open"}</button>
        </div>

        {open && (
          <>
            {/* Live context hint */}
            <div className="px-3 py-2 text-[11px] text-gray-500 border-b bg-gray-50">{summary}</div>

            {/* Messages */}
            <div className="max-h-72 overflow-auto px-3 py-2 space-y-2">
              {messages.map((m,idx)=>(
                <div key={idx} className={`text-sm ${m.role==="chef"?"":"text-right"}`}>
                  <div className={`inline-block px-3 py-2 rounded-xl ${m.role==="chef"?"bg-gray-100 text-gray-800":"bg-teal-600 text-white"}`}>
                    {m.text}
                  </div>
                </div>
              ))}
            </div>

            {/* Chat box */}
            <ChatBox onSend={sendChat} />
          </>
        )}
      </div>
    </div>
  );
}

function ChatBox({ onSend }:{ onSend:(t:string)=>void }){
  const [v,setV]=useState("");
  return (
    <div className="flex gap-2 p-2 border-t bg-white">
      <input value={v} onChange={e=>setV(e.target.value)} onKeyDown={e=>{ if(e.key==="Enter" && v.trim()) { onSend(v.trim()); setV(""); }}} placeholder="Ask the Chef…" className="flex-1 border rounded-xl px-3 py-2 text-sm"/>
      <button onClick={()=>{ if(v.trim()){ onSend(v.trim()); setV(""); }}} className="bg-teal-600 text-white rounded-xl px-3 py-2 text-sm">Send</button>
    </div>
  );
}