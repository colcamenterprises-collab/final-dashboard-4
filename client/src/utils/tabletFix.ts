// Tablet-specific fixes to ensure responsive design changes flow through
export const initTabletFixes = () => {
  // Force viewport recalculation on tablets
  if (window.innerWidth >= 768 && window.innerWidth <= 1024) {
    console.log('Tablet detected - applying aggressive cache fixes');
    
    // Add tablet-specific class to body
    document.body.classList.add('tablet-device');
    
    // Clear all browser caches aggressively
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.getRegistrations().then(registrations => {
        registrations.forEach(registration => registration.unregister());
      });
    }
    
    // Clear localStorage and sessionStorage
    localStorage.clear();
    sessionStorage.clear();
    
    // Force CSS reload with timestamp
    const timestamp = Date.now();
    const links = document.querySelectorAll('link[rel="stylesheet"]');
    links.forEach(link => {
      const href = link.getAttribute('href');
      if (href) {
        (link as HTMLLinkElement).href = href.split('?')[0] + '?v=' + timestamp;
      }
    });
    
    // Add aggressive tablet-specific styles
    const style = document.createElement('style');
    style.id = 'tablet-override-styles';
    style.textContent = `
      /* AGGRESSIVE TABLET OVERRIDES - FORCE RESPONSIVE DESIGN */
      @media screen and (min-width: 768px) and (max-width: 1024px) {
        /* Remove all Number Needed placeholders on tablets */
        input[placeholder*="Number Needed"] {
          placeholder: "" !important;
        }
        
        /* Force responsive font sizes */
        .text-xs { font-size: 0.75rem !important; }
        .text-sm { font-size: 0.875rem !important; }
        .text-base { font-size: 1rem !important; }
        .text-lg { font-size: 1.125rem !important; }
        .text-xl { font-size: 1.25rem !important; }
        
        .sm\\:text-xs { font-size: 0.75rem !important; }
        .sm\\:text-sm { font-size: 0.875rem !important; }
        .sm\\:text-base { font-size: 1rem !important; }
        .sm\\:text-lg { font-size: 1.125rem !important; }
        .sm\\:text-xl { font-size: 1.25rem !important; }
        
        /* Force responsive spacing */
        .sm\\:p-3 { padding: 0.75rem !important; }
        .sm\\:p-4 { padding: 1rem !important; }
        .sm\\:p-6 { padding: 1.5rem !important; }
        
        .sm\\:mb-4 { margin-bottom: 1rem !important; }
        .sm\\:mb-6 { margin-bottom: 1.5rem !important; }
        
        .sm\\:gap-2 { gap: 0.5rem !important; }
        .sm\\:gap-3 { gap: 0.75rem !important; }
        .sm\\:gap-4 { gap: 1rem !important; }
        
        /* Force responsive grids */
        .sm\\:grid-cols-2 { grid-template-columns: repeat(2, minmax(0, 1fr)) !important; }
        .sm\\:grid-cols-3 { grid-template-columns: repeat(3, minmax(0, 1fr)) !important; }
        .sm\\:grid-cols-4 { grid-template-columns: repeat(4, minmax(0, 1fr)) !important; }
        
        /* Force responsive display */
        .sm\\:table-cell { display: table-cell !important; }
        .sm\\:flex-row { flex-direction: row !important; }
        .sm\\:items-center { align-items: center !important; }
        .sm\\:justify-between { justify-content: space-between !important; }
        
        /* Force responsive sizing */
        .sm\\:h-4 { height: 1rem !important; }
        .sm\\:h-5 { height: 1.25rem !important; }
        .sm\\:w-4 { width: 1rem !important; }
        .sm\\:w-5 { width: 1.25rem !important; }
        
        .sm\\:mr-2 { margin-right: 0.5rem !important; }
        
        /* Force modern card styling */
        .card { 
          background: white !important;
          border-radius: 0.5rem !important;
          box-shadow: 0 1px 3px rgba(0,0,0,0.1) !important;
          padding: 1rem !important;
        }
        
        /* Force responsive inputs */
        input, textarea, select {
          font-size: 0.875rem !important;
          padding: 0.5rem !important;
          border-radius: 0.375rem !important;
        }
        
        /* Force responsive buttons */
        button {
          font-size: 0.875rem !important;
          padding: 0.5rem 1rem !important;
          border-radius: 0.375rem !important;
        }
      }
    `;
    
    // Remove any existing tablet styles and add new ones
    const existingStyle = document.getElementById('tablet-override-styles');
    if (existingStyle) {
      existingStyle.remove();
    }
    document.head.appendChild(style);
    
    // Force multiple DOM refreshes
    document.body.style.display = 'none';
    document.body.offsetHeight; // Trigger reflow
    document.body.style.display = '';
    
    // Schedule another refresh after a short delay
    setTimeout(() => {
      document.body.style.visibility = 'hidden';
      document.body.offsetHeight;
      document.body.style.visibility = 'visible';
      console.log('Tablet cache cleared and styles force-applied');
    }, 100);
    
    // Hard reload after 1 second if still on tablet
    setTimeout(() => {
      if (window.innerWidth >= 768 && window.innerWidth <= 1024) {
        console.log('Forcing hard reload for tablet...');
        window.location.reload(true);
      }
    }, 1000);
  }
};

// Force refresh function for tablets
export const forceTabletRefresh = () => {
  if (window.innerWidth >= 768 && window.innerWidth <= 1024) {
    // Clear any cached CSS
    const links = document.querySelectorAll('link[rel="stylesheet"]');
    links.forEach(link => {
      const href = link.getAttribute('href');
      if (href) {
        (link as HTMLLinkElement).href = href + '?v=' + Date.now();
      }
    });
    
    // Force re-render
    setTimeout(() => {
      window.location.reload();
    }, 100);
  }
};