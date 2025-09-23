import { useState } from "react";

export default function ShiftSummary() {
  const [message, setMessage] = useState("");

  const handleUpload = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const res = await fetch("/api/pos/upload", {
      method: "POST",
      body: formData,
    });
    const data = await res.json();
    setMessage(JSON.stringify(data, null, 2));
  };

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-4">Shift Summary Upload</h1>
      <form onSubmit={handleUpload} className="space-y-4">
        <input type="file" name="file" className="border p-2" />
        <button
          type="submit"
          className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700"
        >
          Upload
        </button>
      </form>
      {message && (
        <pre className="mt-4 p-4 bg-gray-100 border rounded">{message}</pre>
      )}
    </div>
  );
}