import { useEffect, useRef, useState } from "react";

const spokenTicket = (ticket: string) => ticket.split("").join(" ");
const announce = (ticket: string) => {
  if (!("speechSynthesis" in window)) return;
  window.speechSynthesis.cancel();
  const utterance = new SpeechSynthesisUtterance(
    `Order ${spokenTicket(ticket)} is ready for collection`,
  );
  utterance.lang = "en-US";
  window.speechSynthesis.speak(utterance);
};

const readSeen = () => {
  try {
    return new Set<string>(JSON.parse(sessionStorage.getItem("sbb_display_seen_ready") || "[]"));
  } catch {
    return new Set<string>();
  }
};

export default function PosDisplay() {
  const [tickets, setTickets] = useState<any[]>([]);
  const [error, setError] = useState("");
  const seen = useRef(readSeen());

  useEffect(() => {
    const load = async () => {
      try {
        const response = await fetch("/api/pos/display/orders", { cache: "no-store" });
        const body = await response.json();
        if (!response.ok || !body.ok) throw new Error(body.error || "Could not load ready tickets");
        const next = body.data || [];
        const visible = new Set<string>(next.map((ticket: any) => String(ticket.ticket_number)));
        for (const ticket of next) {
          const number = String(ticket.ticket_number || "");
          if (number && !seen.current.has(number)) {
            seen.current.add(number);
            announce(number);
          }
        }
        for (const ticket of Array.from(seen.current)) {
          if (!visible.has(ticket)) seen.current.delete(ticket);
        }
        sessionStorage.setItem("sbb_display_seen_ready", JSON.stringify(Array.from(seen.current)));
        setTickets(next);
        setError("");
      } catch (cause: any) {
        setError(cause.message || "Ticket display disconnected");
      }
    };
    void load();
    const timer = window.setInterval(() => void load(), 3000);
    return () => window.clearInterval(timer);
  }, []);

  return (
    <main className="min-h-dvh bg-zinc-950 p-6 text-center text-white">
      <p className="font-bold tracking-[.3em] text-yellow-400">SMASH BROTHERS</p>
      <h1 className="mt-2 text-4xl font-black">ORDER READY</h1>
      <p className="mt-2 text-zinc-400">Please collect from the counter</p>
      {error && <p className="mx-auto mt-5 max-w-xl rounded-xl border border-red-700 bg-red-950/60 px-4 py-3 text-sm font-bold text-red-200">Connection issue — retrying automatically</p>}
      <div className="mx-auto mt-10 grid max-w-5xl grid-cols-2 gap-5 md:grid-cols-3">
        {tickets.map((ticket) => (
          <div key={ticket.id || ticket.ticket_number} className="rounded-2xl bg-yellow-400 p-7 text-5xl font-black text-black">
            {ticket.ticket_number}
          </div>
        ))}
      </div>
      {!tickets.length && !error && (
        <p className="mt-16 text-2xl text-zinc-500">Your ticket number will appear here.</p>
      )}
    </main>
  );
}
