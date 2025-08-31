export default function PageShell({ children }:{children: React.ReactNode}) {
  return (
    <div className="flex-1 flex flex-col min-h-screen">
      <main className="flex-1">
        {/* Responsive layout container */}
        <div className="mx-auto max-w-[1400px] px-3 lg:px-6 py-3 lg:py-6 space-y-4 lg:space-y-6">
          {children}
        </div>
      </main>
    </div>
  );
}