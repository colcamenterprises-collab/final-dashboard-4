// src/layouts/PageShell.tsx
import { ReactNode } from "react";

export default function PageShell({ children }: { children: ReactNode }) {
  return (
    <main className="flex-1 min-h-screen overflow-y-auto">
      <div className="max-w-7xl mx-auto px-6 py-6">{children}</div>
    </main>
  );
}