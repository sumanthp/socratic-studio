"use client";

import dynamic from "next/dynamic";
import { FileCode2 } from "lucide-react";
import { Monaco } from "@monaco-editor/react";

// Load Monaco Editor dynamically to prevent SSR issues
const MonacoEditor = dynamic(() => import("@monaco-editor/react"), { ssr: false });

interface EditorProps {
  code: string;
  setCode: (code: string) => void;
}

export default function Editor({ code, setCode }: EditorProps) {

  const handleEditorWillMount = (monaco: Monaco) => {
    monaco.editor.defineTheme("oasis-dark", {
      base: "vs-dark",
      inherit: true,
      rules: [
        { background: "09090b" },
        { token: "comment", foreground: "6272a4", fontStyle: "italic" },
        { token: "keyword", foreground: "a78bfa", fontStyle: "bold" }, // violet-400
        { token: "string", foreground: "34d399" }, // emerald-400
        { token: "function", foreground: "818cf8" }, // indigo-400
        { token: "variable", foreground: "e2e8f0" },
      ],
      colors: {
        "editor.background": "#00000000", // Transparent to show container background
        "editor.lineHighlightBackground": "#ffffff05",
        "editorLineNumber.foreground": "#4b5563",
        "editorIndentGuide.background": "#ffffff10",
        "editorSuggestWidget.background": "#111113",
        "editorSuggestWidget.border": "#ffffff1a",
      },
    });
  };

  return (
    <div className="h-full w-full flex flex-col">
      <div className="h-12 flex items-center px-4 border-b border-white/10 bg-black/20">
        <div className="flex items-center gap-2 px-3 py-1.5 bg-white/5 rounded-lg border border-white/5 shadow-sm">
          <FileCode2 size={14} className="text-emerald-400" />
          <span className="font-mono text-xs text-white/80">main.py</span>
        </div>
      </div>
      <div className="flex-1 bg-[#09090b]/50 pt-4 relative">
        <MonacoEditor
          height="100%"
          language="python"
          theme="oasis-dark"
          beforeMount={handleEditorWillMount}
          value={code}
          onChange={(value) => setCode(value || "")}
          options={{
            minimap: { enabled: false },
            fontSize: 14,
            padding: { top: 0 },
            fontFamily: "var(--font-geist-mono), monospace",
            scrollBeyondLastLine: false,
            smoothScrolling: true,
            cursorBlinking: "smooth",
            cursorSmoothCaretAnimation: "on",
            formatOnPaste: true,
            renderLineHighlight: "all",
            lineNumbersMinChars: 4,
          }}
          loading={
            <div className="flex items-center justify-center h-full text-white/50 text-sm">
              Loading Editor...
            </div>
          }
        />
      </div>
    </div>
  );
}
