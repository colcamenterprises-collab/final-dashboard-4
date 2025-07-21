import React from 'react';

interface AIChatWidgetProps {
  agent: 'ollie' | 'sally' | 'marlo' | 'bigboss';
  height?: string;
  width?: string;
}

export function AIChatWidget({ agent, height = '500px', width = '100%' }: AIChatWidgetProps) {
  const chatboxUrl = `/chatbox-template.html?agent=${agent}`;

  return (
    <div className="ai-chat-widget border rounded-lg overflow-hidden shadow-lg">
      <iframe
        src={chatboxUrl}
        style={{ 
          width, 
          height, 
          border: 'none',
          display: 'block'
        }}
        title={`${agent.charAt(0).toUpperCase() + agent.slice(1)} AI Assistant`}
        sandbox="allow-scripts allow-same-origin allow-forms"
      />
    </div>
  );
}

// Usage examples:
// <AIChatWidget agent="ollie" height="600px" />
// <AIChatWidget agent="sally" />
// <AIChatWidget agent="marlo" height="400px" />
// <AIChatWidget agent="bigboss" />