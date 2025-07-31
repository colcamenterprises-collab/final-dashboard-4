import React, { useRef } from 'react';

export const JussiChatBubble = () => {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleBubbleClick = () => {
    const chatContainer = document.getElementById('jussi-chat-container');
    if (chatContainer) {
      chatContainer.style.display = chatContainer.style.display === 'none' ? 'flex' : 'none';
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      alert(`Uploading file: ${file.name}`);
      // Hook this into Jussi's upload pipeline if needed
    }
  };

  return (
    <>
      <div
        onClick={handleBubbleClick}
        style={{
          position: 'fixed',
          top: '50%',
          right: '30px',
          transform: 'translateY(-50%)',
          backgroundColor: '#fbbf24',
          border: '2px solid #000',
          borderRadius: '50%',
          width: '50px',
          height: '50px',
          cursor: 'pointer',
          zIndex: 9999,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          boxShadow: '0 4px 12px rgba(0,0,0,0.2)'
        }}
        title="Jussi"
      >
        💬
      </div>

      <div
        id="jussi-chat-container"
        style={{
          position: 'fixed',
          top: 'calc(50% - 200px)',
          right: '100px',
          width: '350px',
          height: '400px',
          backgroundColor: '#fff',
          border: '2px solid #ccc',
          borderRadius: '10px',
          padding: '10px',
          display: 'none',
          flexDirection: 'column',
          zIndex: 9998
        }}
      >
        <div style={{ marginBottom: '10px' }}>
          <strong>Jussi - Head of Operations</strong>
        </div>
        <textarea
          placeholder="Ask Jussi anything..."
          style={{
            flex: 1,
            width: '100%',
            resize: 'none',
            padding: '5px',
            fontSize: '14px',
            border: '1px solid #ccc',
            borderRadius: '5px'
          }}
        />
        <input
          ref={fileInputRef}
          type="file"
          accept=".csv,.pdf"
          onChange={handleFileChange}
          style={{ marginTop: '10px' }}
        />
      </div>
    </>
  );
};