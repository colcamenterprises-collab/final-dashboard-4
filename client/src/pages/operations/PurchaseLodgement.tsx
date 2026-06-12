import { PurchaseTallyList } from "@/components/PurchaseTallyList";

export default function PurchaseLodgement() {
  return (
    <div className="p-4 md:p-6 space-y-4">
      <div>
        <h1 className="text-xl font-semibold text-slate-900">Purchase Lodgement</h1>
        <p className="text-sm text-slate-500 mt-0.5">
          Record stock bought outside the shift. Data feeds rolls, meat, fries, sweet potato, and drinks reconciliation.
        </p>
      </div>
      <PurchaseTallyList />
    </div>
  );
}
