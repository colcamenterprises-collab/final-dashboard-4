export async function uploadImage(file: File): Promise<string> {
  const fd = new FormData();
  fd.append("image", file);
  
  const response = await fetch("/api/upload/image", { 
    method: "POST", 
    body: fd 
  });
  
  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: "Upload failed" }));
    throw new Error(error.error || "Upload failed");
  }
  
  const { url } = await response.json();
  return url as string;
}

export async function importMenuCSV(file: File, source: "loyverse" | "grab" = "loyverse", mode: "items" | "modifiers" | "sales" = "items") {
  const fd = new FormData();
  fd.append("file", file);
  
  const response = await fetch(`/api/import/menu?source=${source}&mode=${mode}`, {
    method: "POST",
    body: fd
  });
  
  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: "Import failed" }));
    throw new Error(error.error || "Import failed");
  }
  
  return await response.json();
}

export async function commitMenuImport(data: {
  rows: any[];
  mappings: Record<string, string>;
  source: string;
  mode: string;
}) {
  const response = await fetch("/api/import/menu/commit", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data)
  });
  
  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: "Import commit failed" }));
    throw new Error(error.error || "Import commit failed");
  }
  
  return await response.json();
}