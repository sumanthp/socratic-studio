"use client";

import { useState, useEffect, useRef } from "react";
import { Terminal as TerminalIcon, RefreshCw, Activity, CheckCircle2, Loader2, ArrowRight } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

interface TerminalProps {
  code: string;
  executionCount: number;
}

interface TraceStep {
  step: string;
  detail: string;
  id: number;
}

export default function Terminal({ code, executionCount }: TerminalProps) {
  const [output, setOutput] = useState<{ type: "system" | "stdout" | "stderr", text: string }[]>([]);
  const [isRunning, setIsRunning] = useState(false);
  const [traceHistory, setTraceHistory] = useState<TraceStep[]>([]);
  const terminalEndRef = useRef<HTMLDivElement>(null);
  const traceIdCounter = useRef(0);

  // Auto-scroll to bottom
  useEffect(() => {
    terminalEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [output]);

  useEffect(() => {
    if (executionCount === 0) return;

    // Reset output and start execution
    setOutput([{ type: "system", text: "SIGNAL: INITIALIZING SANDBOX BOOT SEQUENCE..." }]);
    setIsRunning(true);
    setTraceHistory([]);

    const ws = new WebSocket("ws://localhost:8000/ws/execute");

    ws.onopen = () => {
      ws.send(JSON.stringify({ code }));
    };

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        
        if (data.status === "running") {
          setOutput(prev => [...prev, { type: "system", text: "$ python main.py" }]);
        } else if (data.status === "completed") {
          setOutput(prev => [...prev, { type: "system", text: "\n[SIGNAL TERMINATED: SUCCESS]" }]);
          setIsRunning(false);
          const finishedStep = { step: "Finished", detail: "Session closed.", id: traceIdCounter.current++ };
          setTraceHistory(prev => [finishedStep, ...prev].slice(0, 3));
          ws.close();
        } else if (data.trace) {
          const nextStep = { ...data.trace, id: traceIdCounter.current++ };
          setTraceHistory(prev => [nextStep, ...prev].slice(0, 3));
        } else if (data.output) {
          setOutput(prev => [...prev, { type: "stdout", text: data.output }]);
        } else if (data.error) {
          setOutput(prev => [...prev, { type: "stderr", text: data.error }]);
        }
      } catch (e) {
        console.error("Failed to parse websocket message", e);
      }
    };

    ws.onerror = (error) => {
      setOutput(prev => [...prev, { type: "stderr", text: "\n[SIGNAL LOSS: UNREACHABLE]" }]);
      setIsRunning(false);
    };

    ws.onclose = () => {
      setIsRunning(false);
    };

    return () => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.close();
      }
    };
  }, [executionCount]);

  return (
    <div className="h-full w-full flex flex-col bg-black/60">
      {/* Module Header */}
      <div className="h-10 flex items-center px-4 justify-between border-b border-white/5 bg-white/[0.02] shrink-0">
        <div className="flex items-center gap-2">
          <TerminalIcon size={12} className="text-emerald-500" />
          <span className="text-[9px] text-white/40 font-black uppercase tracking-[0.3em]">Execution Sandbox</span>
        </div>
        <div className="flex items-center gap-2">
          {isRunning && (
            <span className="text-[9px] text-emerald-500 font-bold uppercase tracking-widest flex items-center gap-1.5 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20">
              Active
            </span>
          )}
          <button 
            onClick={() => { setOutput([]); setTraceHistory([]); }}
            className="text-white/20 hover:text-white transition-colors p-1" 
          >
            <RefreshCw size={10} />
          </button>
        </div>
      </div>

      {/* Live Agent Trace - Lab Version */}
      <div className="px-6 py-5 border-b border-white/5 bg-white/[0.01] min-h-[110px] flex flex-col gap-3 relative">
        <div className="text-[8px] font-black text-white/20 uppercase tracking-[0.4em]">Live Trace Signal</div>
        
        <div className="flex flex-col gap-2.5">
          <AnimatePresence initial={false}>
            {traceHistory.length > 0 ? (
              traceHistory.map((trace, index) => (
                <motion.div 
                  key={trace.id}
                  initial={{ opacity: 0, x: -5 }}
                  animate={{ opacity: 1 - (index * 0.4), x: 0, scale: 1 - (index * 0.03) }}
                  className={`flex items-center gap-3 ${index === 0 ? 'text-white' : 'text-white/20'}`}
                >
                  <div className={`w-1 h-1 rounded-full ${index === 0 ? (trace.step === 'Finished' ? 'bg-emerald-500' : 'bg-indigo-500 animate-pulse') : 'bg-white/10'}`} />
                  <div className="flex-1 min-w-0 flex items-center gap-2">
                    <span className="text-[10px] font-black uppercase tracking-widest whitespace-nowrap">{trace.step}</span>
                    <span className="text-[10px] opacity-40 truncate font-mono tracking-tighter">[{trace.detail}]</span>
                  </div>
                </motion.div>
              ))
            ) : (
              <div className="flex items-center gap-2 text-white/5 py-1">
                <span className="text-[9px] font-bold uppercase tracking-[0.3em] italic">Standby...</span>
              </div>
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* Output Console */}
      <div className="flex-1 p-6 font-mono text-[12px] text-white/60 overflow-y-auto leading-relaxed custom-scrollbar">
        {output.length === 0 && traceHistory.length === 0 && (
          <div className="text-white/5 italic flex items-center gap-2 select-none">
            <span className="text-indigo-500/20 font-bold">&gt;</span>
            Laboratory idle. Awaiting command.
          </div>
        )}
        
        {output.map((line, i) => (
          <span 
            key={i} 
            className={`
              ${line.type === 'system' ? 'text-indigo-400 font-bold block mb-2' : ''}
              ${line.type === 'stderr' ? 'text-rose-400/80 bg-rose-500/5 px-1 rounded' : ''}
              ${line.type === 'stdout' ? 'text-white/80' : ''}
            `}
          >
            {line.text}
          </span>
        ))}
        <div ref={terminalEndRef} />
      </div>
    </div>
  );
}
