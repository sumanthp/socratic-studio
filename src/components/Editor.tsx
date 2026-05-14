"use client";

import dynamic from "next/dynamic";
import { Monaco } from "@monaco-editor/react";
import FileTree from "./FileTree";
import type { FileEntry } from "@/types";

const MonacoEditor = dynamic(() => import("@monaco-editor/react"), { ssr: false });

interface EditorProps {
  files: FileEntry[];
  activeFileName: string;
  onFileChange: (name: string, content: string) => void;
  onActiveChange: (name: string) => void;
  onAddFile: (name: string) => void;
  onRemoveFile: (name: string) => void;
}

export default function Editor({
  files,
  activeFileName,
  onFileChange,
  onActiveChange,
  onAddFile,
  onRemoveFile,
}: EditorProps) {
  const activeFile = files.find(f => f.name === activeFileName) ?? files[0];

  const handleEditorWillMount = (monaco: Monaco) => {
    monaco.editor.defineTheme("oasis-dark", {
      base: "vs-dark",
      inherit: true,
      rules: [
        { background: "09090b" } as any,
        { token: "comment",  foreground: "6272a4", fontStyle: "italic" },
        { token: "keyword",  foreground: "a78bfa", fontStyle: "bold" },
        { token: "string",   foreground: "34d399" },
        { token: "function", foreground: "818cf8" },
        { token: "variable", foreground: "e2e8f0" },
      ],
      colors: {
        "editor.background": "#00000000",
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
      {/* File tab bar */}
      <FileTree
        files={files}
        activeFileName={activeFileName}
        onSelect={onActiveChange}
        onAdd={onAddFile}
        onRemove={onRemoveFile}
      />

      {/* Monaco editor */}
      <div className="flex-1 bg-[#09090b]/50 pt-4 overflow-hidden">
        <MonacoEditor
          key={activeFileName}
          height="100%"
          language="python"
          theme="oasis-dark"
          beforeMount={handleEditorWillMount}
          value={activeFile?.content ?? ""}
          onChange={value => onFileChange(activeFileName, value ?? "")}
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
