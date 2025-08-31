import logoImg from "@assets/Yellow Circle - Black Logo_1756650531149.png";

export default function PageShell({ children }:{children: React.ReactNode}) {
  return (
    <div className="flex-1 flex flex-col min-h-screen">
      {/* Header with logo */}
      <header className="bg-white border-b">
        <div className="mx-auto max-w-[1400px] px-3 lg:px-6 py-3">
          <img 
            src={logoImg} 
            alt="Smash Brothers Burgers" 
            className="w-[60px] h-[60px] object-contain"
          />
        </div>
      </header>
      
      <main className="flex-1">
        {/* Responsive layout container */}
        <div className="mx-auto max-w-[1400px] px-3 lg:px-6 py-3 lg:py-6 space-y-4 lg:space-y-6">
          {children}
        </div>
      </main>
    </div>
  );
}