"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { Send, Bot, User, Loader2, ShieldAlert, Cpu, Layout, Mic, MicOff, Copy, Check, Sparkles } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://127.0.0.1:8000";
const WS_BASE  = API_BASE.replace(/^http/, "ws");

const MAX_HISTORY = 10;

type AgentRole = "Architect" | "Auditor" | "Debugger" | "Tutor";

interface Message {
  role: "human" | AgentRole;
  content: string;
  id: number;
}

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

const AGENT_CONFIG: Record<AgentRole, {
  icon: React.ElementType;
  label: string;
  color: string;
  pillBg: string;
  pillText: string;
  borderColor: string;
}> = {
  Architect: {
    icon: Layout,
    label: "Architect",
    color: "text-blue-400",
    pillBg: "bg-blue-500/10",
    pillText: "text-blue-300",
    borderColor: "border-l-blue-500/40",
  },
  Auditor: {
    icon: ShieldAlert,
    label: "Auditor",
    color: "text-amber-400",
    pillBg: "bg-amber-500/10",
    pillText: "text-amber-300",
    borderColor: "border-l-amber-500/40",
  },
  Debugger: {
    icon: Cpu,
    label: "Debugger",
    color: "text-rose-400",
    pillBg: "bg-rose-500/10",
    pillText: "text-rose-300",
    borderColor: "border-l-rose-500/40",
  },
  Tutor: {
    icon: Sparkles,
    label: "Tutor",
    color: "text-indigo-400",
    pillBg: "bg-indigo-500/10",
    pillText: "text-indigo-300",
    borderColor: "border-l-indigo-500/40",
  },
};

const KNOWN_AGENT_ROLES = new Set<string>(["Architect", "Auditor", "Debugger", "Tutor"]);
function isAgentRole(role: string): role is AgentRole {
  return KNOWN_AGENT_ROLES.has(role);
}

// ---------------------------------------------------------------------------
// Code block component (used inside ReactMarkdown)
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
    <div className="my-3 rounded-xl overflow-hidden border border-white/[0.09] bg-[#09090f]">
      <div className="flex items-center justify-between px-4 py-2 bg-white/[0.03] border-b border-white/[0.06]">
        <span className="text-[11px] font-mono text-white/30 tracking-wide">{language}</span>
        <div className="flex items-center gap-3">
          <button
            onClick={handleCopy}
            className="flex items-center gap-1.5 text-xs text-white/30 hover:text-white/65 transition-colors"
          >
            {copied ? <Check size={11} className="text-emerald-400" /> : <Copy size={11} />}
            {copied ? "Copied" : "Copy"}
          </button>
          <button
            onClick={() => onApplyCode(code)}
            className="flex items-center gap-1.5 text-xs font-semibold text-indigo-400 hover:text-white border border-indigo-500/25 hover:border-indigo-400/50 hover:bg-indigo-500/15 rounded-lg px-2.5 py-0.5 transition-all"
          >
            Apply to {activeFileName}
          </button>
        </div>
      </div>
      <pre className="px-4 py-3.5 text-[13px] font-mono text-white/75 overflow-x-auto leading-6 custom-scrollbar">
        <code>{code}</code>
      </pre>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Welcome message
// ---------------------------------------------------------------------------

const WELCOME_MESSAGE: Message = {
  role: "Tutor",
  content:
    "Welcome! I'm your AI tutor for this course.\n\n" +
    "I can explain concepts, review your code, walk through exercises step by step, and bring in specialized agents (Architect, Debugger, Auditor) when needed.\n\n" +
    "What would you like to explore today?",
  id: 0,
};

