"use client";

import { useState, useEffect, useRef } from "react";
import { Terminal as TerminalIcon, RefreshCw, Activity } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import type { FileEntry } from "@/types";

const WS_BASE = (process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000").replace(/^http/, "ws");

interface TerminalProps {
  files: FileEntry[];
  executionCount: number;
  packages?: string[];
  mode?: "run" | "test";
}

interface TraceStep {
  step: string;
  detail: string;
  id: number;
}

interface OutputLine {
  type: "system" | "stdout" | "stderr" | "plot" | "test-pass" | "test-fail" | "test-info";
  text: string;
  id: number;
}

function classifyTestLine(text: string): OutputLine["type"] {
  const t = text.trimStart();
  if (/^PASSED/.test(t) || / PASSED$/.test(t.trimEnd())) return "test-pass";
  if (/^FAILED/.test(t) || / FAILED$/.test(t.trimEnd())) return "test-fail";
  if (/^ERROR/.test(t)) return "test-fail";
  if (/^\d+ passed/.test(t) || /passed/.test(t)) return "test-pass";
  if (/failed/.test(t) && /error/.test(t)) return "test-fail";
  if (/^={3,}/.test(t) || /^-{3,}/.test(t) || /^_{3,}/.test(t)) return "test-info";
  return "stdout";
}

export default function Terminal({ files, executionCount, packages, mode = "run" }: TerminalProps) {
  const [output, setOutput]             = useState<OutputLine[]>([]);
  const [isRunning, setIsRunning]       = useState(false);
  const [traceHistory, setTraceHistory] = useState<TraceStep[]>([]);
  const terminalEndRef                  = useRef<HTMLDivElement>(null);
  const traceIdCounter                  = useRef(0);
  const outputIdCounter                 = useRef(0);

  useEffect(() => {
    terminalEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [output]);

  useEffect(() => {
    if (executionCount === 0) return;

    const label = mode === "test" ? "$ pytest -v" : "$ python main.py";
    setOutput([{ type: "system", text: "SIGNAL: INITIALIZING SANDBOX BOOT SEQUENCE...", id: outputIdCounter.current++ }]);
    setIsRunning(true);
    setTraceHistory([]);

    const ws = new WebSocket(`${WS_BASE}/ws/execute`);

    ws.onopen = () => {
      ws.send(JSON.stringify({
        files: files.map(f => ({ name: f.name, content: f.content })),
        packages: packages ?? [],
        mode,
      }));
    };

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);

        if (data.status === "running") {
          setOutput(prev => [...prev, { type: "system", text: label, id: outputIdCounter.current++ }]);
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
          const lineType = mode === "test" ? classifyTestLine(data.output) : "stdout";
          setOutput(prev => [...prev, { type: lineType, text: data.output, id: outputIdCounter.current++ }]);
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
    <div className="h-full w-full flex flex-col bg-[#07090f]">
      {/* Header */}
      <div className="h-10 flex items-center px-4 justify-between border-b border-white/[0.06] shrink-0">
        <div className="flex items-center gap-2">
          <TerminalIcon size={12} className="text-emerald-400/70" />
          <span className="text-[11px] font-semibold text-white/30">
            {mode === "test" ? "Test Runner" : "Output"}
          </span>
          {packages && packages.length > 0 && (
            <span className="text-[10px] text-amber-400/60 bg-amber-500/[0.08] border border-amber-500/15 rounded px-1.5 py-0.5 font-mono">
              +{packages.length} pkg{packages.length !== 1 ? "s" : ""}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          {isRunning && (
            <span className="text-[10px] text-emerald-400 font-medium flex items-center gap-1.5">
              <Activity size={9} className="animate-pulse" />
              Running
            </span>
          )}
          <button
            onClick={() => { setOutput([]); setTraceHistory([]); }}
            className="text-white/15 hover:text-white/45 transition-colors p-1 rounded"
            aria-label="Clear output"
          >
            <RefreshCw size={10} />
          </button>
        </div>
      </div>

      {/* Live trace signal */}
      <div className="px-4 py-2.5 border-b border-white/[0.04] shrink-0 min-h-[60px]">
        <div className="text-[9px] font-bold uppercase tracking-widest text-white/15 mb-2">Trace</div>
        <AnimatePresence initial={false}>
          {traceHistory.length > 0 ? (
            traceHistory.slice(0, 2).map((trace, index) => (
              <motion.div
                key={trace.id}
                initial={{ opacity: 0, x: -4 }}
                animate={{ opacity: 1 - index * 0.5, x: 0 }}
                className="flex items-center gap-2 mb-1"
              >
                <div className={`w-1 h-1 rounded-full shrink-0 ${
                  index === 0
                    ? trace.step === "Finished" ? "bg-emerald-400" : "bg-indigo-400 animate-pulse"
                    : "bg-white/10"
                }`} />
                <span className={`text-[10px] font-mono ${index === 0 ? "text-white/55" : "text-white/20"}`}>
                  {trace.step}
                  <span className="text-white/20 ml-1.5">{trace.detail}</span>
                </span>
              </motion.div>
            ))
          ) : (
            <div className="text-[10px] text-white/10 italic">Standby…</div>
          )}
        </AnimatePresence>
      </div>

      {/* Output console */}
      <div className="flex-1 px-4 py-3 font-mono text-[12.5px] overflow-y-auto leading-relaxed custom-scrollbar">
        {output.length === 0 && traceHistory.length === 0 && (
          <div className="text-white/[0.08] italic text-sm">
            Run your code to see output here.
          </div>
        )}

        {output.map(line => {
          if (line.type === "plot") {
            return (
              <div key={line.id} className="my-3">
                <div className="text-[9px] text-indigo-400/40 font-bold uppercase tracking-widest mb-2">Plot Output</div>
                <img
                  src={`data:image/png;base64,${line.text}`}
                  alt="Plot output"
                  className="max-w-full rounded-xl border border-white/10 shadow-2xl"
                />
              </div>
            );
          }
          return (
            <span
              key={line.id}
              className={`
                ${line.type === "system"    ? "text-indigo-400/70 font-semibold block mb-1.5" : ""}
                ${line.type === "stderr"    ? "text-rose-400/80" : ""}
                ${line.type === "stdout"    ? "text-white/70" : ""}
                ${line.type === "test-pass" ? "text-emerald-400" : ""}
                ${line.type === "test-fail" ? "text-rose-400 font-bold" : ""}
                ${line.type === "test-info" ? "text-white/25" : ""}
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
