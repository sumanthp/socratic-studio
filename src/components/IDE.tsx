"use client";

import { useState, useCallback } from "react";
import { Panel, Group as PanelGroup, Separator as PanelResizeHandle } from "react-resizable-panels";
import Editor from "./Editor";
import Terminal from "./Terminal";
import Chat from "./Chat";
import CurriculumPanel from "./CurriculumPanel";
import { Code2, Globe, Cpu, BookOpen, MessageSquare } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import type { FileEntry } from "@/types";

const MODULE_IDS = [
  "m1_api_basics",
  "m2_prompt_engineering",
  "m3_rag",
  "m4_agents",
  "m5_local_models",
];

const DEFAULT_CODE = `import os
from openai import OpenAI

# Initialize the OpenAI client
client = OpenAI(api_key=os.environ.get("OPENAI_API_KEY"))

def generate_greeting(name):
    """
    Generates a personalized greeting using the OpenAI API.
    """
    # TODO: Implement the API call here
    pass

# Test your function
if __name__ == "__main__":
    print(generate_greeting("Alice"))
`;

export default function IDE() {
  // ---- File state --------------------------------------------------------
  const [files, setFiles] = useState<FileEntry[]>([
    { name: "main.py", content: DEFAULT_CODE },
  ]);
  const [activeFileName, setActiveFileName] = useState("main.py");

  // ---- Execution trigger -------------------------------------------------
  const [executionCount, setExecutionCount] = useState(0);

  // ---- Curriculum state --------------------------------------------------
  const [milestone, setMilestone] = useState("API Basics & Prompting");
  const [activeModuleIndex, setActiveModuleIndex] = useState(0);
  const [leftTab, setLeftTab] = useState<"council" | "curriculum">("council");

  // ---- Provider ----------------------------------------------------------
  const [provider, setProvider] = useState("openai");

  // ---- File callbacks ----------------------------------------------------
  const addFile = useCallback((name: string) => {
    setFiles(prev => {
      if (prev.find(f => f.name === name)) return prev;
      return [...prev, { name, content: "" }];
    });
    setActiveFileName(name);
  }, []);

  const removeFile = useCallback((name: string) => {
    setFiles(prev => {
      if (prev.length <= 1) return prev;
      const next = prev.filter(f => f.name !== name);
      if (name === activeFileName) setActiveFileName(next[0].name);
      return next;
    });
  }, [activeFileName]);

  const updateFileContent = useCallback((name: string, content: string) => {
    setFiles(prev => prev.map(f => f.name === name ? { ...f, content } : f));
  }, []);

  // ---- Apply code from chat agent ----------------------------------------
  const handleApplyCode = useCallback((code: string) => {
    setFiles(prev => prev.map(f => f.name === activeFileName ? { ...f, content: code } : f));
  }, [activeFileName]);

  // ---- Curriculum callbacks ----------------------------------------------
  const handleSelectModule = useCallback((index: number) => {
    setActiveModuleIndex(index);
  }, []);

  const handleLoadStarterCode = useCallback((code: string) => {
    setFiles(prev => prev.map(f => f.name === "main.py" ? { ...f, content: code } : f));
    setActiveFileName("main.py");
  }, []);

  // Code context passed to the chat (all files formatted)
  const codeContext = files
    .map(f => `# === ${f.name} ===\n${f.content}`)
    .join("\n\n");

  const currentModuleId = MODULE_IDS[activeModuleIndex] ?? MODULE_IDS[0];

  return (
    <div className="fixed inset-0 flex flex-col p-6">
      {/* Background layers */}
      <div className="aether-bg" />
      <div className="blueprint-grid" />
      <div className="scan-line" />

      {/* Header */}
      <header className="h-16 flex-shrink-0 flex items-center justify-between px-8 mb-6 bg-white/[0.03] border border-white/10 backdrop-blur-3xl rounded-2xl relative z-50 shadow-2xl shadow-indigo-500/5">
        <div className="flex items-center gap-8">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-indigo-500 flex items-center justify-center shadow-lg shadow-indigo-500/20 border border-indigo-400/20">
              <Code2 size={20} className="text-white" />
            </div>
            <div>
              <h1 className="text-xs font-black tracking-[0.3em] uppercase text-white/95">Oasis</h1>
              <p className="text-[8px] font-bold text-white/20 uppercase tracking-[0.4em] -mt-0.5">Laboratory.Alpha</p>
            </div>
          </div>

          <div className="h-6 w-px bg-white/10" />

          <AnimatePresence mode="wait">
            <motion.div
              key={milestone}
              initial={{ opacity: 0, y: -5 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 5 }}
              className="flex items-center gap-3 px-4 py-2 bg-indigo-500/5 border border-indigo-500/10 rounded-xl"
            >
              <div className="w-1.5 h-1.5 rounded-full bg-indigo-500 shadow-[0_0_8px_rgba(99,102,241,0.8)] animate-pulse" />
              <span className="text-[10px] font-black uppercase tracking-[0.2em] text-indigo-100/70">{milestone}</span>
            </motion.div>
          </AnimatePresence>
        </div>

        <div className="flex items-center gap-6">
          {/* Provider toggle */}
          <div className="flex items-center bg-black/60 p-1 rounded-xl border border-white/5 shadow-2xl">
            <button
              onClick={() => setProvider("openai")}
              className={`flex items-center gap-2 px-5 py-2 rounded-lg text-[9px] font-black uppercase tracking-[0.15em] transition-all ${provider === "openai" ? "bg-white text-black shadow-xl scale-[1.02]" : "text-white/20 hover:text-white/40"}`}
            >
              <Globe size={11} />
              OpenAI
            </button>
            <button
              onClick={() => setProvider("ollama")}
              className={`flex items-center gap-2 px-5 py-2 rounded-lg text-[9px] font-black uppercase tracking-[0.15em] transition-all ${provider === "ollama" ? "bg-indigo-600 text-white shadow-xl shadow-indigo-500/40 scale-[1.02] border border-indigo-400/30" : "text-white/20 hover:text-white/40"}`}
            >
              <Cpu size={11} />
              Ollama
            </button>
          </div>

          <button
            onClick={() => setExecutionCount(c => c + 1)}
            className="px-8 h-10 rounded-xl bg-white text-black font-black text-[10px] uppercase tracking-[0.25em] transition-all hover:bg-indigo-50 hover:scale-[1.05] active:scale-[0.95] shadow-2xl shadow-white/10 border border-white/20"
          >
            Run Prototype
          </button>
        </div>
      </header>

      {/* Main workspace */}
      <main className="flex-1 min-h-0 relative z-10">
        <PanelGroup direction="horizontal">

          {/* Left panel: Council + Curriculum tabs */}
          <Panel defaultSize={28} minSize={20} className="bg-white/[0.01] border border-white/5 rounded-3xl overflow-hidden backdrop-blur-sm relative shadow-2xl shadow-black/50 flex flex-col">
            <div className="absolute top-0 left-0 w-full h-[1px] bg-gradient-to-r from-transparent via-indigo-500/30 to-transparent" />

            {/* Tab bar */}
            <div className="flex border-b border-white/5 shrink-0">
              <button
                onClick={() => setLeftTab("council")}
                className={`flex-1 flex items-center justify-center gap-2 py-3 text-[9px] font-black uppercase tracking-[0.2em] transition-colors ${
                  leftTab === "council"
                    ? "text-indigo-300 border-b-2 border-indigo-500 bg-white/[0.02]"
                    : "text-white/25 hover:text-white/50"
                }`}
              >
                <MessageSquare size={11} />
                Council
              </button>
              <button
                onClick={() => setLeftTab("curriculum")}
                className={`flex-1 flex items-center justify-center gap-2 py-3 text-[9px] font-black uppercase tracking-[0.2em] transition-colors ${
                  leftTab === "curriculum"
                    ? "text-indigo-300 border-b-2 border-indigo-500 bg-white/[0.02]"
                    : "text-white/25 hover:text-white/50"
                }`}
              >
                <BookOpen size={11} />
                Curriculum
              </button>
            </div>

            {/* Tab content */}
            <div className="flex-1 min-h-0">
              {leftTab === "council" ? (
                <Chat
                  codeContext={codeContext}
                  provider={provider}
                  currentModule={currentModuleId}
                  activeFileName={activeFileName}
                  onMilestoneUpdate={setMilestone}
                  onApplyCode={handleApplyCode}
                />
              ) : (
                <CurriculumPanel
                  activeModuleIndex={activeModuleIndex}
                  onSelectModule={handleSelectModule}
                  onLoadStarterCode={handleLoadStarterCode}
                />
              )}
            </div>
          </Panel>

          <PanelResizeHandle className="w-4 group flex items-center justify-center transition-all">
            <div className="w-px h-12 bg-white/5 group-hover:bg-indigo-500/50 transition-colors shadow-[0_0_10px_rgba(99,102,241,0.5)]" />
          </PanelResizeHandle>

          {/* Right panel: Editor + Terminal */}
          <Panel defaultSize={72}>
            <PanelGroup direction="vertical">
              <Panel defaultSize={65} minSize={30} className="bg-white/[0.01] border border-white/5 rounded-3xl overflow-hidden backdrop-blur-sm flex flex-col relative shadow-2xl shadow-black/50">
                <Editor
                  files={files}
                  activeFileName={activeFileName}
                  onFileChange={updateFileContent}
                  onActiveChange={setActiveFileName}
                  onAddFile={addFile}
                  onRemoveFile={removeFile}
                />
              </Panel>

              <PanelResizeHandle className="h-4 group flex items-center justify-center transition-all">
                <div className="h-px w-12 bg-white/5 group-hover:bg-indigo-500/50 transition-colors shadow-[0_0_10px_rgba(99,102,241,0.5)]" />
              </PanelResizeHandle>

              <Panel defaultSize={35} minSize={15} className="bg-black/40 border border-white/5 rounded-3xl overflow-hidden backdrop-blur-sm relative shadow-2xl shadow-black/50">
                <Terminal files={files} executionCount={executionCount} />
              </Panel>
            </PanelGroup>
          </Panel>

        </PanelGroup>
      </main>
    </div>
  );
}
