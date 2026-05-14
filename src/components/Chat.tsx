"use client";

import { useState, useRef, useEffect } from "react";
import { Send, Bot, User, Sparkles, Loader2, ShieldAlert, Cpu, Layout, Radio, AlertCircle, Mic, MicOff } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://127.0.0.1:8000";
const WS_BASE = API_BASE.replace(/^http/, "ws");

interface ChatProps {
  codeContext: string;
  provider: string;
  onMilestoneUpdate: (milestone: string) => void;
}

type AgentRole = "Architect" | "Auditor" | "Debugger" | "Tutor";

interface Message {
  role: "human" | AgentRole;
  content: string;
  id: number;
}

const AGENT_CONFIG: Record<AgentRole, { icon: React.ElementType; color: string; bg: string; border: string }> = {
  Architect: { icon: Layout, color: "text-blue-400", bg: "bg-blue-500/10", border: "border-blue-500/20" },
  Auditor: { icon: ShieldAlert, color: "text-amber-400", bg: "bg-amber-500/10", border: "border-amber-500/20" },
  Debugger: { icon: Cpu, color: "text-rose-400", bg: "bg-rose-500/10", border: "border-rose-500/20" },
  Tutor: { icon: Bot, color: "text-indigo-400", bg: "bg-indigo-500/10", border: "border-indigo-500/20" },
};

const KNOWN_AGENT_ROLES = new Set<string>(["Architect", "Auditor", "Debugger", "Tutor"]);

function isAgentRole(role: string): role is AgentRole {
  return KNOWN_AGENT_ROLES.has(role);
}

