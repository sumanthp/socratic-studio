"use client";

import { useEffect, useState } from "react";
import { CheckCircle2, Circle, Lock, BookOpen, Clock, ChevronRight, Sparkles } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://127.0.0.1:8000";

interface Module {
  id: string;
  order: number;
  title: string;
  milestone: string;
  objective: string;
  project: string;
  concepts: string[];
  estimated_minutes: number;
  starter_code: string;
}

interface CurriculumData {
  path_id: string;
  title: string;
  description: string;
  modules: Module[];
}

interface CurriculumPanelProps {
  activeModuleIndex: number;
  onSelectModule: (index: number) => void;
  onLoadStarterCode: (code: string) => void;
}

function ModuleStatus({ index, activeIndex }: { index: number; activeIndex: number }) {
  if (index < activeIndex)
    return <CheckCircle2 size={14} className="text-emerald-400 shrink-0" />;
  if (index === activeIndex)
    return <div className="w-3.5 h-3.5 rounded-full border-2 border-indigo-400 bg-indigo-400/20 shrink-0" />;
  return <Lock size={12} className="text-white/15 shrink-0" />;
}

export default function CurriculumPanel({
  activeModuleIndex,
  onSelectModule,
  onLoadStarterCode,
}: CurriculumPanelProps) {
  const [curriculum, setCurriculum] = useState<CurriculumData | null>(null);
  const [expandedIndex, setExpandedIndex] = useState<number | null>(activeModuleIndex);

  useEffect(() => {
    fetch(`${API_BASE}/api/curriculum`)
      .then(r => r.json())
      .then(setCurriculum)
      .catch(console.error);
  }, []);

  useEffect(() => {
    setExpandedIndex(activeModuleIndex);
  }, [activeModuleIndex]);

  if (!curriculum) {
    return (
      <div className="h-full flex items-center justify-center text-white/20 text-[11px]">
        Loading curriculum...
      </div>
    );
  }

  const totalModules = curriculum.modules.length;
  const progressPct = Math.round((activeModuleIndex / totalModules) * 100);

  return (
    <div className="h-full flex flex-col overflow-hidden">
      {/* Header */}
      <div className="px-6 py-5 border-b border-white/5 bg-white/[0.02] shrink-0">
        <div className="flex items-center gap-2 mb-3">
          <BookOpen size={13} className="text-indigo-400" />
          <span className="text-[10px] font-black uppercase tracking-[0.25em] text-indigo-300/70">
            {curriculum.title}
          </span>
        </div>
        <p className="text-[10px] text-white/30 leading-relaxed mb-4">{curriculum.description}</p>

        {/* Progress bar */}
        <div className="flex items-center gap-3">
          <div className="flex-1 h-1 bg-white/5 rounded-full overflow-hidden">
            <motion.div
              className="h-full bg-indigo-500 rounded-full"
              initial={{ width: 0 }}
              animate={{ width: `${progressPct}%` }}
              transition={{ duration: 0.6, ease: "easeOut" }}
            />
          </div>
          <span className="text-[9px] text-white/25 font-mono shrink-0">
            {activeModuleIndex}/{totalModules}
          </span>
        </div>
      </div>

      {/* Module list */}
      <div className="flex-1 overflow-y-auto custom-scrollbar px-4 py-4 flex flex-col gap-2">
        {curriculum.modules.map((mod, i) => {
          const isActive   = i === activeModuleIndex;
          const isComplete = i < activeModuleIndex;
          const isLocked   = i > activeModuleIndex;
          const isExpanded = expandedIndex === i;

          return (
            <div
              key={mod.id}
              className={`rounded-xl border transition-all overflow-hidden ${
                isActive
                  ? "border-indigo-500/30 bg-indigo-500/5"
                  : isComplete
                  ? "border-emerald-500/15 bg-emerald-500/[0.03]"
                  : "border-white/5 bg-white/[0.01]"
              }`}
            >
              {/* Module header row */}
              <button
                onClick={() => {
                  if (!isLocked) {
                    setExpandedIndex(isExpanded ? null : i);
                    onSelectModule(i);
                  }
                }}
                disabled={isLocked}
                className="w-full flex items-center gap-3 px-4 py-3 text-left disabled:cursor-not-allowed"
              >
                <ModuleStatus index={i} activeIndex={activeModuleIndex} />
                <div className="flex-1 min-w-0">
                  <div className={`text-[11px] font-black uppercase tracking-[0.15em] truncate ${
                    isActive ? "text-indigo-200" : isComplete ? "text-white/50" : "text-white/15"
                  }`}>
                    {mod.title}
                  </div>
                  <div className="flex items-center gap-1.5 mt-0.5">
                    <Clock size={9} className="text-white/15" />
                    <span className="text-[9px] text-white/20">{mod.estimated_minutes} min</span>
                  </div>
                </div>
                {!isLocked && (
                  <ChevronRight
                    size={12}
                    className={`text-white/20 transition-transform shrink-0 ${isExpanded ? "rotate-90" : ""}`}
                  />
                )}
              </button>

              {/* Expanded module detail */}
              <AnimatePresence initial={false}>
                {isExpanded && !isLocked && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: "auto", opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.2 }}
                    className="overflow-hidden"
                  >
                    <div className="px-4 pb-4 flex flex-col gap-3 border-t border-white/5 pt-3">
                      <div>
                        <div className="text-[9px] font-black text-white/25 uppercase tracking-[0.2em] mb-1">Objective</div>
                        <p className="text-[10px] text-white/50 leading-relaxed">{mod.objective}</p>
                      </div>
                      <div>
                        <div className="text-[9px] font-black text-white/25 uppercase tracking-[0.2em] mb-1">Project</div>
                        <p className="text-[10px] text-white/50 leading-relaxed">{mod.project}</p>
                      </div>

                      {/* Action buttons */}
                      <div className="flex gap-2 pt-1">
                        {isActive && mod.starter_code && (
                          <button
                            onClick={() => onLoadStarterCode(mod.starter_code)}
                            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-indigo-500/15 border border-indigo-500/25 text-indigo-300 text-[9px] font-black uppercase tracking-[0.15em] hover:bg-indigo-500/25 transition-all"
                          >
                            <Sparkles size={10} />
                            Load Starter Code
                          </button>
                        )}
                        {isActive && i + 1 < totalModules && (
                          <button
                            onClick={() => onSelectModule(i + 1)}
                            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/5 border border-white/10 text-white/40 text-[9px] font-black uppercase tracking-[0.15em] hover:text-white hover:bg-white/10 transition-all"
                          >
                            Next Module
                            <ChevronRight size={10} />
                          </button>
                        )}
                      </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          );
        })}
      </div>
    </div>
  );
}
