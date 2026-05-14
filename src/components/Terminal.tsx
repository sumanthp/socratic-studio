"use client";

import { useState, useEffect, useRef } from "react";
import { Terminal as TerminalIcon, RefreshCw, Activity } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import type { FileEntry } from "@/types";

const WS_BASE = (process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000").replace(/^http/, "ws");

interface TerminalProps {
  files: FileEntry[];
  executionCount: number;
}

interface TraceStep {
  step: string;
  detail: string;
  id: number;
}

interface OutputLine {
  type: "system" | "stdout" | "stderr" | "plot";
  text: string;  // for "plot": base64 PNG data
  id: number;
}

export default function Terminal({ files, executionCount }: TerminalProps) {
  const [output, setOutput]           = useState<OutputLine[]>([]);
  const [isRunning, setIsRunning]     = useState(false);
  const [traceHistory, setTraceHistory] = useState<TraceStep[]>([]);
  const terminalEndRef                = useRef<HTMLDivElement>(null);
  const traceIdCounter                = useRef(0);
  const outputIdCounter               = useRef(0);

  useEffect(() => {
    terminalEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [output]);

  useEffect(() => {
    if (executionCount === 0) return;

    setOutput([{ type: "system", text: "SIGNAL: INITIALIZING SANDBOX BOOT SEQUENCE...", id: outputIdCounter.current++ }]);
    setIsRunning(true);
    setTraceHistory([]);

    const ws = new WebSocket(`${WS_BASE}/ws/execute`);

    ws.onopen = () => {
      // Send all files so the backend writes them all to the temp dir
      ws.send(JSON.stringify({ files: files.map(f => ({ name: f.name, content: f.content })) }));
    };

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);

        if (data.status === "running") {
          setOutput(prev => [...prev, { type: "system", text: "$ python main.py", id: outputIdCounter.current++ }]);
        } else if (data.status === "completed") {
          setOutput(prev => [...prev, { type: "system", text: "\n[SIGNAL TERMINATED: SUCCESS]", id: outputIdCounter.current++ }]);
          setIsRunning(false);
          setTraceHistory(prev => [
            { step: "Finished", detail: "Session closed.", id: traceIdCounter.current++ },
            ...prev,
          ].slice(0, 3));
          ws.close();
        } else if (data.trace) {
          setTraceHistory(prev => [{ ...data.trace, id: traceIdCounter.current++ }, ...prev].slice(0, 3));
        } else if (data.plot) {
          setOutput(prev => [...prev, { type: "plot", text: data.plot, id: outputIdCounter.current++ }]);
        } else if (data.output) {
          setOutput(prev => [...prev, { type: "stdout", text: data.output, id: outputIdCounter.current++ }]);
        } else if (data.error) {
          setOutput(prev => [...prev, { type: "stderr", text: data.error, id: outputIdCounter.current++ }]);
          if (data.status === "error") setIsRunning(false);
        }
      } catch (e) {
        console.error("Failed to parse websocket message", e);
      }
    };

    ws.onerror = () => {
      setOutput(prev => [...prev, { type: "stderr", text: "\n[SIGNAL LOSS: UNREACHABLE]", id: outputIdCounter.current++ }]);
      setIsRunning(false);
    };

    ws.onclose = () => setIsRunning(false);

    return () => { ws.close(); };
  }, [executionCount]);

  return (
    <div className="h-full w-full flex flex-col bg-black/60">
      {/* Header */}
      <div className="h-10 flex items-center px-4 justify-between border-b border-white/5 bg-white/[0.02] shrink-0">
        <div className="flex items-center gap-2">
          <TerminalIcon size={12} className="text-emerald-500" />
          <span className="text-[9px] text-white/40 font-black uppercase tracking-[0.3em]">Execution Sandbox</span>
        </div>
        <div className="flex items-center gap-2">
          {isRunning && (
            <span className="text-[9px] text-emerald-500 font-bold uppercase tracking-widest flex items-center gap-1.5 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20">
              <Activity size={8} className="animate-pulse" />
              Active
            </span>
          )}
          <button
            onClick={() => { setOutput([]); setTraceHistory([]); }}
            className="text-white/20 hover:text-white transition-colors p-1"
            aria-label="Clear output"
          >
            <RefreshCw size={10} />
          </button>
        </div>
      </div>

      {/* Live trace signal */}
      <div className="px-6 py-5 border-b border-white/5 bg-white/[0.01] min-h-[110px] flex flex-col gap-3 relative shrink-0">
        <div className="text-[8px] font-black text-white/20 uppercase tracking-[0.4em]">Live Trace Signal</div>
        <div className="flex flex-col gap-2.5">
          <AnimatePresence initial={false}>
            {traceHistory.length > 0 ? (
              traceHistory.map((trace, index) => (
                <motion.div
                  key={trace.id}
                  initial={{ opacity: 0, x: -5 }}
                  animate={{ opacity: 1 - (index * 0.4), x: 0, scale: 1 - (index * 0.03) }}
                  className={`flex items-center gap-3 ${index === 0 ? "text-white" : "text-white/20"}`}
                >
                  <div className={`w-1 h-1 rounded-full shrink-0 ${
                    index === 0
                      ? trace.step === "Finished"
                        ? "bg-emerald-500"
                        : "bg-indigo-500 animate-pulse"
                      : "bg-white/10"
                  }`} />
                  <div className="flex-1 min-w-0 flex items-center gap-2">
                    <span className="text-[10px] font-black uppercase tracking-widest whitespace-nowrap">{trace.step}</span>
                    <span className="text-[10px] opacity-40 truncate font-mono tracking-tighter">[{trace.detail}]</span>
                  </div>
                </motion.div>
              ))
            ) : (
              <div className="text-white/5 text-[9px] font-bold uppercase tracking-[0.3em] italic py-1">Standby...</div>
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* Output console */}
      <div className="flex-1 p-6 font-mono text-[12px] overflow-y-auto leading-relaxed custom-scrollbar">
        {output.length === 0 && traceHistory.length === 0 && (
          <div className="text-white/5 italic flex items-center gap-2 select-none">
            <span className="text-indigo-500/20 font-bold">&gt;</span>
            Laboratory idle. Awaiting command.
          </div>
        )}

        {output.map(line => {
          if (line.type === "plot") {
            return (
              <div key={line.id} className="my-4">
                <div className="text-[9px] text-indigo-400/50 font-black uppercase tracking-widest mb-2">Plot Output</div>
                <img
                  src={`data:image/png;base64,${line.text}`}
                  alt="Plot output"
                  className="max-w-full rounded-xl border border-white/10 shadow-2xl shadow-black/50"
                />
              </div>
            );
          }
          return (
            <span
              key={line.id}
              className={`
                ${line.type === "system" ? "text-indigo-400 font-bold block mb-2" : ""}
                ${line.type === "stderr" ? "text-rose-400/80 bg-rose-500/5 px-1 rounded" : ""}
                ${line.type === "stdout" ? "text-white/80" : ""}
              `}
            >
              {line.text}
            </span>
          );
        })}
        <div ref={terminalEndRef} />
      </div>
    </div>
  );
}
