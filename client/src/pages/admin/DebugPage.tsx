import { useEffect, useState } from "react";

export default function DebugPage() {
  const [apiStatus, setApiStatus] = useState<string>("CHECKING...");
  
  useEffect(() => {
    console.log("🟢 DebugPage: RENDER START");
    
    fetch("/api/admin/backup/status")
      .then(res => res.json())
      .then(data => {
        console.log("🟢 API Response:", data);
        setApiStatus("API OK - " + JSON.stringify(data).slice(0, 100));
      })
      .catch(err => {
        console.error("🔴 API Error:", err);
        setApiStatus("API ERROR: " + err.message);
      });
      
    return () => console.log("🟢 DebugPage: UNMOUNT");
  }, []);

  console.log("🟢 DebugPage: RENDERING JSX");

  return (
    <div style={{ padding: "40px", backgroundColor: "#f0fff0", minHeight: "100vh" }}>
      <h1 style={{ fontSize: "32px", color: "green", marginBottom: "20px" }}>
        DEBUG PAGE - FRONTEND WORKING
      </h1>
      
      <div style={{ padding: "20px", backgroundColor: "white", border: "2px solid green", marginBottom: "20px" }}>
        <h2>✅ ROUTER OK</h2>
        <p>React Router is working. Path: {window.location.pathname}</p>
      </div>
      
      <div style={{ padding: "20px", backgroundColor: "white", border: "2px solid blue", marginBottom: "20px" }}>
        <h2>✅ LAYOUT OK</h2>
        <p>This component rendered without PageShell wrapper</p>
      </div>
      
      <div style={{ padding: "20px", backgroundColor: "white", border: "2px solid orange", marginBottom: "20px" }}>
        <h2>API STATUS: {apiStatus}</h2>
      </div>
      
      <div style={{ marginTop: "20px" }}>
        <a href="/" style={{ marginRight: "20px", color: "blue" }}>Go to Home</a>
        <a href="/admin/data-safety" style={{ color: "blue" }}>Go to Data Safety</a>
      </div>
    </div>
  );
}
