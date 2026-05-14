"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { Send, Bot, User, Loader2, ShieldAlert, Cpu, Layout, Radio, Mic, MicOff, Copy, Check } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://127.0.0.1:8000";
const WS_BASE  = API_BASE.replace(/^http/, "ws");

const MAX_HISTORY = 10;

type AgentRole = "Architect" | "Auditor" | "Debugger" | "Tutor";

interface Message {
  role: "human" | AgentRole;
  content: string;
  id: number;
}

// Simplified type used for persistence interchange (no internal id)
export interface PersistedMessage {
  role: string;
  content: string;
}

interface ChatProps {
  codeContext: string;
  provider: string;
  currentModule?: string;
  activeFileName: string;
  onMilestoneUpdate: (milestone: string) => void;
  onApplyCode: (code: string) => void;
  initialMessages?: PersistedMessage[];
  onNewMessages?: (msgs: PersistedMessage[]) => void;
}

const AGENT_CONFIG: Record<AgentRole, { icon: React.ElementType; color: string; bg: string; border: string }> = {
  Architect: { icon: Layout,      color: "text-blue-400",   bg: "bg-blue-500/10",   border: "border-blue-500/20"   },
  Auditor:   { icon: ShieldAlert, color: "text-amber-400",  bg: "bg-amber-500/10",  border: "border-amber-500/20"  },
  Debugger:  { icon: Cpu,         color: "text-rose-400",   bg: "bg-rose-500/10",   border: "border-rose-500/20"   },
  Tutor:     { icon: Bot,         color: "text-indigo-400", bg: "bg-indigo-500/10", border: "border-indigo-500/20" },
};

const KNOWN_AGENT_ROLES = new Set<string>(["Architect", "Auditor", "Debugger", "Tutor"]);
function isAgentRole(role: string): role is AgentRole {
  return KNOWN_AGENT_ROLES.has(role);
}

// ---------------------------------------------------------------------------
// Code-block parser — splits agent content into text and fenced code blocks
// ---------------------------------------------------------------------------

type ContentPart =
  | { type: "text"; text: string }
  | { type: "code"; language: string; code: string };

function parseContent(content: string): ContentPart[] {
  const parts: ContentPart[] = [];
  const re = /```(\w+)?\n([\s\S]*?)```/g;
  let last = 0;
  let match: RegExpExecArray | null;

  while ((match = re.exec(content)) !== null) {
    if (match.index > last) {
      parts.push({ type: "text", text: content.slice(last, match.index) });
    }
    parts.push({ type: "code", language: match[1] || "python", code: match[2] });
    last = match.index + match[0].length;
  }
  if (last < content.length) {
    parts.push({ type: "text", text: content.slice(last) });
  }
  return parts;
}

// ---------------------------------------------------------------------------
// Code block component with Copy + Apply buttons
// ---------------------------------------------------------------------------

