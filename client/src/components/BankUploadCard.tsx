import React, { useState, useRef } from "react";

type Props = {
  onImported?: () => void;
};

export default function BankUploadCard({ onImported }: Props) {
  const [bank, setBank] = useState<"generic">("generic");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const fileInput = useRef<HTMLInputElement | null>(null);

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    if (busy) return;
    const f = e.dataTransfer.files?.[0];
    if (f) await sendFile(f);
  };

  const sendFile = async (file: File) => {
    setBusy(true);
    setMsg(null);
    try {
      const fd = new FormData();
      fd.append("file", file);

      // CSV -> /csv, PDF -> /pdf
      const isPDF =
        file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf");
      const url = isPDF
        ? "/api/bank-imports/pdf"
        : "/api/bank-imports/csv";

      const res = await fetch(url, {
        method: "POST",
        body: fd,
      });

      if (!res.ok) {
        const text = await res.text();
        throw new Error(text || `Upload failed: ${res.status}`);
      }
      setMsg("Upload queued. Review & approve in the list below.");
      onImported?.();
    } catch (err: any) {
      setMsg(err.message || "Upload failed");
    } finally {
      setBusy(false);
    }
  };

  const onSelectFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (f) await sendFile(f);
  };

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-5">
      <div className="flex items-center justify-between mb-3">
        <div>
          <h3 className="text-xl font-semibold">Bank Statement Upload</h3>
          <p className="text-sm text-gray-500">
            Upload CSV or PDF statements to create expense entries. Approve / Edit / Delete after import.
          </p>
        </div>
      </div>

      <div className="mb-4">
        <label className="block text-xs font-medium text-gray-500 mb-1">Bank Source</label>
        <select
          className="w-full rounded-lg border border-gray-300 px-3 py-2"
          value={bank}
          onChange={() => setBank("generic")}
        >
          <option value="generic">Generic CSV / PDF</option>
        </select>
      </div>

      <div
        onDrop={handleDrop}
        onDragOver={(e) => e.preventDefault()}
        className={`border-2 border-dashed rounded-xl p-8 text-center ${
          busy ? "opacity-60" : ""
        }`}
      >
        <div className="text-4xl mb-2">📄</div>
        <div className="text-gray-700 font-medium">
          Drag & drop a <b>CSV or PDF</b> here,
        </div>
        <div className="text-gray-500 mb-3">or click to select</div>

        <button
          className="inline-flex items-center rounded-lg bg-black text-white px-4 py-2 text-sm"
          onClick={() => fileInput.current?.click()}
          disabled={busy}
        >
          {busy ? "Uploading…" : "Choose file"}
        </button>

        <input
          ref={fileInput}
          type="file"
          accept=".csv,application/pdf"
          className="hidden"
          onChange={onSelectFile}
        />
      </div>

      {msg && (
        <div className="mt-3 text-sm text-gray-700">
          {msg}
        </div>
      )}

      <p className="text-xs text-gray-400 mt-4">
        Expected CSV columns (Generic): <b>Date, Description, Amount (THB)</b>.
        PDFs will be parsed automatically (beta).
      </p>
    </div>
  );
}