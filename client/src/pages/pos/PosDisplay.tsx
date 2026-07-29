import { useEffect, useRef, useState } from "react";

const spokenTicket = (ticket: string) => ticket.split("").join(" ");
const announce = (ticket: string) => {
  if (!("speechSynthesis" in window)) return;
  const utterance = new SpeechSynthesisUtterance(
    `Order ${spokenTicket(ticket)} is ready for collection`,
  );
  utterance.lang = "en-US";
  window.speechSynthesis.speak(utterance);
};

export default function PosDisplay() {
  const [tickets, setTickets] = useState<any[]>([]);
  const seen = useRef(new Set<string>());

  useEffect(() => {
    const load = () =>
      fetch("/api/pos/display/orders")
        .then((response) => response.json())
        .then((body) => {
          const next = body.data || [];
          const visible = new Set<string>(
            next.map((ticket: any) => ticket.ticket_number),
          );
          for (const ticket of next) {
            if (!seen.current.has(ticket.ticket_number)) {
              seen.current.add(ticket.ticket_number);
              announce(ticket.ticket_number);
            }
          }
          for (const ticket of Array.from(seen.current)) {
            if (!visible.has(ticket)) seen.current.delete(ticket);
          }
          setTickets(next);
        });
    load();
    const timer = setInterval(load, 5000);
    return () => clearInterval(timer);
  }, []);

  return (
    <main className="min-h-dvh bg-zinc-950 p-6 text-center text-white">
      <p className="font-bold tracking-[.3em] text-yellow-400">SMASH BROTHERS</p>
      <h1 className="mt-2 text-4xl font-black">ORDER READY</h1>
      <p className="mt-2 text-zinc-400">Please collect from the counter</p>
      <div className="mx-auto mt-10 grid max-w-5xl grid-cols-2 gap-5 md:grid-cols-3">
        {tickets.map((ticket) => (
          <div
            key={ticket.id || ticket.ticket_number}
            className="rounded-2xl bg-yellow-400 p-7 text-5xl font-black text-black"
          >
            {ticket.ticket_number}
          </div>
        ))}
      </div>
      {!tickets.length && (
        <p className="mt-16 text-2xl text-zinc-500">
          Your ticket number will appear here.
        </p>
      )}
    </main>
  );
}
