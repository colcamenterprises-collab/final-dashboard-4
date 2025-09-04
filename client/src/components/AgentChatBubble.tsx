/**
 * 🚨 DO NOT MODIFY EXISTING LOGIC 🚨
 * Safe extension – Adds Ramsay to selectable agents
 */

import { useState } from "react";

type Agent = "jussi" | "sally" | "ramsay";

export default function AgentChatBubble({ agent }: { agent: Agent }) {
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState<string[]>([]);

  async function sendMessage() {
    const res = await fetch(`/chat/${agent}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message: input }),
    });
    const data = await res.json();
    setMessages([...messages, "You: " + input, `${agent}: ${data.reply}`]);
    setInput("");
  }

  const agentEmoji = {
    jussi: "🤖",
    sally: "💰", 
    ramsay: "👨‍🍳"
  };

  const agentColor = {
    jussi: "bg-yellow-400",
    sally: "bg-green-400",
    ramsay: "bg-red-400"
  };

  return (
    <div>
      <button
        className={`fixed right-6 bottom-6 ${agentColor[agent]} rounded-full px-4 py-2 shadow-lg`}
        onClick={() => setOpen(!open)}
      >
        {agentEmoji[agent]}
      </button>
      {open && (
        <div className="fixed right-6 bottom-20 w-64 bg-white p-4 rounded-lg shadow-lg">
          <h3 className="font-bold mb-2 capitalize">{agent}</h3>
          <div className="h-40 overflow-y-auto mb-2 text-sm">
            {messages.map((msg, i) => <div key={i}>{msg}</div>)}
          </div>
          <div className="flex space-x-2">
            <input
              className="border p-1 flex-1"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && sendMessage()}
            />
            <button onClick={sendMessage} className={`${agentColor[agent]} px-2`}>▶</button>
          </div>
        </div>
      )}
    </div>
  );
}