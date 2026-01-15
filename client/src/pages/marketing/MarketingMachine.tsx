import { useState } from "react";

type AgentStatus = "idle" | "running" | "completed";

interface Agent {
  id: string;
  name: string;
  role: string;
  status: AgentStatus;
  output?: string;
}

export default function MarketingMachine() {
  const [agents, setAgents] = useState<Agent[]>([
    {
      id: "master",
      name: "ORION",
      role: "AI Master Agent",
      status: "idle",
    },
    {
      id: "research",
      name: "Atlas",
      role: "Market Research Agent",
      status: "idle",
    },
    {
      id: "content",
      name: "Nova",
      role: "Content Creation Agent",
      status: "idle",
    },
    {
      id: "review",
      name: "Sentinel",
      role: "Post Review & QA Agent",
      status: "idle",
    },
    {
      id: "analysis",
      name: "Echo",
      role: "Performance & Analytics Agent",
      status: "idle",
    },
    {
      id: "ads",
      name: "Pulse",
      role: "Ads & Campaign Agent",
      status: "idle",
    },
  ]);

  const runMarketingCycle = () => {
    setAgents(prev =>
      prev.map(agent => ({
        ...agent,
        status: "running",
      }))
    );

    setTimeout(() => {
      setAgents(prev =>
        prev.map(agent => ({
          ...agent,
          status: "completed",
          output:
            agent.id === "research"
              ? "Identified trending burger content, competitors & hashtags."
              : agent.id === "content"
              ? "Generated 5 posts (GrabFood, IG, FB, Ads)."
              : agent.id === "review"
              ? "Tone, CTA & branding approved."
              : agent.id === "analysis"
              ? "Predicted 18–24% engagement uplift."
              : agent.id === "ads"
              ? "Created 2 paid ad variants."
              : "Marketing cycle completed successfully.",
        }))
      );
    }, 2500);
  };

  return (
    <div className="min-h-screen bg-[#0b0f14] text-white p-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight">
            Marketing Machine
          </h1>
          <p className="text-sm text-gray-400">
            Autonomous AI-driven marketing command centre
          </p>
        </div>

        <button
          onClick={runMarketingCycle}
          className="bg-lime-400 text-black px-6 py-3 rounded-xl font-semibold hover:bg-lime-300 transition"
        >
          Run Full Marketing Cycle
        </button>
      </div>

      {/* Master Agent */}
      <div className="bg-gradient-to-br from-[#141a22] to-[#0f131a] rounded-2xl p-6 mb-8 border border-[#1f2937]">
        <h2 className="text-xl font-bold mb-1">ORION — Master AI Agent</h2>
        <p className="text-sm text-gray-400">
          Orchestrates research, content, validation, analytics & advertising
        </p>

        <div className="mt-4 flex items-center gap-4">
          <span className="px-3 py-1 rounded-full text-xs bg-lime-400 text-black font-semibold">
            ACTIVE
          </span>
          <span className="text-sm text-gray-400">
            Status: Autonomous coordination enabled
          </span>
        </div>
      </div>

      {/* Agent Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
        {agents
          .filter(agent => agent.id !== "master")
          .map(agent => (
            <div
              key={agent.id}
              className="bg-[#111827] rounded-2xl p-6 border border-[#1f2937]"
            >
              <div className="flex items-center justify-between mb-3">
                <div>
                  <h3 className="font-bold">{agent.name}</h3>
                  <p className="text-xs text-gray-400">{agent.role}</p>
                </div>

                <span
                  className={`text-xs px-3 py-1 rounded-full font-semibold ${
                    agent.status === "idle"
                      ? "bg-gray-700 text-gray-300"
                      : agent.status === "running"
                      ? "bg-yellow-400 text-black"
                      : "bg-lime-400 text-black"
                  }`}
                >
                  {agent.status.toUpperCase()}
                </span>
              </div>

              <div className="text-sm text-gray-300 min-h-[48px]">
                {agent.output ?? "Awaiting execution…"}
              </div>
            </div>
          ))}
      </div>
    </div>
  );
}