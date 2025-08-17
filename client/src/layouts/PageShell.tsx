import Topbar from "../components/Topbar";

export default function PageShell({ children }:{children: React.ReactNode}) {
  return (
    <div className="flex-1 flex flex-col min-h-screen">
      <Topbar />
      <main className="flex-1">
        {/* global layout container + vertical spacing */}
        <div className="mx-auto max-w-[1400px] px-6 py-6 space-y-6">
          {children}
        </div>
      </main>
    </div>
  );
}