import { useState } from "react";
import AdminVenues from "./AdminVenues";
import AdminMembers from "./AdminMembers";

export default function AdminQrCodes() {
  const [tab, setTab] = useState<"venues" | "members">("venues");
  return (
    <main className="min-h-full bg-neutral-50">
      <div className="mx-auto max-w-7xl px-4 pt-4 md:px-6 md:pt-6">
        <div className="inline-flex rounded-xl border border-neutral-200 bg-white p-1 shadow-sm">
          <button onClick={() => setTab("venues")} className={`rounded-lg px-4 py-2 text-sm font-semibold ${tab === "venues" ? "bg-neutral-950 text-white" : "text-neutral-600"}`}>Partner Venues</button>
          <button onClick={() => setTab("members")} className={`rounded-lg px-4 py-2 text-sm font-semibold ${tab === "members" ? "bg-neutral-950 text-white" : "text-neutral-600"}`}>Members & Customers</button>
        </div>
      </div>
      {tab === "venues" ? <AdminVenues /> : <AdminMembers />}
    </main>
  );
}
