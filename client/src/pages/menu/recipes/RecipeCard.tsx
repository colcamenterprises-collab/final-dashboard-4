import { useMemo, useRef } from "react";
import jsPDF from "jspdf";
import html2canvas from "html2canvas";
import { parseCostingRows, parseStatus, notesWithoutWorkflowData, splitInstructions, type Recipe } from "./recipeTypes";

type Props = { recipe: Recipe; onClose: () => void };

export default function RecipeCard({ recipe, onClose }: Props) {
  const cardRef = useRef<HTMLDivElement>(null);
  const ingredients = useMemo(() => parseCostingRows(recipe), [recipe]);
  const instructions = useMemo(() => splitInstructions(recipe.instructions), [recipe.instructions]);
  const specialNotes = notesWithoutWorkflowData(recipe.notes);

  const printCard = () => window.print();
  const downloadPdf = async () => {
    if (!cardRef.current) return;
    const canvas = await html2canvas(cardRef.current, { scale: 2, backgroundColor: "#ffffff" });
    const image = canvas.toDataURL("image/png");
    const pdf = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
    const pageWidth = pdf.internal.pageSize.getWidth();
    const pageHeight = pdf.internal.pageSize.getHeight();
    const ratio = Math.min(pageWidth / canvas.width, pageHeight / canvas.height);
    const width = canvas.width * ratio;
    const height = canvas.height * ratio;
    pdf.addImage(image, "PNG", (pageWidth - width) / 2, 8, width, height);
    pdf.save(`${recipe.name || "recipe"}-recipe-card.pdf`);
  };

  return <div className="fixed inset-0 z-[100] overflow-y-auto bg-black/50 p-3 print:static print:bg-white print:p-0">
    <div className="mx-auto mb-3 flex max-w-4xl justify-end gap-2 print:hidden">
      <button onClick={onClose} className="rounded-lg border bg-white px-4 py-2 text-sm">Close</button>
      <button onClick={printCard} className="rounded-lg border bg-white px-4 py-2 text-sm">Print</button>
      <button onClick={downloadPdf} className="rounded-lg bg-black px-4 py-2 text-sm text-white">Download PDF</button>
    </div>
    <article ref={cardRef} className="mx-auto min-h-[1120px] max-w-4xl bg-white p-8 text-slate-950 shadow-xl print:min-h-0 print:max-w-none print:shadow-none">
      <header className="grid grid-cols-1 gap-6 border-b-4 border-black pb-6 sm:grid-cols-[220px_1fr]">
        <div className="flex h-[220px] items-center justify-center overflow-hidden rounded-xl border bg-slate-50">
          {recipe.imageUrl ? <img src={recipe.imageUrl} alt={recipe.name} className="h-full w-full object-contain" /> : <span className="text-sm text-slate-400">No image</span>}
        </div>
        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.18em]">Smash Brothers Burgers</p>
          <h1 className="mt-3 text-4xl font-black leading-tight">{recipe.name}</h1>
          <p className="mt-2 text-base text-slate-600">{recipe.description || "No description provided."}</p>
          <div className="mt-5 grid grid-cols-2 gap-3 text-sm">
            <div><span className="font-semibold">Category:</span> {recipe.category || "—"}</div>
            <div><span className="font-semibold">Status:</span> {parseStatus(recipe)}</div>
            <div><span className="font-semibold">Yield:</span> {recipe.yieldQuantity || 1} {recipe.yieldUnit || "servings"}</div>
            <div><span className="font-semibold">Version:</span> {(recipe as Recipe & { version?: number }).version || 1}</div>
          </div>
        </div>
      </header>

      <section className="mt-7">
        <h2 className="border-b-2 border-black pb-2 text-2xl font-bold">Ingredients</h2>
        <table className="mt-3 w-full border-collapse text-sm">
          <thead><tr className="bg-slate-100"><th className="border p-3 text-left">Ingredient</th><th className="border p-3 text-left">Qty</th><th className="border p-3 text-left">Unit</th><th className="border p-3 text-left">Notes</th></tr></thead>
          <tbody>{ingredients.length === 0 ? <tr><td colSpan={4} className="border p-4 text-slate-500">No ingredients recorded.</td></tr> : ingredients.map((row) => <tr key={row.id}><td className="border p-3 font-medium">{row.name}</td><td className="border p-3">{row.quantityUsed}</td><td className="border p-3">{row.unitUsed}</td><td className="border p-3">{row.notes || "—"}</td></tr>)}</tbody>
        </table>
      </section>

      <section className="mt-7 grid grid-cols-1 gap-6 md:grid-cols-2">
        <div><h2 className="border-b-2 border-black pb-2 text-xl font-bold">Preparation Instructions</h2><div className="mt-3 whitespace-pre-wrap text-sm leading-6">{instructions.preparationInstructions || "No preparation instructions provided."}</div></div>
        <div><h2 className="border-b-2 border-black pb-2 text-xl font-bold">Cooking / Build Instructions</h2><div className="mt-3 whitespace-pre-wrap text-sm leading-6">{instructions.cookingInstructions || "No cooking or build instructions provided."}</div></div>
      </section>

      <section className="mt-7 rounded-xl border-2 border-black p-5">
        <h2 className="text-xl font-bold">Special Notes</h2>
        <div className="mt-2 whitespace-pre-wrap text-sm leading-6">{specialNotes || "No special notes."}</div>
      </section>

      <footer className="mt-10 flex justify-between border-t pt-4 text-xs text-slate-500">
        <span>Internal kitchen recipe card — no costing information</span>
        <span>Recipe ID: {recipe.id}</span>
      </footer>
    </article>
  </div>;
}
