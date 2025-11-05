import { useEffect, useRef, useState } from 'react';
import JsBarcode from 'jsbarcode';

type Member = {
  id: string;
  name: string;
  email: string;
  phone: string;
  totalSpend: number;
};

type NewMember = {
  name: string;
  email: string;
  phone: string;
};

const Icon = (props: React.SVGProps<SVGSVGElement>) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" {...props} />
);
const UserIcon = (p: any) => (
  <Icon {...p}><path strokeWidth="1.5" d="M16 7a4 4 0 11-8 0 4 4 0 018 0z" /><path strokeWidth="1.5" d="M12 14c-5 0-8 2.5-8 5v1h16v-1c0-2.5-3-5-8-5z" /></Icon>
);
const EmailIcon = (p: any) => (
  <Icon {...p}><path strokeWidth="1.5" d="M4 6h16v12H4z" /><path strokeWidth="1.5" d="M4 7l8 6 8-6" /></Icon>
);
const PhoneIcon = (p: any) => (
  <Icon {...p}><path strokeWidth="1.5" d="M22 16.92V21a1 1 0 01-1.09 1 19.86 19.86 0 01-8.63-3.07 19.5 19.5 0 01-6-6A19.86 19.86 0 013 3.09 1 1 0 014 2h4.09A1 1 0 019 2.91a12.66 12.66 0 00.7 2.18 1 1 0 01-.23 1.11L8.09 7.5a16 16 0 006 6l1.3-1.38a1 1 0 011.11-.23 12.66 12.66 0 002.18.7A1 1 0 0119 13.91V18a1 1 0 01-1 1z"/></Icon>
);
const CardIcon = (p: any) => (
  <Icon {...p}><rect x="2" y="5" width="20" height="14" rx="2" strokeWidth="1.5" /><path strokeWidth="1.5" d="M2 10h20" /></Icon>
);

async function apiRegister(newMember: NewMember): Promise<Member | null> {
  try {
    const r = await fetch('/api/membership/register', {
      method: 'POST',
      headers: {'Content-Type':'application/json'},
      body: JSON.stringify(newMember),
    });
    if (!r.ok) throw new Error('register failed');
    return await r.json();
  } catch {
    return null;
  }
}

const Barcode: React.FC<{ value: string; className?: string }> = ({ value, className }) => {
  const ref = useRef<SVGSVGElement>(null);
  useEffect(() => {
    if (ref.current) {
      JsBarcode(ref.current, value, {
        displayValue: true,
        fontSize: 14,
        margin: 8,
        height: 48,
      });
    }
  }, [value]);
  return <svg ref={ref} className={className} />;
};

const MemberCard: React.FC<{ member: Member }> = ({ member }) => {
  return (
    <div className="w-96 h-60 bg-gradient-to-br from-neutral-900 to-neutral-800 rounded-2xl p-5 flex flex-col justify-between text-white relative overflow-hidden shadow-xl">
      <div className="absolute -top-10 -right-10 w-40 h-40 bg-yellow-400/10 rounded-full blur-2xl" />
      <div className="absolute -bottom-12 -left-12 w-32 h-32 bg-yellow-400/20 rounded-full blur-xl" />
      <div className="z-10 flex justify-between items-start">
        <div>
          <div className="text-xs uppercase tracking-widest text-neutral-300">Smash Brothers Burgers</div>
          <div className="text-2xl font-black mt-1">Membership</div>
        </div>
        <CardIcon className="w-8 h-8 text-yellow-400" />
      </div>
      <div className="z-10">
        <div className="text-lg font-semibold">{member.name}</div>
        <div className="text-sm text-neutral-300">{member.email}</div>
        <div className="text-sm text-neutral-300">{member.phone}</div>
      </div>
      <div className="z-10">
        <Barcode value={member.id} />
      </div>
    </div>
  );
};

