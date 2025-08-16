import React, { useRef, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { ChatAgentProvider } from './ChatAgentProvider';

export const JussiChatBubble = () => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const location = useLocation();
  const [isOpen, setIsOpen] = useState(false);
  
  // Only show on Operations pages
  const allowedPaths = ['/operations/daily-sales-stock', '/reports-analysis', '/purchasing', '/expenses'];
  const isOnOperationsPage = allowedPaths.some(path => location.pathname.includes(path));
  
  if (!isOnOperationsPage) return null;

  const handleBubbleClick = () => {
    setIsOpen(!isOpen);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      alert(`Uploading file: ${file.name}`);
      // Hook this into Jussi's upload pipeline if needed
    }
  };

  return (
    <ChatAgentProvider agentName="Jussi" agentRole="Head of Operations" tools={["file-upload", "receipt-parser"]}>
      <div
        style={{
          position: 'fixed',
          top: '50%',
          right: '30px',
          transform: 'translateY(-50%)',
          zIndex: 9999,
        }}
      >
        {!isOpen ? (
          <button
            onClick={handleBubbleClick}
            style={{
              backgroundColor: '#f5d016',
              border: 'none',
              borderRadius: '50%',
              width: '50px',
              height: '50px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: '0 4px 12px rgba(0,0,0,0.2)'
            }}
            title="Jussi - Head of Operations"
          >
            <svg 
              width="24" 
              height="24" 
              viewBox="0 0 24 24" 
              fill="none" 
              stroke="currentColor" 
              strokeWidth="2" 
              strokeLinecap="round" 
              strokeLinejoin="round"
              style={{ color: '#000' }}
            >
              <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
            </svg>
          </button>
        ) : (
          <div
            style={{
              width: '350px',
              height: '500px',
              backgroundColor: '#fff',
              borderRadius: '10px',
              boxShadow: '0 4px 20px rgba(0,0,0,0.4)',
              display: 'flex',
              flexDirection: 'column',
              overflow: 'hidden',
              position: 'absolute',
              bottom: '60px',
              right: '0px'
            }}
          >
            <div
              style={{
                backgroundColor: '#f5d016',
                color: '#000',
                padding: '10px',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                fontWeight: 'bold'
              }}
            >
              <span>💬 Jussi – Head of Operations</span>
              <button
                onClick={() => setIsOpen(false)}
                style={{
                  background: 'transparent',
                  color: '#000',
                  border: 'none',
                  fontSize: '16px',
                  cursor: 'pointer',
                  fontWeight: 'bold'
                }}
              >
                ✕
              </button>
            </div>
            <div style={{ flex: 1, padding: '10px', display: 'flex', flexDirection: 'column' }}>
              <div style={{ marginBottom: '10px', fontSize: '14px', color: '#666' }}>
                <strong>Jussi AI Assistant</strong><br/>
                Ask me about operations, upload receipts, or get shift insights.
              </div>
              <textarea
                placeholder="Ask Jussi anything about operations..."
                style={{
                  flex: 1,
                  width: '100%',
                  resize: 'none',
                  padding: '10px',
                  fontSize: '14px',
                  border: '1px solid #ccc',
                  borderRadius: '5px',
                  marginBottom: '10px'
                }}
              />
              <input
                ref={fileInputRef}
                type="file"
                accept=".csv,.pdf,.jpg,.png"
                onChange={handleFileChange}
                style={{ marginBottom: '10px' }}
              />
              <button
                style={{
                  backgroundColor: '#f5d016',
                  color: '#000',
                  border: 'none',
                  padding: '8px 16px',
                  borderRadius: '5px',
                  cursor: 'pointer',
                  fontWeight: 'bold'
                }}
              >
                Send to Jussi
              </button>
            </div>
          </div>
        )}
      </div>
    </ChatAgentProvider>
  );
};