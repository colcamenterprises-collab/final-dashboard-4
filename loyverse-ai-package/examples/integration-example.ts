// Example: How to integrate Jussi AI agent in your component
import { JussiChatBubble } from '@/components/JussiChatBubble';
import { AIChatWidget } from '@/components/AIChatWidget';

export function ExamplePage() {
  return (
    <div>
      <h1>Your Page Content</h1>
      
      {/* Option 1: Floating chat bubble */}
      <JussiChatBubble />
      
      {/* Option 2: Embedded chat widget */}
      <AIChatWidget agent="jussi" height="400px" />
    </div>
  );
}
