export default function UploadStatements() {
  return (
    <div>
      <h1 className="text-2xl font-extrabold mb-2">Upload Statements</h1>
      <p className="text-neutral-600 mb-4">Attach bank/POS statements for reconciliation.</p>
      <div className="rounded-2xl border bg-white p-5 shadow-sm">
        <input type="file" className="block mb-3" multiple />
        <button className="px-3 py-2 border rounded-xl">Upload</button>
      </div>
    </div>
  );
}