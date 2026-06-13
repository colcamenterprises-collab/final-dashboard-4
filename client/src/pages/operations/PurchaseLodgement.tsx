import { PurchaseTallyList } from "@/components/PurchaseTallyList";
import { PageTitle } from "@/components/ui/sbb-cards";

export default function PurchaseLodgement() {
  return (
    <div className="space-y-5 max-w-5xl mx-auto">
      <PageTitle
        title="Purchase Lodgement"
        meta="Record stock bought outside the shift — feeds rolls, meat, fries, sweet potato, and drinks reconciliation"
      />
      <PurchaseTallyList hideHeader />
    </div>
  );
}
