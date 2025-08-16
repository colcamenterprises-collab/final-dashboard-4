import { ReactNode } from "react";

interface PageShellProps {
  children: ReactNode;
}

export default function PageShell({ children }: PageShellProps) {
  return <main className="flex-1 p-6 overflow-auto">{children}</main>;
}