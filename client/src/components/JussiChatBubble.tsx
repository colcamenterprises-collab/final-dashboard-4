import React, { useState } from 'react';
import './JussiChatBubble.css';

const JussiChatBubble = () => {
  const [isOpen, setIsOpen] = useState(false);

  const toggleChat = () => setIsOpen(!isOpen);

  return (
    <>
      {/* Chat Window */}
      {isOpen && (
        <div className="chat-window">
          <div className="chat-header">
            <strong>Jussi - Head of Operations</strong>
            <button className="close-btn" onClick={toggleChat}>×</button>
          </div>
          <div className="chat-body">
            <p style={{ fontSize: '14px', fontStyle: 'italic', color: '#555' }}>
              "Please... we know the answer, so let's just do it."
            </p>
            <div className="chat-content">
              <iframe
                src="https://your-chat-agent-url"
                width="100%"
                height="100%"
                title="Jussi Assistant"
                style={{ border: 'none' }}
              ></iframe>
            </div>
          </div>
        </div>
      )}

      {/* Floating Bubble */}
      <div className="chat-bubble" onClick={toggleChat}>
        💬
      </div>
    </>
  );
};

export default JussiChatBubble;