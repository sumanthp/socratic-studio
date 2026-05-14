"use client";

import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { User } from "lucide-react";

interface DisplayNameModalProps {
  open: boolean;
  onSubmit: (name: string) => void;
}

export default function DisplayNameModal({ open, onSubmit }: DisplayNameModalProps) {
  const [value, setValue] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) {
      setTimeout(() => inputRef.current?.focus(), 150);
    }
  }, [open]);

  const handleSubmit = () => {
    const name = value.trim();
    if (name) onSubmit(name);
  };

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 backdrop-blur-sm"
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.92, y: 16 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.92, y: 16 }}
            transition={{ type: "spring", stiffness: 340, damping: 28 }}
            className="w-full max-w-sm mx-4 bg-[#09090b] border border-white/10 rounded-2xl shadow-2xl shadow-indigo-500/10 p-8 flex flex-col gap-6"
          >
            <div className="flex flex-col items-center gap-3">
              <div className="w-12 h-12 rounded-xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center">
                <User size={22} className="text-indigo-400" />
              </div>
              <div className="text-center">
                <p className="text-white font-black text-sm uppercase tracking-[0.2em]">Welcome to Oasis</p>
                <p className="text-white/40 text-[11px] mt-1">Enter a display name to personalize your session</p>
              </div>
            </div>

            <input
              ref={inputRef}
              type="text"
              value={value}
              onChange={(e) => setValue(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") handleSubmit(); }}
              placeholder="e.g. Alex"
              maxLength={50}
              className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white text-sm placeholder-white/20 focus:outline-none focus:border-indigo-500/50 focus:bg-white/[0.07] transition-all font-mono"
            />

            <div className="flex flex-col gap-2">
              <button
                onClick={handleSubmit}
                disabled={!value.trim()}
                className="w-full py-3 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:opacity-30 disabled:cursor-not-allowed text-white font-black text-[11px] uppercase tracking-[0.2em] transition-all"
              >
                Enter Lab
              </button>
              <button
                onClick={() => onSubmit("Anonymous")}
                className="w-full py-2 text-white/25 hover:text-white/50 text-[10px] uppercase tracking-widest transition-colors font-bold"
              >
                Skip for now
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
