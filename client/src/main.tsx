import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";
import { initTabletFixes } from "./utils/tabletFix";

// Force tablet cache clearing before app loads
const isTablet = window.innerWidth >= 768 && window.innerWidth <= 1024;
if (isTablet) {
  console.log('MAIN.TSX: Tablet detected - applying nuclear fixes');
  
  // Clear everything possible
  localStorage.clear();
  sessionStorage.clear();
  
  // Force style refresh
  const links = document.querySelectorAll('link[rel="stylesheet"]');
  links.forEach(link => {
    const href = link.getAttribute('href');
    if (href && !href.includes('?v=')) {
      (link as HTMLLinkElement).href = href + '?v=' + Date.now();
    }
  });
  
  // Add aggressive override styles directly to document
  const styleOverride = document.createElement('style');
  styleOverride.innerHTML = `
    /* TABLET NUCLEAR OVERRIDE - FORCE RESPONSIVE DESIGN */
    @media screen and (min-width: 768px) and (max-width: 1024px) {
      /* Force remove all Number Needed text */
      input::placeholder {
        color: transparent !important;
      }
      input[placeholder*="Number"] {
        placeholder: "" !important;
      }
      
      /* Force all text to be smaller on tablets */
      * {
        font-size: 0.875rem !important;
      }
      h1 { font-size: 1.5rem !important; }
      h2 { font-size: 1.25rem !important; }
      h3 { font-size: 1.125rem !important; }
      
      /* Force responsive grid layouts */
      .grid {
        display: grid !important;
        grid-template-columns: repeat(2, 1fr) !important;
        gap: 0.75rem !important;
      }
      
      /* Force modern styling */
      .card, [class*="card"] {
        background: white !important;
        border-radius: 0.5rem !important;
        box-shadow: 0 1px 3px rgba(0,0,0,0.1) !important;
        padding: 1rem !important;
      }
      
      /* Force sidebar to be responsive */
      nav, aside, [class*="sidebar"] {
        width: 250px !important;
      }
    }
  `;
  document.head.appendChild(styleOverride);
}

// Initialize tablet fixes for responsive design
initTabletFixes();

createRoot(document.getElementById("root")!).render(<App />);