// ---------------------------------------------------------------------------
// Main Chat component
// ---------------------------------------------------------------------------

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
  const textareaRef     = useRef<HTMLTextAreaElement>(null);
  const msgIdCounter    = useRef(1);
  const timerRef        = useRef<ReturnType<typeof setInterval> | null>(null);
  const voiceWsRef      = useRef<WebSocket | null>(null);
  const streamAbortRef  = useRef<AbortController | null>(null);
  const hasInteracted   = useRef(false);
  const hydrated        = useRef(false);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isLoading]);

  useEffect(() => {
    return () => {
      streamAbortRef.current?.abort();
      if (voiceWsRef.current && voiceWsRef.current.readyState !== WebSocket.CLOSED) {
        voiceWsRef.current.close();
      }
    };
  }, []);

  useEffect(() => {
    if (hydrated.current || hasInteracted.current) return;
    if (!initialMessages?.length) return;
    hydrated.current = true;
    const converted: Message[] = initialMessages.map(m => ({
      role: (m.role === "human" ? "human" : isAgentRole(m.role) ? m.role : "Tutor") as Message["role"],
      content: m.content,
      id: msgIdCounter.current++,
    }));
    msgIdCounter.current = converted.length + 1;
    setMessages([WELCOME_MESSAGE, ...converted]);
  }, [initialMessages]);

  useEffect(() => {
    if (isLoading) {
      setTimer(0);
      timerRef.current = setInterval(() => setTimer(p => p + 1), 1000);
    } else {
      if (timerRef.current) clearInterval(timerRef.current);
    }
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [isLoading]);

  // Auto-resize textarea
  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInput(e.target.value);
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 160)}px`;
    }
  };

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
    } catch {
      alert("Microphone access denied or backend unavailable.");
    }
  }, [isVoiceMode]);

  // --------------------------------------------------------------------------
  // Text chat — SSE streaming
  // --------------------------------------------------------------------------
  const handleSend = useCallback(async () => {
    const text = input.trim();
    if (!text || isLoading) return;
    hasInteracted.current = true;
    setInput("");
    if (textareaRef.current) { textareaRef.current.style.height = "auto"; }

    const humanMsg: Message = { role: "human", content: text, id: msgIdCounter.current++ };
    setMessages(prev => [...prev, humanMsg]);
    setIsLoading(true);

    const controller = new AbortController();
    streamAbortRef.current = controller;
    const timeoutId = setTimeout(() => controller.abort(), 90_000);
    const roundTripMsgs: PersistedMessage[] = [{ role: "human", content: text }];

    try {
      const cappedHistory = messages.slice(-MAX_HISTORY);
      const response = await fetch(`${API_BASE}/api/tutor/chat/stream`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        signal: controller.signal,
        body: JSON.stringify({
          message: text,
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
      const isTimeout = err instanceof Error && err.name === "AbortError";
      const errContent = isTimeout
        ? "The AI is taking too long to respond. Make sure your model is loaded and try again."
        : "Unable to reach the backend. Please check that it's running and try again.";
      setMessages(prev => [...prev, { role: "Tutor", content: errContent, id: msgIdCounter.current++ }]);
    } finally {
      setIsLoading(false);
      streamAbortRef.current = null;
      if (roundTripMsgs.length > 0) onNewMessages?.(roundTripMsgs);
    }
  }, [input, isLoading, messages, codeContext, provider, currentModule, onMilestoneUpdate, onNewMessages]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  // --------------------------------------------------------------------------
  // Render
  // --------------------------------------------------------------------------
  return (
    <div className="h-full w-full flex flex-col" style={{ background: "var(--background)" }}>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto custom-scrollbar px-6 py-6 flex flex-col gap-5">
        <AnimatePresence initial={false}>
          {messages.map(msg => {
            const isHuman = msg.role === "human";
            const config  = !isHuman && isAgentRole(msg.role) ? AGENT_CONFIG[msg.role] : null;
            const Icon    = config?.icon ?? Bot;

            if (isHuman) {
              return (
                <motion.div
                  key={msg.id}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="flex justify-end"
                >
                  <div className="max-w-[75%] flex items-end gap-2.5">
                    <div className="bg-white/[0.07] border border-white/[0.09] rounded-2xl rounded-br-sm px-4 py-3 text-sm leading-relaxed text-white/85">
                      {msg.content}
                    </div>
                    <div className="w-7 h-7 rounded-full bg-white/10 flex items-center justify-center shrink-0 mb-0.5">
                      <User size={13} className="text-white/50" />
                    </div>
                  </div>
                </motion.div>
              );
            }

            return (
              <motion.div
                key={msg.id}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                className="flex items-start gap-3"
              >
                {/* Agent avatar */}
                <div className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 mt-0.5 border ${config?.pillBg ?? "bg-white/5"} ${config ? "border-white/10" : "border-white/5"}`}>
                  <Icon size={15} className={config?.color ?? "text-white/40"} />
                </div>

                {/* Message body */}
                <div className="flex-1 min-w-0">
                  {/* Agent role chip */}
                  <div className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md text-[11px] font-semibold mb-2 ${config?.pillBg ?? "bg-white/5"} ${config?.pillText ?? "text-white/40"}`}>
                    {config?.label ?? msg.role}
                  </div>

                  {/* Message content — markdown rendered */}
                  <div className={`pl-0 border-l-2 ${config?.borderColor ?? "border-l-white/10"} pl-3`}>
                    <div className="ai-prose text-sm text-white/80 leading-relaxed">
                      <ReactMarkdown
                        remarkPlugins={[remarkGfm]}
                        components={{
                          // Block code → custom CodeBlock
                          code({ className, children }) {
                            const match = /language-(\w+)/.exec(className || "");
                            if (match) {
                              return (
                                <CodeBlock
                                  language={match[1]}
                                  code={String(children).replace(/\n$/, "")}
                                  activeFileName={activeFileName}
                                  onApplyCode={onApplyCode}
                                />
                              );
                            }
                            return (
                              <code className="bg-white/10 px-1.5 py-0.5 rounded text-[0.88em] font-mono text-indigo-200">
                                {children}
                              </code>
                            );
                          },
                          pre({ children }) {
                            return <>{children}</>;
                          },
                        }}
                      >
                        {msg.content}
                      </ReactMarkdown>
                    </div>
                  </div>
                </div>
              </motion.div>
            );
          })}
        </AnimatePresence>

        {/* Loading indicator */}
        {isLoading && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex items-start gap-3"
          >
            <div className="w-8 h-8 rounded-xl bg-indigo-500/10 border border-white/10 flex items-center justify-center shrink-0">
              <Loader2 size={15} className="animate-spin text-indigo-400" />
            </div>
            <div className="pt-2">
              <div className="flex items-center gap-2">
                <div className="flex gap-1">
                  {[0, 1, 2].map(i => (
                    <motion.div
                      key={i}
                      className="w-1.5 h-1.5 rounded-full bg-indigo-500/50"
                      animate={{ opacity: [0.3, 1, 0.3] }}
                      transition={{ duration: 1.2, repeat: Infinity, delay: i * 0.2 }}
                    />
                  ))}
                </div>
                <span className="text-xs text-white/30">{timer > 0 ? `${timer}s` : "Thinking..."}</span>
              </div>
              {timer > 10 && (
                <p className="text-xs text-white/20 mt-1 italic">Local models can take up to 30s…</p>
              )}
            </div>
          </motion.div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Input area */}
      <div className="shrink-0 px-5 pb-5 pt-3 border-t border-white/[0.06]">
        {isVoiceMode && (
          <div className="flex items-center gap-2 mb-3 px-3 py-2 bg-rose-500/[0.08] border border-rose-500/20 rounded-xl">
            <div className="w-2 h-2 rounded-full bg-rose-500 animate-pulse" />
            <span className="text-xs text-rose-300">Voice mode active — speaking in 5s segments</span>
          </div>
        )}

        <div className="flex items-end gap-2.5 bg-white/[0.04] border border-white/[0.08] rounded-2xl px-4 py-3 focus-within:border-indigo-500/30 transition-colors">
          <button
            onClick={toggleVoiceMode}
            className={`shrink-0 p-1.5 rounded-lg transition-all ${isVoiceMode ? "text-rose-400 bg-rose-500/15" : "text-white/25 hover:text-white/55 hover:bg-white/[0.06]"}`}
          >
            {isVoiceMode ? <MicOff size={16} /> : <Mic size={16} />}
          </button>

          <textarea
            ref={textareaRef}
            rows={1}
            value={input}
            onChange={handleInputChange}
            onKeyDown={handleKeyDown}
            placeholder={isLoading ? "Waiting for response…" : "Ask anything about the lesson, your code, or a concept…"}
            disabled={isLoading}
            className="flex-1 bg-transparent text-sm text-white/85 placeholder-white/20 focus:outline-none resize-none leading-relaxed overflow-hidden disabled:opacity-40"
            style={{ minHeight: "24px" }}
          />

          <button
            onClick={handleSend}
            disabled={isLoading || !input.trim()}
            className="shrink-0 w-8 h-8 flex items-center justify-center bg-indigo-600 hover:bg-indigo-500 disabled:bg-white/[0.06] disabled:text-white/15 text-white rounded-xl transition-all active:scale-[0.93] shadow-lg shadow-indigo-500/20"
          >
            <Send size={14} />
          </button>
        </div>

        <p className="text-[10px] text-white/15 mt-2 text-center">
          Press Enter to send · Shift+Enter for new line
        </p>
      </div>
    </div>
  );
}