export default function MemberRegistration() {
  const [form, setForm] = useState<NewMember>({ name: '', email: '', phone: '' });
  const [status, setStatus] = useState<'idle'|'submitting'|'success'|'error'>('idle');
  const [err, setErr] = useState<string| null>(null);
  const [savedMember, setSavedMember] = useState<Member | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name || !form.email || !form.phone) {
      setErr('All fields are required.');
      return;
    }
    setErr(null);
    setStatus('submitting');
    try {
      const member = await apiRegister(form);
      if (member) {
        setSavedMember(member);
        setForm({ name: '', email: '', phone: '' });
        setStatus('success');
      } else {
        setStatus('error');
        setErr('Failed to register member. Please try again.');
      }
    } catch (e) {
      setStatus('error');
      setErr('Failed to register member. Please try again.');
    }
  };

  if (status === 'success' && savedMember) {
    return (
      <div className="min-h-screen bg-white p-4 sm:p-6 lg:p-8">
        <div className="max-w-7xl mx-auto">
          <div className="bg-neutral-900 p-8 rounded-xl shadow-2xl max-w-lg mx-auto text-center">
            <h2 className="text-3xl font-black text-green-400 mb-3">Welcome!</h2>
            <p className="text-neutral-300 mb-6">
              Registration complete. This is your digital membership card. Save it to your photos.
            </p>
            <div className="scale-105 mx-auto w-fit">
              <MemberCard member={savedMember} />
            </div>
            <button 
              onClick={() => { setStatus('idle'); setSavedMember(null); }} 
              className="mt-8 px-4 py-2 bg-yellow-400 text-black rounded-md font-semibold"
              data-testid="button-register-another"
            >
              Register Another
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white p-4 sm:p-6 lg:p-8">
      <div className="max-w-7xl mx-auto">
        <header className="mb-6">
          <div className="flex items-center gap-3">
            <span className="inline-flex items-center justify-center w-10 h-10 rounded-full bg-yellow-400 text-black font-black">SBB</span>
            <h1 className="text-2xl sm:text-3xl font-black">New Member Registration</h1>
          </div>
        </header>

        <div className="max-w-lg mx-auto bg-neutral-900 p-8 rounded-xl shadow-2xl">
          <h2 className="text-3xl font-black text-center text-yellow-400 mb-2">Join the Club</h2>
          <p className="text-center text-neutral-400 mb-6">Fill out your details to get your digital card.</p>
          <form onSubmit={submit} noValidate className="space-y-4">
            <div className="relative">
              <label htmlFor="name" className="sr-only">Full Name</label>
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <UserIcon className="h-5 w-5 text-neutral-400" />
              </div>
              <input
                id="name"
                name="name"
                value={form.name}
                onChange={(e) => setForm(f => ({...f, name: e.target.value}))}
                placeholder="Full Name"
                className="w-full bg-neutral-800 border border-neutral-700 rounded-md pl-10 pr-3 py-2 text-white focus:outline-none focus:ring-2 focus:ring-yellow-400"
                required
                data-testid="input-member-name"
              />
            </div>
            <div className="relative">
              <label htmlFor="email" className="sr-only">Email</label>
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <EmailIcon className="h-5 w-5 text-neutral-400" />
              </div>
              <input
                id="email"
                name="email"
                type="email"
                value={form.email}
                onChange={(e) => setForm(f => ({...f, email: e.target.value}))}
                placeholder="Email Address"
                className="w-full bg-neutral-800 border border-neutral-700 rounded-md pl-10 pr-3 py-2 text-white focus:outline-none focus:ring-2 focus:ring-yellow-400"
                required
                data-testid="input-member-email"
              />
            </div>
            <div className="relative">
              <label htmlFor="phone" className="sr-only">Phone</label>
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <PhoneIcon className="h-5 w-5 text-neutral-400" />
              </div>
              <input
                id="phone"
                name="phone"
                inputMode="tel"
                value={form.phone}
                onChange={(e) => setForm(f => ({...f, phone: e.target.value}))}
                placeholder="Phone Number"
                className="w-full bg-neutral-800 border border-neutral-700 rounded-md pl-10 pr-3 py-2 text-white focus:outline-none focus:ring-2 focus:ring-yellow-400"
                required
                data-testid="input-member-phone"
              />
            </div>
            {err && <div className="text-red-400 text-sm">{err}</div>}
            <button
              type="submit"
              disabled={status === 'submitting'}
              className="w-full py-2 rounded-md bg-yellow-400 text-black font-semibold hover:bg-yellow-300 disabled:opacity-70"
              data-testid="button-submit-registration"
            >
              {status === 'submitting' ? 'Submitting…' : 'Register'}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
