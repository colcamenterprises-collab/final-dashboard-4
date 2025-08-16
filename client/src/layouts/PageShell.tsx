interface PageShellProps {
  children: React.ReactNode;
}

export default function PageShell({ children }: PageShellProps) {
  return (
    <main className="flex-1 min-w-0 p-6">
      {children}
    </main>
  );
}