function CodeBlock({
  language,
  code,
  activeFileName,
  onApplyCode,
}: {
  language: string;
  code: string;
  activeFileName: string;
  onApplyCode: (code: string) => void;
}) {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(code).catch(console.error);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <div className="my-2 rounded-xl overflow-hidden border border-white/10 bg-black/30">
      <div className="flex items-center justify-between px-3 py-1.5 bg-white/[0.04] border-b border-white/5">
        <span className="text-[9px] font-mono text-white/30">{language}</span>
        <div className="flex items-center gap-2">
          <button
            onClick={handleCopy}
            className="flex items-center gap-1 text-[9px] text-white/30 hover:text-white/70 transition-colors"
            aria-label="Copy code"
          >
            {copied ? <Check size={9} className="text-emerald-400" /> : <Copy size={9} />}
            {copied ? "Copied" : "Copy"}
          </button>
          <button
            onClick={() => onApplyCode(code)}
            className="flex items-center gap-1 text-[9px] font-black uppercase tracking-widest text-indigo-400 hover:text-white border border-indigo-500/30 hover:bg-indigo-500/20 rounded px-2 py-0.5 transition-all"
            aria-label={`Apply code to ${activeFileName}`}
          >
            Apply → {activeFileName}
          </button>
        </div>
      </div>
      <pre className="p-3 text-[11px] font-mono text-white/70 overflow-x-auto leading-relaxed">
        <code>{code}</code>
      </pre>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main Chat component
// ---------------------------------------------------------------------------

const WELCOME_MESSAGE: Message = {
  role: "Tutor",
  content:
    "Council initialized. Establishing connection to Multi-Agent Lab...\n\nHello, I'm your Socratic Tutor. The Lead Architect and Security Auditor are standing by. What are we building today?",
  id: 0,
};

export default function Chat({
  codeContext,
  provider,
  currentModule,
  activeFileName,
  onMilestoneUpdate,
  onApplyCode,
  initialMessages,
  onNewMessages,
}: ChatProps) {
  const [messages, setMessages] = useState<Message[]>([WELCOME_MESSAGE]);
  const [input, setInput]       = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isVoiceMode, setIsVoiceMode] = useState(false);
  const [timer, setTimer]       = useState(0);

  const messagesEndRef  = useRef<HTMLDivElement>(null);
  const msgIdCounter    = useRef(1);
  const timerRef        = useRef<ReturnType<typeof setInterval> | null>(null);
  const voiceWsRef      = useRef<WebSocket | null>(null);
  const streamAbortRef  = useRef<AbortController | null>(null);
  const hasInteracted   = useRef(false);
  const hydrated        = useRef(false);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isLoading]);

  // Unmount cleanup
  useEffect(() => {
    return () => {
      streamAbortRef.current?.abort();
      if (voiceWsRef.current && voiceWsRef.current.readyState !== WebSocket.CLOSED) {
        voiceWsRef.current.close();
      }
    };
  }, []);

  // Hydrate from persisted session — only once, only before any user interaction
  useEffect(() => {
    if (hydrated.current || hasInteracted.current) return;
    if (!initialMessages || initialMessages.length === 0) return;
    hydrated.current = true;
    const converted: Message[] = initialMessages.map(m => ({
      role: (m.role === "human" ? "human" : isAgentRole(m.role) ? m.role : "Tutor") as Message["role"],
      content: m.content,
      id: msgIdCounter.current++,
    }));
    msgIdCounter.current = converted.length + 1;
    setMessages([WELCOME_MESSAGE, ...converted]);
  }, [initialMessages]);

  // Loading timer
  useEffect(() => {
    if (isLoading) {
      setTimer(0);
      timerRef.current = setInterval(() => setTimer(p => p + 1), 1000);
    } else {
      if (timerRef.current) clearInterval(timerRef.current);
    }
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [isLoading]);

  // --------------------------------------------------------------------------
  // Voice mode
  // --------------------------------------------------------------------------
  const toggleVoiceMode = useCallback(async () => {
    if (isVoiceMode) {
      setIsVoiceMode(false);
      voiceWsRef.current?.close();
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const ws = new WebSocket(`${WS_BASE}/ws/voice-tutor`);

      ws.onmessage = (event) => {
        if (typeof event.data === "string") {
          const data = JSON.parse(event.data) as { role: string; content: string };
          const role: Message["role"] =
            data.role === "human" ? "human" : isAgentRole(data.role) ? data.role : "Tutor";
          setMessages(prev => [...prev, { role, content: data.content, id: msgIdCounter.current++ }]);
          return;
        }
        if (event.data instanceof Blob) {
          const url = URL.createObjectURL(event.data);
          const audio = new Audio(url);
          audio.play().catch(console.error);
          audio.onended = () => URL.revokeObjectURL(url);
        }
      };
      ws.onerror = err => console.error("Voice WS error", err);
      ws.onclose = () => setIsVoiceMode(false);
      voiceWsRef.current = ws;

      // Record 5-second segments — each Blob is a complete, valid audio file
      const recordSegment = () => {
        if (!voiceWsRef.current || voiceWsRef.current.readyState !== WebSocket.OPEN) return;
        const chunks: Blob[] = [];
        const recorder = new MediaRecorder(stream);
        recorder.ondataavailable = e => { if (e.data.size > 0) chunks.push(e.data); };
        recorder.onstop = () => {
          const blob = new Blob(chunks, { type: recorder.mimeType });
          if (blob.size > 500 && voiceWsRef.current?.readyState === WebSocket.OPEN) {
            voiceWsRef.current.send(blob);
          }
          setTimeout(recordSegment, 200);
        };
        recorder.start();
        setTimeout(() => { if (recorder.state === "recording") recorder.stop(); }, 5000);
      };
      ws.onopen = () => { setIsVoiceMode(true); recordSegment(); };
    } catch (err) {
      console.error("Failed to start voice mode", err);
      alert("Microphone access denied or backend unavailable.");
    }
  }, [isVoiceMode]);

  // --------------------------------------------------------------------------
  // Text chat — SSE streaming
  // --------------------------------------------------------------------------
  const handleSend = useCallback(async () => {
    if (!input.trim() || isLoading) return;

    hasInteracted.current = true;

    const userMessage = input.trim();
    setInput("");
    const humanMsg: Message = { role: "human", content: userMessage, id: msgIdCounter.current++ };
    setMessages(prev => [...prev, humanMsg]);
    setIsLoading(true);

    const controller = new AbortController();
    streamAbortRef.current = controller;
    const timeoutId = setTimeout(() => controller.abort(), 90_000);
    const roundTripMsgs: PersistedMessage[] = [{ role: "human", content: userMessage }];

    try {
      // Cap history to avoid unbounded token growth
      const cappedHistory = messages.slice(-MAX_HISTORY);

      const response = await fetch(`${API_BASE}/api/tutor/chat/stream`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        signal: controller.signal,
        body: JSON.stringify({
          message: userMessage,
          history: cappedHistory.map(m => ({ role: m.role === "human" ? "human" : "ai", content: m.content })),
          code_context: codeContext,
          provider,
          current_module: currentModule,
        }),
      });

      clearTimeout(timeoutId);
      if (!response.ok) throw new Error(`Server error: ${response.status}`);
      if (!response.body) throw new Error("No response body");

      const reader  = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer    = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const events = buffer.split("\n\n");
        buffer = events.pop() ?? "";

        for (const event of events) {
          const line = event.trim();
          if (!line.startsWith("data: ")) continue;
          const data = JSON.parse(line.slice(6)) as { role?: string; content?: string; done?: boolean };
          if (data.done) break;
          if (!data.role || !data.content) continue;

          if (data.role === "Taskmaster") {
            onMilestoneUpdate(data.content.replace("MILESTONE: ", "").trim());
            continue;
          }
          const role: Message["role"] = isAgentRole(data.role) ? data.role : "Tutor";
          setMessages(prev => [...prev, { role, content: data.content!, id: msgIdCounter.current++ }]);
          roundTripMsgs.push({ role: data.role, content: data.content! });
        }
      }
    } catch (err: unknown) {
      clearTimeout(timeoutId);
      console.error("Chat stream failure", err);
      const isTimeout = err instanceof Error && err.name === "AbortError";
      const errContent = isTimeout
        ? `SIGNAL TIMEOUT: The ${provider} engine is taking too long. Ensure the model is loaded and retry.`
        : "SIGNAL LOSS: Unable to reach the Council. Please check the backend and retry.";
      setMessages(prev => [...prev, { role: "Tutor", content: errContent, id: msgIdCounter.current++ }]);
    } finally {
      setIsLoading(false);
      streamAbortRef.current = null;
      if (roundTripMsgs.length > 0) onNewMessages?.(roundTripMsgs);
    }
  }, [input, isLoading, messages, codeContext, provider, currentModule, onMilestoneUpdate, onNewMessages]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div className="h-full w-full flex flex-col bg-black/40">
      {/* Header */}
      <div className="h-12 flex items-center px-6 border-b border-white/5 justify-between bg-white/[0.02] shrink-0">
        <div className="flex items-center gap-2">
          <Radio size={12} className={`text-indigo-500 ${isLoading ? "animate-pulse" : ""}`} />
          <span className="text-[10px] font-bold text-white/40 uppercase tracking-[0.2em]">Council Signal</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className={`w-1 h-1 rounded-full ${provider === "ollama" ? "bg-emerald-500" : "bg-indigo-500"}`} />
          <span className="text-[9px] font-bold text-white/20 uppercase tracking-widest">{provider}</span>
        </div>
      </div>

      {/* Message stream */}
      <div className="flex-1 p-6 overflow-y-auto flex flex-col gap-8 custom-scrollbar">
        <AnimatePresence initial={false}>
          {messages.map(msg => {
            const isHuman = msg.role === "human";
            const config  = !isHuman && isAgentRole(msg.role) ? AGENT_CONFIG[msg.role] : null;
            const Icon    = config ? config.icon : User;
            const parts   = isHuman ? null : parseContent(msg.content);

            return (
              <motion.div
                key={msg.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className={`flex gap-4 ${isHuman ? "flex-row-reverse" : "flex-row"}`}
              >
                <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 border border-white/5 ${isHuman ? "bg-white" : (config?.bg || "bg-white/5")}`}>
                  <Icon size={14} className={isHuman ? "text-black" : (config?.color || "text-white")} />
                </div>

                <div className={`flex flex-col gap-2 ${isHuman ? "items-end" : "items-start"} max-w-[85%]`}>
                  <div className={`text-[9px] font-black uppercase tracking-[0.2em] ${isHuman ? "text-white/40" : (config?.color || "text-indigo-400")}`}>
                    {msg.role}
                  </div>
                  <div className={`text-[12px] leading-relaxed p-4 rounded-xl border w-full ${
                    isHuman
                      ? "text-white bg-white/5 border-white/10"
                      : `text-white/70 ${config?.bg} ${config?.border}`
                  }`}>
                    {isHuman || !parts ? (
                      <span className="whitespace-pre-wrap">{msg.content}</span>
                    ) : (
                      parts.map((part, i) =>
                        part.type === "text" ? (
                          <span key={i} className="whitespace-pre-wrap">{part.text}</span>
                        ) : (
                          <CodeBlock
                            key={i}
                            language={part.language}
                            code={part.code}
                            activeFileName={activeFileName}
                            onApplyCode={onApplyCode}
                          />
                        )
                      )
                    )}
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
              <div className="text-white/20 text-[10px] font-bold uppercase tracking-[0.2em] mt-2">
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

      {/* Input */}
      <div className="p-6 border-t border-white/5 shrink-0">
        <div className="flex items-center gap-3">
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
            onChange={e => setInput(e.target.value)}
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
