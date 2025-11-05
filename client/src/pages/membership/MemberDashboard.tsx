import { useEffect, useMemo, useRef, useState } from 'react';
import JsBarcode from 'jsbarcode';

type Member = {
  id: string;
  name: string;
  email: string;
  phone: string;
  totalSpend: number;
};

const Icon = (props: React.SVGProps<SVGSVGElement>) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" {...props} />
);
const CardIcon = (p: any) => (
  <Icon {...p}><rect x="2" y="5" width="20" height="14" rx="2" strokeWidth="1.5" /><path strokeWidth="1.5" d="M2 10h20" /></Icon>
);
const MoneyIcon = (p: any) => (
  <Icon {...p}><rect x="3" y="7" width="18" height="10" rx="2" strokeWidth="1.5"/><path strokeWidth="1.5" d="M7 12h10M9 10v4m6-4v4"/></Icon>
);
const CloseIcon = (p: any) => (
  <Icon {...p}><path strokeWidth="1.5" d="M6 6l12 12M18 6L6 18"/></Icon>
);

async function apiAddSpend(id: string, amount: number) {
  try {
    const r = await fetch(`/api/membership/${id}/spend`, {
      method: 'POST',
      headers: {'Content-Type':'application/json'},
      body: JSON.stringify({ amount }),
    });
    return r.ok;
  } catch {
    return false;
  }
}

async function fetchMembers(): Promise<Member[]> {
  try {
    const r = await fetch('/api/membership/list');
    if (!r.ok) throw new Error('fetch failed');
    return await r.json();
  } catch {
    return [];
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

const AddSpendModal: React.FC<{
  member: Member;
  onClose: () => void;
  onConfirm: (amount: number) => void;
}> = ({ member, onClose, onConfirm }) => {
  const [amount, setAmount] = useState('');
  const confirm = () => {
    const n = parseFloat(amount);
    if (!isNaN(n) && n > 0) onConfirm(n);
  };
  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div className="bg-neutral-900 rounded-xl shadow-2xl p-6 w-full max-w-md" onClick={e => e.stopPropagation()}>
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-2xl font-black">Add Spend</h3>
          <button onClick={onClose} className="p-1 hover:bg-neutral-800 rounded-md">
            <CloseIcon className="w-6 h-6" />
          </button>
        </div>
        <div className="text-sm text-neutral-300 mb-3">{member.name} — {member.id}</div>
        <input
          type="number"
          inputMode="decimal"
          placeholder="Amount"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          className="w-full bg-neutral-800 border border-neutral-700 rounded-md px-3 py-2 text-white focus:outline-none focus:ring-2 focus:ring-yellow-400"
          data-testid="input-spend-amount"
        />
        <div className="mt-5 flex gap-2 justify-end">
          <button onClick={onClose} className="px-3 py-2 rounded-md bg-neutral-800 border border-neutral-700">Cancel</button>
          <button onClick={confirm} className="px-3 py-2 rounded-md bg-yellow-400 text-black font-semibold" data-testid="button-confirm-spend">Save</button>
        </div>
      </div>
    </div>
  );
};

export default function MemberDashboard() {
  const [members, setMembers] = useState<Member[]>([]);
  const [selected, setSelected] = useState<Member | null>(null);
  const [cardOpen, setCardOpen] = useState(false);
  const [spendOpen, setSpendOpen] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchMembers().then((data) => {
      setMembers(data);
      setLoading(false);
    });
  }, []);

  const openCard = (m: Member) => { setSelected(m); setCardOpen(true); };
  const openSpend = (m: Member) => { setSelected(m); setSpendOpen(true); };

  const addSpend = async (id: string, amount: number) => {
    await apiAddSpend(id, amount);
    setMembers(prev => prev.map(m => m.id === id ? { ...m, totalSpend: m.totalSpend + amount } : m));
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-white p-8">
        <div className="max-w-7xl mx-auto">
          <p className="text-center text-neutral-600">Loading members...</p>
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
            <h1 className="text-2xl sm:text-3xl font-black">Member Dashboard</h1>
          </div>
        </header>

        <div className="overflow-x-auto rounded-xl border border-neutral-800">
          <table className="min-w-full bg-neutral-900 text-white">
            <thead>
              <tr className="border-b border-neutral-800">
                <th className="p-4 text-left text-sm font-black uppercase tracking-wider text-yellow-400">Name</th>
                <th className="p-4 text-left text-sm font-black uppercase tracking-wider text-yellow-400">Member ID</th>
                <th className="p-4 text-left text-sm font-black uppercase tracking-wider text-yellow-400 hidden md:table-cell">Contact</th>
                <th className="p-4 text-right text-sm font-black uppercase tracking-wider text-yellow-400">Spend</th>
                <th className="p-4 text-right text-sm font-black uppercase tracking-wider text-yellow-400">Actions</th>
              </tr>
            </thead>
            <tbody>
              {members.map(m => (
                <tr key={m.id} className="border-b border-neutral-800 hover:bg-neutral-800/50" data-testid={`member-row-${m.id}`}>
                  <td className="p-4">{m.name}</td>
                  <td className="p-4">{m.id}</td>
                  <td className="p-4 hidden md:table-cell">
                    <div className="text-sm text-neutral-300">{m.email}</div>
                    <div className="text-sm text-neutral-300">{m.phone}</div>
                  </td>
                  <td className="p-4 text-right font-semibold">{m.totalSpend.toLocaleString()}</td>
                  <td className="p-4">
                    <div className="flex justify-end gap-2">
                      <button onClick={() => openCard(m)} className="inline-flex items-center gap-2 px-3 py-1.5 bg-neutral-800 border border-neutral-700 rounded-md hover:bg-neutral-700" data-testid={`button-view-card-${m.id}`}>
                        <CardIcon className="w-4 h-4" /><span>Card</span>
                      </button>
                      <button onClick={() => openSpend(m)} className="inline-flex items-center gap-2 px-3 py-1.5 bg-yellow-400 text-black rounded-md hover:bg-yellow-300" data-testid={`button-add-spend-${m.id}`}>
                        <MoneyIcon className="w-4 h-4" /><span>Add Spend</span>
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {members.length === 0 && (
                <tr><td colSpan={5} className="p-6 text-center text-neutral-400">No members yet.</td></tr>
              )}
            </tbody>
          </table>
        </div>

        {cardOpen && selected && (
          <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4" onClick={() => setCardOpen(false)}>
            <div className="bg-neutral-900 rounded-xl p-6 shadow-2xl" onClick={(e) => e.stopPropagation()}>
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-2xl font-black text-white">Membership Card</h3>
                <button onClick={() => setCardOpen(false)} className="p-1 hover:bg-neutral-800 rounded-md text-white">
                  <CloseIcon className="w-6 h-6" />
                </button>
              </div>
              <MemberCard member={selected} />
            </div>
          </div>
        )}
        
        {spendOpen && selected && (
          <AddSpendModal
            member={selected}
            onClose={() => setSpendOpen(false)}
            onConfirm={(amt) => { addSpend(selected.id, amt); setSpendOpen(false); }}
          />
        )}
      </div>
    </div>
  );
}
