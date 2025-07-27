// Tablet-specific fixes to ensure responsive design changes flow through
export const initTabletFixes = () => {
  // Force viewport recalculation on tablets
  if (window.innerWidth >= 768 && window.innerWidth <= 1024) {
    // Add tablet-specific class to body
    document.body.classList.add('tablet-device');
    
    // Force Tailwind CSS recalculation
    const style = document.createElement('style');
    style.textContent = `
      @media screen and (min-width: 768px) and (max-width: 1024px) {
        /* Force responsive design on tablets */
        .sm\\:text-sm { font-size: 0.875rem !important; }
        .sm\\:text-base { font-size: 1rem !important; }
        .sm\\:text-lg { font-size: 1.125rem !important; }
        .sm\\:text-xl { font-size: 1.25rem !important; }
        .sm\\:text-2xl { font-size: 1.5rem !important; }
        .sm\\:text-3xl { font-size: 1.875rem !important; }
        
        .sm\\:p-3 { padding: 0.75rem !important; }
        .sm\\:p-4 { padding: 1rem !important; }
        .sm\\:p-6 { padding: 1.5rem !important; }
        
        .sm\\:mb-4 { margin-bottom: 1rem !important; }
        .sm\\:mb-6 { margin-bottom: 1.5rem !important; }
        
        .sm\\:gap-2 { gap: 0.5rem !important; }
        .sm\\:gap-3 { gap: 0.75rem !important; }
        .sm\\:gap-4 { gap: 1rem !important; }
        
        .sm\\:grid-cols-2 { grid-template-columns: repeat(2, minmax(0, 1fr)) !important; }
        .sm\\:grid-cols-3 { grid-template-columns: repeat(3, minmax(0, 1fr)) !important; }
        
        .sm\\:table-cell { display: table-cell !important; }
        .sm\\:flex-row { flex-direction: row !important; }
        .sm\\:items-center { align-items: center !important; }
        .sm\\:space-y-2 > * + * { margin-top: 0.5rem !important; }
        
        .sm\\:h-4 { height: 1rem !important; }
        .sm\\:h-5 { height: 1.25rem !important; }
        .sm\\:w-4 { width: 1rem !important; }
        .sm\\:w-5 { width: 1.25rem !important; }
        
        .sm\\:mr-2 { margin-right: 0.5rem !important; }
      }
    `;
    document.head.appendChild(style);
    
    // Force DOM refresh
    document.body.style.display = 'none';
    document.body.offsetHeight; // Trigger reflow
    document.body.style.display = '';
    
    console.log('Tablet fixes applied - responsive design should now work properly');
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