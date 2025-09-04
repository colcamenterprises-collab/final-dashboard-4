import React from 'react';
import AgentChatBubble from '../../components/AgentChatBubble';
import PageShell from '@/layouts/PageShell';

export default function RamsayChat() {
  return (
    <PageShell>
      <div className="space-y-6">
        <h1 className="h1">Chef Ramsay Gordon</h1>
        <div className="rounded-2xl border bg-white p-5 h-[520px] grid place-items-center text-neutral-400">
          <div className="text-center">
            <div className="text-4xl mb-4">👨‍🍳</div>
            <p className="text-lg font-medium mb-2">Chef Ramsay Gordon</p>
            <p className="text-sm mb-4">Kitchen QA & Culinary Oversight</p>
            <p className="text-sm">Click the chef icon to start chatting about kitchen standards, recipes, and food quality!</p>
          </div>
        </div>
        <AgentChatBubble />
      </div>
    </PageShell>
  );
}