export default function NightlyChecklist() {
  return (
    <div>
      <h1 className="text-2xl font-extrabold mb-2">Nightly Checklist</h1>
      <p className="text-neutral-600 mb-4">Randomized 5 tasks, photo on first, shift notes.</p>
      <div className="rounded-2xl border bg-white p-5 shadow-sm">
        <button className="px-3 py-2 border rounded-xl">Start Checklist</button>
        <div className="text-sm text-neutral-500 mt-3">
          (We'll connect this to the Manager Summary email + Library.)
        </div>
      </div>
    </div>
  );
}