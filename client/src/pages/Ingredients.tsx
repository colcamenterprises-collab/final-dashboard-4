export default function Ingredients() {
  return (
    <div>
      <h1 className="text-2xl font-extrabold mb-2">Ingredients</h1>
      <p className="text-neutral-600 mb-4">Ingredient master with units & latest costs.</p>
      <div className="rounded-2xl border bg-white p-5 shadow-sm">
        <button className="px-3 py-2 border rounded-xl">Add Ingredient</button>
        <div className="mt-4 text-sm text-neutral-500">
          (Connect to supplier uploads / Expenses to auto-update costs.)
        </div>
      </div>
    </div>
  );
}