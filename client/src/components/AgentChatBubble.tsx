/**
 * 🚨 DO NOT MODIFY 🚨
 * Shared chat bubble with agent selector (Jussi, Jane, Ramsay)
 */
import { useState } from "react";
export default function AgentChatBubble() {
  const [open, setOpen] = useState(false);
  const [agent, setAgent] = useState("jussi");
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState<string[]>([]);

  async function sendMessage() {
    const res = await fetch(`/chat/${agent}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message: input }),
    });
    const data = await res.json();
    setMessages([...messages, "You: " + input, agent + ": " + data.reply]);
    setInput("");
  }

  return (
    <div>
      <button
        className="fixed right-6 bottom-6 bg-yellow-400 rounded-full px-4 py-2 shadow-lg"
        onClick={() => setOpen(!open)}
      >
        🤖
      </button>
      {open && (
        <div className="fixed right-6 bottom-20 w-72 bg-white p-4 rounded-lg shadow-lg">
          <div className="mb-2">
            <select
              value={agent}
              onChange={(e) => setAgent(e.target.value)}
              className="border p-1 rounded w-full"
            >
              <option value="jussi">Jussi (Ops)</option>
              <option value="jane">Jane (Accounting)</option>
              <option value="ramsay">Ramsay (Kitchen)</option>
            </select>
          </div>
          <div className="h-40 overflow-y-auto mb-2 text-sm">
            {messages.map((msg, i) => <div key={i}>{msg}</div>)}
          </div>
          <div className="flex space-x-2">
            <input
              className="border p-1 flex-1"
              value={input}
              onChange={(e) => setInput(e.target.value)}
            />
            <button onClick={sendMessage} className="bg-yellow-400 px-2">▶</button>
          </div>
        </div>
      )}
    </div>
  );
}