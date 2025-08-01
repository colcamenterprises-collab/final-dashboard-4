import React, { useEffect } from "react";

type Props = {
  children: React.ReactNode;
  agentName: string;
  agentRole: string;
  tools?: string[];
};

export const ChatAgentProvider = ({ children, agentName, agentRole, tools = [] }: Props) => {
  useEffect(() => {
    window.localStorage.setItem("chat-agent-name", agentName);
    window.localStorage.setItem("chat-agent-role", agentRole);
    window.localStorage.setItem("chat-agent-tools", JSON.stringify(tools));
  }, [agentName, agentRole, tools]);

  return <>{children}</>;
};