"use client";

import { useEffect, useState } from "react";
import { CheckCircle2, Lock, Clock, ChevronDown, Sparkles, ArrowRight } from "lucide-react";
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

export default function CurriculumPanel({
  activeModuleIndex,
  onSelectModule,
  onLoadStarterCode,
}: CurriculumPanelProps) {
  const [curriculum, setCurriculum]   = useState<CurriculumData | null>(null);
  const [expandedIndex, setExpanded]  = useState<number | null>(activeModuleIndex);

  useEffect(() => {
    fetch(`${API_BASE}/api/curriculum`).then(r => r.json()).then(setCurriculum).catch(console.error);
  }, []);

  useEffect(() => { setExpanded(activeModuleIndex); }, [activeModuleIndex]);

  if (!curriculum) {
    return (
      <div className="h-full flex items-center justify-center p-6">
        <div className="flex flex-col items-center gap-3 text-center">
          <div className="w-8 h-8 rounded-xl border border-white/10 flex items-center justify-center">
            <div className="w-3 h-3 rounded-full border-2 border-indigo-500 border-t-transparent animate-spin" />
          </div>
          <span className="text-xs text-white/25">Loading curriculum…</span>
        </div>
      </div>
    );
  }

  const total       = curriculum.modules.length;
  const completed   = activeModuleIndex;
  const progressPct = Math.round((completed / total) * 100);

  return (
    <div className="h-full flex flex-col overflow-hidden">

      {/* Sidebar header */}
      <div className="px-5 pt-5 pb-4 border-b border-white/[0.06] shrink-0">
        <div className="text-[10px] font-bold uppercase tracking-widest text-white/25 mb-3">Your Path</div>
        <div className="text-sm font-semibold text-white/80 leading-snug mb-1">{curriculum.title}</div>
        <div className="text-xs text-white/35 leading-relaxed mb-4">{curriculum.description}</div>

        {/* Progress */}
        <div className="flex items-center justify-between mb-1.5">
          <span className="text-[10px] text-white/30 font-medium">{completed} of {total} completed</span>
          <span className="text-[10px] font-bold text-indigo-400">{progressPct}%</span>
        </div>
        <div className="h-1.5 bg-white/[0.06] rounded-full overflow-hidden">
          <motion.div
            className="h-full bg-indigo-500 rounded-full"
            initial={{ width: 0 }}
            animate={{ width: `${progressPct}%` }}
            transition={{ duration: 0.5, ease: "easeOut" }}
          />
        </div>
      </div>

      {/* Module list */}
      <div className="flex-1 overflow-y-auto custom-scrollbar py-3 px-3 flex flex-col gap-1.5">
        {curriculum.modules.map((mod, i) => {
          const isActive   = i === activeModuleIndex;
          const isComplete = i < activeModuleIndex;
          const isLocked   = i > activeModuleIndex;
          const isExpanded = expandedIndex === i;

          return (
            <div
              key={mod.id}
              className={`rounded-xl border overflow-hidden transition-all duration-200 ${
                isActive
                  ? "border-indigo-500/25 bg-indigo-500/[0.06]"
                  : isComplete
                  ? "border-emerald-500/[0.12] bg-emerald-500/[0.03]"
                  : "border-white/[0.05] bg-white/[0.01]"
              }`}
            >
              <button
                onClick={() => {
                  if (!isLocked) {
                    setExpanded(isExpanded ? null : i);
                    onSelectModule(i);
                  }
                }}
                disabled={isLocked}
                className="w-full flex items-center gap-3 px-3.5 py-3 text-left disabled:cursor-not-allowed"
              >
                {/* Status icon */}
                <div className="shrink-0">
                  {isComplete ? (
                    <CheckCircle2 size={15} className="text-emerald-400" />
                  ) : isActive ? (
                    <div className="w-3.5 h-3.5 rounded-full border-2 border-indigo-400 bg-indigo-400/20" />
                  ) : (
                    <Lock size={13} className="text-white/15" />
                  )}
                </div>

                {/* Module info */}
                <div className="flex-1 min-w-0">
                  <div className={`text-xs font-semibold leading-snug truncate ${
                    isActive ? "text-white/90" : isComplete ? "text-white/50" : "text-white/20"
                  }`}>
                    {mod.title}
                  </div>
                  <div className="flex items-center gap-1 mt-0.5">
                    <Clock size={9} className="text-white/15" />
                    <span className="text-[10px] text-white/20">{mod.estimated_minutes} min</span>
                  </div>
                </div>

                {!isLocked && (
                  <ChevronDown
                    size={13}
                    className={`text-white/20 transition-transform shrink-0 ${isExpanded ? "rotate-180" : ""}`}
                  />
                )}
              </button>

              {/* Expanded detail */}
              <AnimatePresence initial={false}>
                {isExpanded && !isLocked && (
                  <motion.div
                    initial={{ height: 0 }}
                    animate={{ height: "auto" }}
                    exit={{ height: 0 }}
                    transition={{ duration: 0.2, ease: "easeInOut" }}
                    className="overflow-hidden"
                  >
                    <div className="px-4 pb-4 pt-3 border-t border-white/[0.06] flex flex-col gap-3">
                      {/* Objective */}
                      <div>
                        <div className="text-[9px] font-bold uppercase tracking-widest text-white/25 mb-1.5">What you'll learn</div>
                        <p className="text-xs text-white/50 leading-relaxed">{mod.objective}</p>
                      </div>

                      {/* Concepts as pills */}
                      {mod.concepts?.length > 0 && (
                        <div className="flex flex-wrap gap-1">
                          {mod.concepts.map((c, ci) => (
                            <span key={ci} className="px-2 py-0.5 bg-indigo-500/[0.08] border border-indigo-500/[0.15] rounded-full text-[10px] text-indigo-300/60">
                              {c}
                            </span>
                          ))}
                        </div>
                      )}

                      {/* Project */}
                      <div>
                        <div className="text-[9px] font-bold uppercase tracking-widest text-white/25 mb-1.5">Project</div>
                        <p className="text-xs text-white/40 leading-relaxed">{mod.project}</p>
                      </div>

                      {/* Actions */}
                      <div className="flex gap-2 pt-1">
                        {isActive && mod.starter_code && (
                          <button
                            onClick={() => onLoadStarterCode(mod.starter_code)}
                            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-indigo-500/[0.12] border border-indigo-500/25 text-indigo-300 text-xs font-semibold hover:bg-indigo-500/20 transition-all"
                          >
                            <Sparkles size={11} />
                            Starter Code
                          </button>
                        )}
                        {isActive && i + 1 < total && (
                          <button
                            onClick={() => onSelectModule(i + 1)}
                            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/[0.04] border border-white/[0.08] text-white/40 text-xs font-semibold hover:text-white/65 hover:bg-white/[0.07] transition-all"
                          >
                            Next
                            <ArrowRight size={11} />
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
