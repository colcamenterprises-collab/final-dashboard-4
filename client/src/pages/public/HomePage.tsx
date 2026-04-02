import { useState } from "react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Menu, X, ChevronRight, MapPin, Clock, Phone } from "lucide-react";

const SBB_YELLOW = "#FFEB00";

function PublicNav() {
  const [open, setOpen] = useState(false);
  return (
    <nav className="fixed top-0 left-0 right-0 z-50 bg-black border-b border-yellow-400/20">
      <div className="max-w-6xl mx-auto px-4 flex items-center justify-between h-16">
        <Link to="/website" className="flex items-center gap-2">
          <span className="text-lg font-black tracking-tight" style={{ color: SBB_YELLOW }}>
            SMASH BROTHERS
          </span>
          <span className="text-lg font-black text-white tracking-tight">BURGERS</span>
        </Link>
        <div className="hidden md:flex items-center gap-8">
          <Link to="/website" className="text-sm font-semibold text-white hover:text-yellow-400 transition-colors">Home</Link>
          <Link to="/website/online-ordering" className="text-sm font-semibold text-white hover:text-yellow-400 transition-colors">Menu</Link>
          <Link to="/website/membership" className="text-sm font-semibold text-white hover:text-yellow-400 transition-colors">Membership</Link>
          <Link
            to="/website/online-ordering"
            className="px-4 py-2 text-sm font-bold rounded-sm transition-all hover:opacity-90"
            style={{ background: SBB_YELLOW, color: "#000" }}
          >
            ORDER NOW
          </Link>
        </div>
        <button
          className="md:hidden p-2 text-white"
          onClick={() => setOpen(!open)}
          aria-label="Toggle menu"
        >
          {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </button>
      </div>
      {open && (
        <div className="md:hidden bg-black border-t border-white/10 px-4 pb-4 space-y-3 pt-3">
          <Link to="/website" className="block text-sm font-semibold text-white py-2" onClick={() => setOpen(false)}>Home</Link>
          <Link to="/website/online-ordering" className="block text-sm font-semibold text-white py-2" onClick={() => setOpen(false)}>Menu</Link>
          <Link to="/website/membership" className="block text-sm font-semibold text-white py-2" onClick={() => setOpen(false)}>Membership</Link>
          <Link
            to="/website/online-ordering"
            className="block w-full text-center px-4 py-3 text-sm font-bold rounded-sm"
            style={{ background: SBB_YELLOW, color: "#000" }}
            onClick={() => setOpen(false)}
          >
            ORDER NOW
          </Link>
        </div>
      )}
    </nav>
  );
}

function PublicFooter() {
  return (
    <footer className="bg-black border-t border-white/10 pt-12 pb-8">
      <div className="max-w-6xl mx-auto px-4">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-10">
          <div>
            <div className="mb-4">
              <span className="text-xl font-black" style={{ color: SBB_YELLOW }}>SMASH BROTHERS</span>
              <br />
              <span className="text-xl font-black text-white">BURGERS</span>
            </div>
            <p className="text-sm text-white/60 leading-relaxed">
              Bangkok's boldest smash burgers. Handcrafted, flame-griddled, zero compromise.
            </p>
          </div>
          <div>
            <h3 className="text-sm font-bold text-white/80 uppercase tracking-widest mb-4">Quick Links</h3>
            <ul className="space-y-2">
              <li><Link to="/website/online-ordering" className="text-sm text-white/60 hover:text-yellow-400 transition-colors">Order Online</Link></li>
              <li><Link to="/website/membership" className="text-sm text-white/60 hover:text-yellow-400 transition-colors">Membership</Link></li>
              <li><Link to="/login" className="text-sm text-white/60 hover:text-yellow-400 transition-colors">Staff Login</Link></li>
            </ul>
          </div>
          <div>
            <h3 className="text-sm font-bold text-white/80 uppercase tracking-widest mb-4">Find Us</h3>
            <ul className="space-y-3">
              <li className="flex items-start gap-2 text-sm text-white/60">
                <MapPin className="h-4 w-4 mt-0.5 flex-shrink-0 text-yellow-400" />
                Bangkok, Thailand
              </li>
              <li className="flex items-start gap-2 text-sm text-white/60">
                <Clock className="h-4 w-4 mt-0.5 flex-shrink-0 text-yellow-400" />
                Daily 5:00 PM – 3:00 AM
              </li>
              <li className="flex items-start gap-2 text-sm text-white/60">
                <Phone className="h-4 w-4 mt-0.5 flex-shrink-0 text-yellow-400" />
                Available on Grab & Line
              </li>
            </ul>
          </div>
        </div>
        <div className="border-t border-white/10 pt-6 text-center text-xs text-white/40">
          © {new Date().getFullYear()} Smash Brothers Burgers. All rights reserved.
        </div>
      </div>
    </footer>
  );
}

export default function HomePage() {
  const { data: menuData } = useQuery<any>({
    queryKey: ["/api/menu-items-v3"],
    retry: false,
  });

  const featured = Array.isArray(menuData)
    ? menuData.filter((i: any) => i.available !== false).slice(0, 3)
    : [];

  return (
    <div className="min-h-screen bg-black" style={{ fontFamily: "'Poppins', sans-serif" }}>
      <PublicNav />

      {/* Hero */}
      <section
        className="relative flex flex-col items-center justify-center text-center px-4 pt-32 pb-24 md:pt-48 md:pb-36 overflow-hidden"
        style={{ background: "linear-gradient(180deg, #000 0%, #111 100%)" }}
      >
        <div
          className="absolute inset-0 opacity-10 pointer-events-none"
          style={{
            backgroundImage:
              "radial-gradient(circle at 50% 50%, #FFEB00 0%, transparent 70%)",
          }}
        />
        <div className="relative z-10 max-w-3xl mx-auto">
          <div
            className="inline-block text-xs font-bold tracking-[0.3em] uppercase px-4 py-1.5 mb-6 rounded-sm"
            style={{ background: SBB_YELLOW, color: "#000" }}
          >
            Bangkok's #1 Smash Burger
          </div>
          <h1 className="text-5xl md:text-7xl font-black text-white leading-none tracking-tight mb-6">
            BURGERS DONE{" "}
            <span style={{ color: SBB_YELLOW }}>RIGHT.</span>
          </h1>
          <p className="text-lg md:text-xl text-white/70 mb-10 max-w-xl mx-auto leading-relaxed">
            Handcrafted smash patties, crispy edges, loaded with flavour.
            Order online for pickup or delivery — every night from 5 PM.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link
              to="/website/online-ordering"
              className="inline-flex items-center justify-center gap-2 px-8 py-4 text-base font-bold rounded-sm hover:opacity-90 transition-all"
              style={{ background: SBB_YELLOW, color: "#000" }}
            >
              ORDER NOW <ChevronRight className="h-4 w-4" />
            </Link>
            <Link
              to="/website/membership"
              className="inline-flex items-center justify-center gap-2 px-8 py-4 text-base font-bold rounded-sm border border-white/30 text-white hover:border-yellow-400 hover:text-yellow-400 transition-all"
            >
              JOIN THE CLUB
            </Link>
          </div>
        </div>

        {/* Decorative divider */}
        <div
          className="absolute bottom-0 left-0 right-0 h-px"
          style={{ background: "linear-gradient(90deg, transparent, #FFEB00, transparent)" }}
        />
      </section>

      {/* Why Smash Brothers */}
      <section className="py-20 px-4" style={{ background: "#0a0a0a" }}>
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-14">
            <h2 className="text-3xl md:text-4xl font-black text-white mb-3">
              WHY SMASH BROTHERS?
            </h2>
            <p className="text-white/50 text-sm max-w-md mx-auto">
              We don't do ordinary. Every burger starts fresh, every service.
            </p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {[
              {
                icon: "🔥",
                title: "True Smash Method",
                desc: "Pressed hard on a ripping-hot grill for that signature crust and juicy centre.",
              },
              {
                icon: "🚀",
                title: "Order Online",
                desc: "On Grab, Line, or direct — your order, your way, every night.",
              },
              {
                icon: "⭐",
                title: "Members Get More",
                desc: "Exclusive deals, early access, and loyalty rewards for our regulars.",
              },
            ].map((card) => (
              <div
                key={card.title}
                className="p-6 rounded-sm border border-white/10 hover:border-yellow-400/40 transition-all"
                style={{ background: "#111" }}
              >
                <div className="text-3xl mb-4">{card.icon}</div>
                <h3 className="text-base font-bold text-white mb-2">{card.title}</h3>
                <p className="text-sm text-white/50 leading-relaxed">{card.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Featured Menu */}
      {featured.length > 0 && (
        <section className="py-20 px-4 bg-black">
          <div className="max-w-6xl mx-auto">
            <div className="flex flex-wrap items-end justify-between gap-4 mb-12">
              <div>
                <h2 className="text-3xl md:text-4xl font-black text-white mb-2">
                  THE MENU
                </h2>
                <p className="text-white/50 text-sm">Crafted fresh. Available every night.</p>
              </div>
              <Link
                to="/website/online-ordering"
                className="text-sm font-bold hover:opacity-80 transition-opacity flex items-center gap-1"
                style={{ color: SBB_YELLOW }}
              >
                See full menu <ChevronRight className="h-4 w-4" />
              </Link>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {featured.map((item: any) => (
                <div
                  key={item.id}
                  className="rounded-sm border border-white/10 overflow-hidden hover:border-yellow-400/30 transition-all"
                  style={{ background: "#111" }}
                >
                  {item.image && (
                    <div className="aspect-video w-full overflow-hidden">
                      <img
                        src={item.image}
                        alt={item.name}
                        className="w-full h-full object-cover"
                      />
                    </div>
                  )}
                  {!item.image && (
                    <div
                      className="aspect-video w-full flex items-center justify-center text-4xl"
                      style={{ background: "#1a1a1a" }}
                    >
                      🍔
                    </div>
                  )}
                  <div className="p-4">
                    <div className="flex items-start justify-between gap-2">
                      <h3 className="text-sm font-bold text-white">{item.name}</h3>
                      <span
                        className="text-xs font-bold px-2 py-1 rounded-sm flex-shrink-0"
                        style={{ background: SBB_YELLOW, color: "#000" }}
                      >
                        ฿{(item.price / 100).toFixed(0)}
                      </span>
                    </div>
                    {item.description && (
                      <p className="text-xs text-white/50 mt-2 leading-relaxed line-clamp-2">
                        {item.description}
                      </p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* Static menu teaser if no API data */}
      {featured.length === 0 && (
        <section className="py-20 px-4 bg-black">
          <div className="max-w-6xl mx-auto text-center">
            <h2 className="text-3xl md:text-4xl font-black text-white mb-6">THE MENU</h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-10">
              {[
                { name: "The Classic Smash", price: "฿159", emoji: "🍔", desc: "Double smash patty, American cheese, pickles, house sauce" },
                { name: "Truffle Smash", price: "฿209", emoji: "🧀", desc: "Truffle mayo, caramelised onions, gruyere, crispy shallots" },
                { name: "Spicy Habanero", price: "฿179", emoji: "🌶️", desc: "Habanero sauce, jalapeños, pepper jack cheese, chipotle aioli" },
              ].map((item) => (
                <div
                  key={item.name}
                  className="rounded-sm border border-white/10 overflow-hidden hover:border-yellow-400/30 transition-all"
                  style={{ background: "#111" }}
                >
                  <div
                    className="aspect-video w-full flex items-center justify-center text-5xl"
                    style={{ background: "#1a1a1a" }}
                  >
                    {item.emoji}
                  </div>
                  <div className="p-4">
                    <div className="flex items-start justify-between gap-2">
                      <h3 className="text-sm font-bold text-white">{item.name}</h3>
                      <span
                        className="text-xs font-bold px-2 py-1 rounded-sm flex-shrink-0"
                        style={{ background: SBB_YELLOW, color: "#000" }}
                      >
                        {item.price}
                      </span>
                    </div>
                    <p className="text-xs text-white/50 mt-2 leading-relaxed">{item.desc}</p>
                  </div>
                </div>
              ))}
            </div>
            <Link
              to="/website/online-ordering"
              className="inline-flex items-center gap-2 px-8 py-4 text-base font-bold rounded-sm hover:opacity-90 transition-all"
              style={{ background: SBB_YELLOW, color: "#000" }}
            >
              ORDER NOW <ChevronRight className="h-4 w-4" />
            </Link>
          </div>
        </section>
      )}

      {/* Location Banner */}
      <section
        className="py-16 px-4"
        style={{ background: SBB_YELLOW }}
      >
        <div className="max-w-4xl mx-auto flex flex-col md:flex-row items-center justify-between gap-6 text-center md:text-left">
          <div>
            <h2 className="text-2xl md:text-3xl font-black text-black mb-2">
              OPEN EVERY NIGHT
            </h2>
            <p className="text-sm font-semibold text-black/60">
              Bangkok · 5:00 PM – 3:00 AM · Available on Grab & Line
            </p>
          </div>
          <Link
            to="/website/online-ordering"
            className="inline-flex items-center gap-2 px-8 py-4 text-sm font-bold rounded-sm bg-black text-white hover:bg-black/80 transition-all flex-shrink-0"
          >
            ORDER ONLINE <ChevronRight className="h-4 w-4" />
          </Link>
        </div>
      </section>

      <PublicFooter />
    </div>
  );
}
