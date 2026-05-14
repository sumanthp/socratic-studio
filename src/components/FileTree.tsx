"use client";

import { useState, useRef, useEffect } from "react";
import { FileCode2, Plus, X } from "lucide-react";
import type { FileEntry } from "@/types";

interface FileTreeProps {
  files: FileEntry[];
  activeFileName: string;
  onSelect: (name: string) => void;
  onAdd: (name: string) => void;
  onRemove: (name: string) => void;
}

export default function FileTree({ files, activeFileName, onSelect, onAdd, onRemove }: FileTreeProps) {
  const [adding, setAdding] = useState(false);
  const [newName, setNewName] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (adding) inputRef.current?.focus();
  }, [adding]);

  const commitAdd = () => {
    const name = newName.trim();
    if (name) {
      const normalized = name.endsWith(".py") ? name : `${name}.py`;
      if (!files.find(f => f.name === normalized)) {
        onAdd(normalized);
      }
    }
    setAdding(false);
    setNewName("");
  };

  return (
    <div className="flex items-center h-10 border-b border-white/10 bg-black/20 overflow-x-auto shrink-0 scrollbar-none">
      {files.map(f => (
        <div
          key={f.name}
          onClick={() => onSelect(f.name)}
          className={`group flex items-center gap-1.5 px-3 h-full text-[11px] font-mono cursor-pointer border-r border-white/5 shrink-0 select-none transition-colors ${
            f.name === activeFileName
              ? "bg-white/5 text-white border-b-2 border-b-indigo-500"
              : "text-white/35 hover:text-white/70 hover:bg-white/[0.03]"
          }`}
        >
          <FileCode2 size={11} className="text-emerald-400/70 shrink-0" />
          <span>{f.name}</span>
          {files.length > 1 && (
            <button
              onClick={e => { e.stopPropagation(); onRemove(f.name); }}
              aria-label={`Close ${f.name}`}
              className="opacity-0 group-hover:opacity-100 text-white/25 hover:text-rose-400 transition-all -mr-1 ml-0.5"
            >
              <X size={10} />
            </button>
          )}
        </div>
      ))}

      {adding ? (
        <input
          ref={inputRef}
          value={newName}
          onChange={e => setNewName(e.target.value)}
          onKeyDown={e => {
            if (e.key === "Enter") commitAdd();
            if (e.key === "Escape") { setAdding(false); setNewName(""); }
          }}
          onBlur={commitAdd}
          placeholder="filename.py"
          className="h-full px-3 text-[11px] font-mono bg-indigo-500/10 border-r border-indigo-500/20 text-white placeholder-white/20 focus:outline-none w-28 shrink-0"
        />
      ) : (
        <button
          onClick={() => setAdding(true)}
          aria-label="Add new file"
          className="flex items-center justify-center px-3 h-full text-white/20 hover:text-white/60 transition-colors shrink-0"
        >
          <Plus size={13} />
        </button>
      )}
    </div>
  );
}
