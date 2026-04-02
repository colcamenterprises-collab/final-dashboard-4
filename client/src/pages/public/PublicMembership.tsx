import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Menu, X, ChevronRight, Star, Zap, Gift } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/auth/AuthProvider";

const SBB_YELLOW = "#FFEB00";

function PublicNav({ onNavigate }: { onNavigate?: () => void }) {
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
          <Link
            to="/website/membership"
            className="text-sm font-semibold transition-colors"
            style={{ color: SBB_YELLOW }}
          >
            Membership
          </Link>
          <Link
            to="/website/online-ordering"
            className="px-4 py-2 text-sm font-bold rounded-sm transition-all hover:opacity-90"
            style={{ background: SBB_YELLOW, color: "#000" }}
          >
            ORDER NOW
          </Link>
        </div>
        <button className="md:hidden p-2 text-white" onClick={() => setOpen(!open)}>
          {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </button>
      </div>
      {open && (
        <div className="md:hidden bg-black border-t border-white/10 px-4 pb-4 space-y-3 pt-3">
          <Link to="/website" className="block text-sm font-semibold text-white py-2" onClick={() => setOpen(false)}>Home</Link>
          <Link to="/website/online-ordering" className="block text-sm font-semibold text-white py-2" onClick={() => setOpen(false)}>Menu</Link>
          <Link to="/website/membership" className="block text-sm font-bold py-2" style={{ color: SBB_YELLOW }} onClick={() => setOpen(false)}>Membership</Link>
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

function LoginForm() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();
  const navigate = useNavigate();
  const { login } = useAuth();

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      await login(email, password);
      toast({ title: "Welcome back!", description: "Redirecting to your dashboard." });
      navigate("/dashboard", { replace: true });
    } catch (err: any) {
      toast({ title: "Login failed", description: err.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={submit} className="space-y-4">
      <div>
        <label className="block text-xs font-semibold text-white/70 uppercase tracking-wider mb-2">
          Email
        </label>
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="you@example.com"
          required
          className="w-full px-4 py-3 rounded-sm text-sm bg-white/5 border border-white/20 text-white placeholder-white/30 focus:outline-none focus:border-yellow-400 transition-colors"
        />
      </div>
      <div>
        <label className="block text-xs font-semibold text-white/70 uppercase tracking-wider mb-2">
          Password
        </label>
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="••••••••"
          required
          className="w-full px-4 py-3 rounded-sm text-sm bg-white/5 border border-white/20 text-white placeholder-white/30 focus:outline-none focus:border-yellow-400 transition-colors"
        />
      </div>
      <button
        type="submit"
        disabled={loading}
        className="w-full py-3 text-sm font-bold rounded-sm transition-all hover:opacity-90 disabled:opacity-60"
        style={{ background: SBB_YELLOW, color: "#000" }}
      >
        {loading ? "Signing in..." : "SIGN IN →"}
      </button>
    </form>
  );
}

export default function PublicMembership() {
  return (
    <div className="min-h-screen bg-black" style={{ fontFamily: "'Poppins', sans-serif" }}>
      <PublicNav />

      {/* Hero */}
      <section className="pt-28 pb-16 px-4 relative overflow-hidden" style={{ background: "#0a0a0a" }}>
        <div
          className="absolute inset-0 opacity-10 pointer-events-none"
          style={{ backgroundImage: "radial-gradient(circle at 30% 50%, #FFEB00 0%, transparent 60%)" }}
        />
        <div className="relative z-10 max-w-5xl mx-auto">
          <div className="text-center mb-12">
            <div
              className="inline-block text-xs font-bold tracking-[0.3em] uppercase px-4 py-1.5 mb-6 rounded-sm"
              style={{ background: SBB_YELLOW, color: "#000" }}
            >
              Members Club
            </div>
            <h1 className="text-4xl md:text-6xl font-black text-white mb-4 leading-tight">
              JOIN THE{" "}
              <span style={{ color: SBB_YELLOW }}>CREW.</span>
            </h1>
            <p className="text-base text-white/60 max-w-md mx-auto">
              Exclusive deals, early access to new menu items, and rewards for our most loyal customers.
            </p>
          </div>

          {/* Benefits */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-14">
            {[
              { icon: Star, title: "Loyalty Points", desc: "Earn points on every order. Redeem for free burgers." },
              { icon: Zap, title: "Early Access", desc: "Be first to try new menu items and limited drops." },
              { icon: Gift, title: "Exclusive Deals", desc: "Member-only discounts and birthday rewards." },
            ].map(({ icon: Icon, title, desc }) => (
              <div
                key={title}
                className="p-5 rounded-sm border border-white/10 hover:border-yellow-400/30 transition-all flex gap-4 items-start"
                style={{ background: "#111" }}
              >
                <div
                  className="p-2 rounded-sm flex-shrink-0"
                  style={{ background: SBB_YELLOW + "22" }}
                >
                  <Icon className="h-4 w-4" style={{ color: SBB_YELLOW }} />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-white mb-1">{title}</h3>
                  <p className="text-xs text-white/50 leading-relaxed">{desc}</p>
                </div>
              </div>
            ))}
          </div>

          {/* Login Card */}
          <div className="max-w-md mx-auto">
            <div
              className="p-8 rounded-sm border border-white/10"
              style={{ background: "#111" }}
            >
              <h2 className="text-xl font-black text-white mb-1">Member Sign In</h2>
              <p className="text-xs text-white/50 mb-6">
                Staff and member access. Not registered?{" "}
                <Link
                  to="/membership/register"
                  className="font-semibold hover:opacity-80 transition-opacity"
                  style={{ color: SBB_YELLOW }}
                >
                  Register here
                </Link>
              </p>
              <LoginForm />
              <div className="mt-4 text-center">
                <Link to="/login" className="text-xs text-white/40 hover:text-white/70 transition-colors">
                  Staff dashboard login →
                </Link>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* CTA strip */}
      <section className="py-14 px-4" style={{ background: SBB_YELLOW }}>
        <div className="max-w-4xl mx-auto flex flex-col md:flex-row items-center justify-between gap-6 text-center md:text-left">
          <div>
            <h2 className="text-2xl font-black text-black mb-1">HUNGRY RIGHT NOW?</h2>
            <p className="text-sm font-medium text-black/60">Skip the queue — order online for pickup or delivery.</p>
          </div>
          <Link
            to="/website/online-ordering"
            className="inline-flex items-center gap-2 px-8 py-4 text-sm font-bold rounded-sm bg-black text-white hover:bg-black/80 transition-all flex-shrink-0"
          >
            ORDER ONLINE <ChevronRight className="h-4 w-4" />
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-black border-t border-white/10 py-8 px-4">
        <div className="max-w-6xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <span className="text-sm font-black" style={{ color: SBB_YELLOW }}>SMASH BROTHERS</span>
            <span className="text-sm font-black text-white">BURGERS</span>
          </div>
          <div className="flex items-center gap-6">
            <Link to="/website" className="text-xs text-white/50 hover:text-white transition-colors">Home</Link>
            <Link to="/website/online-ordering" className="text-xs text-white/50 hover:text-white transition-colors">Order</Link>
            <Link to="/login" className="text-xs text-white/50 hover:text-white transition-colors">Staff Login</Link>
          </div>
          <p className="text-xs text-white/30">© {new Date().getFullYear()} Smash Brothers Burgers</p>
        </div>
      </footer>
    </div>
  );
}
