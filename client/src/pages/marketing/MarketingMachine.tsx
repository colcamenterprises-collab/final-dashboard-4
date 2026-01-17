import { useState } from "react";

type AgentStage = "Research" | "Content" | "Review" | "Analysis" | "Ads";
type CycleStatus = "running" | "completed";

interface AgentLog {
  stage: AgentStage;
  output: string;
  duration: string;
}

interface MarketingCycle {
  id: string;
  startedAt: string;
  status: CycleStatus;
  logs: AgentLog[];
}

const STAGES: AgentStage[] = [
  "Research",
  "Content",
  "Review",
  "Analysis",
  "Ads",
];

export default function MarketingMachine() {
  const [cycles, setCycles] = useState<MarketingCycle[]>([]);
  const [activeCycleId, setActiveCycleId] = useState<string | null>(null);

  const runMarketingCycle = () => {
    const id = crypto.randomUUID();
    const startTime = new Date().toLocaleString();

    const newCycle: MarketingCycle = {
      id,
      startedAt: startTime,
      status: "running",
      logs: [],
    };

    setCycles(prev => [newCycle, ...prev]);
    setActiveCycleId(id);

    STAGES.forEach((stage, index) => {
      setTimeout(() => {
        setCycles(prev =>
          prev.map(cycle =>
            cycle.id === id
              ? {
                  ...cycle,
                  logs: [
                    ...cycle.logs,
                    {
                      stage,
                      output: `${stage} completed successfully.`,
                      duration: `${2 + index}s`,
                    },
                  ],
                  status:
                    stage === "Ads" ? "completed" : cycle.status,
                }
              : cycle
          )
        );
      }, 1200 * (index + 1));
    });
  };

  const activeCycle = cycles.find(c => c.id === activeCycleId);

  return (
    <div className="min-h-screen bg-[#0b0f14] text-white p-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight">
            Marketing Machine
          </h1>
          <p className="text-sm text-gray-400">
            Autonomous AI marketing execution engine
          </p>
        </div>

        <button
          onClick={runMarketingCycle}
          className="bg-lime-400 text-black px-6 py-3 rounded-xl font-semibold hover:bg-lime-300 transition"
        >
          Run Marketing Cycle
        </button>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        {/* Cycle History */}
        <div className="bg-[#111827] rounded-2xl p-6 border border-[#1f2937]">
          <h2 className="font-bold mb-4">Cycle History</h2>

          {cycles.length === 0 && (
            <p className="text-sm text-gray-400">
              No marketing cycles executed yet.
            </p>
          )}

          <div className="space-y-3">
            {cycles.map(cycle => (
              <button
                key={cycle.id}
                onClick={() => setActiveCycleId(cycle.id)}
                className={`w-full text-left p-3 rounded-xl border transition ${
                  activeCycleId === cycle.id
                    ? "border-lime-400 bg-[#0f172a]"
                    : "border-[#1f2937] hover:bg-[#0f172a]"
                }`}
              >
                <div className="flex justify-between items-center">
                  <span className="text-sm font-semibold">
                    {cycle.startedAt}
                  </span>
                  <span
                    className={`text-xs px-2 py-1 rounded-full font-semibold ${
                      cycle.status === "completed"
                        ? "bg-lime-400 text-black"
                        : "bg-yellow-400 text-black"
                    }`}
                  >
                    {cycle.status.toUpperCase()}
                  </span>
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* Execution Timeline */}
        <div className="bg-[#111827] rounded-2xl p-6 border border-[#1f2937]">
          <h2 className="font-bold mb-4">Execution Timeline</h2>

          {!activeCycle && (
            <p className="text-sm text-gray-400">
              Select or run a cycle to view execution.
            </p>
          )}

          {activeCycle && (
            <div className="space-y-3">
              {STAGES.map(stage => {
                const completed = activeCycle.logs.some(
                  log => log.stage === stage
                );

                return (
                  <div
                    key={stage}
                    className="flex items-center gap-3"
                  >
                    <div
                      className={`w-3 h-3 rounded-full ${
                        completed
                          ? "bg-lime-400"
                          : "bg-gray-600"
                      }`}
                    />
                    <span className="text-sm">{stage}</span>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Agent Logs */}
        <div className="bg-[#111827] rounded-2xl p-6 border border-[#1f2937]">
          <h2 className="font-bold mb-4">Agent Logs</h2>

          {!activeCycle && (
            <p className="text-sm text-gray-400">
              No cycle selected.
            </p>
          )}

          {activeCycle && activeCycle.logs.length === 0 && (
            <p className="text-sm text-gray-400">
              Cycle running… logs will appear here.
            </p>
          )}

          {activeCycle && (
            <div className="space-y-4">
              {activeCycle.logs.map((log, index) => (
                <div
                  key={index}
                  className="border border-[#1f2937] rounded-xl p-3"
                >
                  <div className="flex justify-between mb-1">
                    <span className="font-semibold text-sm">
                      {log.stage}
                    </span>
                    <span className="text-xs text-gray-400">
                      {log.duration}
                    </span>
                  </div>
                  <p className="text-sm text-gray-300">
                    {log.output}
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