export default function Chat({ codeContext, provider, onMilestoneUpdate }: ChatProps) {
  const [messages, setMessages] = useState<Message[]>([
    {
      role: "Tutor",
      content: "Council initialized. Establishing connection to Multi-Agent Lab...\n\nHello, I'm your Socratic Tutor. The Lead Architect and Security Auditor are standing by. What are we building today?",
      id: 0,
    },
  ]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isVoiceMode, setIsVoiceMode] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [timer, setTimer] = useState(0);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const msgIdCounter = useRef(1);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const voiceWsRef = useRef<WebSocket | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isLoading]);

  // Clean up voice mode on unmount
  useEffect(() => {
    return () => {
      mediaRecorderRef.current?.stop();
      if (voiceWsRef.current && voiceWsRef.current.readyState !== WebSocket.CLOSED) {
        voiceWsRef.current.close();
      }
    };
  }, []);

  const toggleVoiceMode = async () => {
    if (isVoiceMode) {
      setIsVoiceMode(false);
      setIsRecording(false);
      mediaRecorderRef.current?.stop();
      voiceWsRef.current?.close();
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const ws = new WebSocket(`${WS_BASE}/ws/voice-tutor`);

      ws.onopen = () => {
        console.log("Voice WS connected");
        setIsVoiceMode(true);
        setIsRecording(true);

        const recorder = new MediaRecorder(stream);
        recorder.ondataavailable = (e) => {
          if (e.data.size > 0 && ws.readyState === WebSocket.OPEN) {
            ws.send(e.data);
          }
        };
        recorder.start(1000);
        mediaRecorderRef.current = recorder;
      };

      ws.onmessage = (event) => {
        const data = JSON.parse(event.data);
        if (data.content) {
          setMessages(prev => [...prev, { role: "Tutor", content: data.content, id: msgIdCounter.current++ }]);
        }
      };

      ws.onerror = (err) => console.error("Voice WS error", err);
      ws.onclose = () => setIsVoiceMode(false);
      voiceWsRef.current = ws;

    } catch (err) {
      console.error("Failed to start voice mode", err);
      alert("Microphone access denied or backend unavailable.");
    }
  };

  useEffect(() => {
    if (isLoading) {
      setTimer(0);
      timerRef.current = setInterval(() => {
        setTimer(prev => prev + 1);
      }, 1000);
    } else {
      if (timerRef.current) clearInterval(timerRef.current);
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [isLoading]);

  const handleSend = async () => {
    if (!input.trim() || isLoading) return;

    const userMessage = input.trim();
    setInput("");

    const newMessages: Message[] = [...messages, { role: "human", content: userMessage, id: msgIdCounter.current++ }];
    setMessages(newMessages);
    setIsLoading(true);

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 90000);

      const response = await fetch(`${API_BASE}/api/tutor/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        signal: controller.signal,
        body: JSON.stringify({
          message: userMessage,
          history: messages.map(m => ({
            role: m.role === "human" ? "human" : "ai",
            content: m.content,
          })),
          code_context: codeContext,
          provider: provider,
        }),
      });

      clearTimeout(timeoutId);

      if (!response.ok) throw new Error(`Server error: ${response.status}`);
      const data = await response.json();

      if (data.discussion && Array.isArray(data.discussion)) {
        for (const msg of data.discussion) {
          if (msg.role === "Taskmaster") {
            const milestone = msg.content.replace("MILESTONE: ", "").trim();
            onMilestoneUpdate(milestone);
            continue;
          }
          const role: Message["role"] = isAgentRole(msg.role) ? msg.role : "Tutor";
          setMessages(prev => [...prev, { role, content: msg.content, id: msgIdCounter.current++ }]);
          await new Promise(resolve => setTimeout(resolve, 800));
        }
      }
    } catch (err: unknown) {
      console.error("Chat network failure", err);
      let errorMsg = "SIGNAL LOSS: Unable to reach the Council. Maintenance required.";
      if (err instanceof Error && err.name === "AbortError") {
        errorMsg = `SIGNAL TIMEOUT: The ${provider} engine is taking too long to respond. Please ensure Ollama is running and your GPU is not overloaded.`;
      }
      setMessages(prev => [...prev, {
        role: "Tutor",
        content: errorMsg,
        id: msgIdCounter.current++,
      }]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div className="h-full w-full flex flex-col bg-black/40">
      {/* Module Header */}
      <div className="h-12 flex items-center px-6 border-b border-white/5 justify-between bg-white/[0.02]">
        <div className="flex items-center gap-2">
          <Radio size={12} className={`text-indigo-500 ${isLoading ? "animate-pulse" : ""}`} />
          <span className="text-[10px] font-bold text-white/40 uppercase tracking-[0.2em]">Council Signal</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className={`w-1 h-1 rounded-full ${provider === "ollama" ? "bg-emerald-500" : "bg-indigo-500"}`} />
          <span className="text-[9px] font-bold text-white/20 uppercase tracking-widest">{provider}</span>
        </div>
      </div>

      {/* Message Stream */}
      <div className="flex-1 p-6 overflow-y-auto flex flex-col gap-8 custom-scrollbar">
        <AnimatePresence initial={false}>
          {messages.map((msg) => {
            const isHuman = msg.role === "human";
            const config = !isHuman && isAgentRole(msg.role) ? AGENT_CONFIG[msg.role] : null;
            const Icon = config ? config.icon : User;

            return (
              <motion.div
                key={msg.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className={`flex gap-4 ${isHuman ? "flex-row-reverse" : "flex-row"}`}
              >
                <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 border border-white/5 ${isHuman ? "bg-white text-black" : (config?.bg || "bg-white/5")}`}>
                  <Icon size={14} className={isHuman ? "text-black" : (config?.color || "text-white")} />
                </div>

                <div className={`flex flex-col gap-2 ${isHuman ? "items-end" : "items-start"} max-w-[80%]`}>
                  <div className={`text-[9px] font-black uppercase tracking-[0.2em] ${isHuman ? "text-white/40" : (config?.color || "text-indigo-400")}`}>
                    {msg.role}
                  </div>
                  <div className={`
                    text-[12px] leading-relaxed p-4 rounded-xl border
                    ${isHuman
                      ? "text-white bg-white/5 border-white/10"
                      : `text-white/70 ${config?.bg} ${config?.border}`
                    }
                  `}>
                    <span className="whitespace-pre-wrap">{msg.content}</span>
                  </div>
                </div>
              </motion.div>
            );
          })}
        </AnimatePresence>

        {isLoading && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex gap-4">
            <div className="w-8 h-8 rounded-lg bg-white/5 border border-white/5 flex items-center justify-center shrink-0">
              <Loader2 size={14} className="animate-spin text-indigo-500" />
            </div>
            <div className="flex flex-col gap-1">
              <div className="flex items-center gap-3 text-white/20 text-[10px] font-bold uppercase tracking-[0.2em] mt-2">
                Processing signal... {timer}s
              </div>
              {timer > 10 && (
                <div className="text-[9px] text-white/10 italic">
                  Note: Local models can take up to 30s to respond...
                </div>
              )}
            </div>
          </motion.div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input Module */}
      <div className="p-6 border-t border-white/5">
        <div className="relative flex items-center gap-3">
          <button
            onClick={toggleVoiceMode}
            aria-label={isVoiceMode ? "Stop Voice Mode" : "Start Socratic Voice Mode"}
            className={`w-12 h-12 flex items-center justify-center rounded-xl transition-all active:scale-95 shrink-0 border ${
              isVoiceMode
                ? "bg-rose-500/20 border-rose-500/40 text-rose-400 animate-pulse"
                : "bg-white/5 border-white/10 text-white/40 hover:text-white hover:bg-white/10"
            }`}
          >
            {isVoiceMode ? <MicOff size={18} /> : <Mic size={18} />}
          </button>
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={isLoading ? "TRANSMITTING..." : "INPUT QUERY..."}
            disabled={isLoading}
            className="flex-1 bg-white/[0.03] border border-white/5 rounded-xl px-5 py-3.5 text-[12px] text-white placeholder-white/10 focus:outline-none focus:border-indigo-500/30 transition-all font-mono"
          />
          <button
            onClick={handleSend}
            disabled={isLoading || !input.trim()}
            className="w-12 h-12 flex items-center justify-center bg-white text-black hover:bg-indigo-50 hover:text-white disabled:bg-white/5 disabled:text-white/10 rounded-xl transition-all active:scale-95 shrink-0"
          >
            <Send size={16} />
          </button>
        </div>
      </div>
    </div>
  );
}
