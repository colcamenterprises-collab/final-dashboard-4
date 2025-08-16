export default function CostCalculator() {
  return (
    <div>
      <h1 className="text-2xl font-extrabold mb-2">Cost Calculator</h1>
      <p className="text-neutral-600 mb-4">Calculate recipe costs with Chef Ramsay AI.</p>
      <div className="rounded-2xl border bg-white p-5 shadow-sm">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <label className="text-sm font-medium">Recipe Name
            <input className="mt-1 w-full border rounded-xl px-3 py-2" placeholder="e.g., Double Smash"/>
          </label>
          <label className="text-sm font-medium">Yield (servings)
            <input type="number" className="mt-1 w-full border rounded-xl px-3 py-2" defaultValue={1}/>
          </label>
          <label className="text-sm font-medium">Target Margin %
            <input type="number" className="mt-1 w-full border rounded-xl px-3 py-2" defaultValue={70}/>
          </label>
        </div>
        <div className="mt-4">
          <button className="px-3 py-2 border rounded-xl">Add Ingredient</button>
          <button className="ml-2 px-3 py-2 border rounded-xl bg-emerald-600 text-white">Calculate</button>
        </div>
        <div className="mt-4 text-sm text-neutral-500">
          (We'll hook this to Ingredients + Chef Ramsay chat when you're ready.)
        </div>
      </div>
    </div>
  );
}