"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import type { FileEntry } from "@/types";

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";
const STORAGE_KEY = "oasis_session_id";
const DEBOUNCE_MS = 1000;

export interface SessionMeta {
  provider?: string;
  active_module_index?: number;
  milestone?: string;
  active_file_name?: string;
}

export interface Message {
  role: string;
  content: string;
  seq: number;
}

export interface UseSessionReturn {
  sessionId: string | null;
  displayName: string | null;
  isLoaded: boolean;
  saveFiles: (files: FileEntry[], activeFileName: string) => void;
  saveMeta: (patch: SessionMeta) => void;
  saveMessages: (messages: Message[]) => void;
  setDisplayName: (name: string) => Promise<void>;
  initialFiles: FileEntry[] | null;
  initialMessages: Message[] | null;
  initialMeta: SessionMeta | null;
}

function generateUUID(): string {
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

export function useSession(): UseSessionReturn {
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [displayName, setDisplayNameState] = useState<string | null>(null);
  const [isLoaded, setIsLoaded] = useState(false);
  const [initialFiles, setInitialFiles] = useState<FileEntry[] | null>(null);
  const [initialMessages, setInitialMessages] = useState<Message[] | null>(null);
  const [initialMeta, setInitialMeta] = useState<SessionMeta | null>(null);

  const fileDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const sessionIdRef = useRef<string | null>(null);

  useEffect(() => {
    sessionIdRef.current = sessionId;
  }, [sessionId]);

  useEffect(() => {
    let id = localStorage.getItem(STORAGE_KEY);
    if (!id) {
      id = generateUUID();
      localStorage.setItem(STORAGE_KEY, id);
    }

    fetch(`${API_BASE}/api/sessions/${id}`)
      .then((res) => {
        if (res.status === 404) {
          // New session — register it
          return fetch(`${API_BASE}/api/sessions`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ id }),
          }).then((r) => r.json());
        }
        return res.json();
      })
      .then((data) => {
        setSessionId(data.id);
        setDisplayNameState(data.display_name ?? null);
        if (data.files && data.files.length > 0) {
          setInitialFiles(data.files as FileEntry[]);
        }
        if (data.messages && data.messages.length > 0) {
          setInitialMessages(data.messages as Message[]);
        }
        setInitialMeta({
          provider: data.provider,
          active_module_index: data.active_module_index,
          milestone: data.milestone,
          active_file_name: data.active_file_name,
        });
        setIsLoaded(true);
      })
      .catch(() => {
        // Offline or backend down — still mark loaded so UI can proceed
        setSessionId(id);
        setIsLoaded(true);
      });
  }, []);

  const saveFiles = useCallback((files: FileEntry[], activeFileName: string) => {
    if (fileDebounceRef.current) clearTimeout(fileDebounceRef.current);
    fileDebounceRef.current = setTimeout(() => {
      const id = sessionIdRef.current;
      if (!id) return;
      fetch(`${API_BASE}/api/sessions/${id}/files`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ files }),
      }).catch(() => {});
      fetch(`${API_BASE}/api/sessions/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ active_file_name: activeFileName }),
      }).catch(() => {});
    }, DEBOUNCE_MS);
  }, []);

  const saveMeta = useCallback((patch: SessionMeta) => {
    const id = sessionIdRef.current;
    if (!id) return;
    fetch(`${API_BASE}/api/sessions/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(patch),
    }).catch(() => {});
  }, []);

  const saveMessages = useCallback((messages: Message[]) => {
    const id = sessionIdRef.current;
    if (!id || messages.length === 0) return;
    fetch(`${API_BASE}/api/sessions/${id}/messages`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ messages }),
    }).catch(() => {});
  }, []);

  const setDisplayName = useCallback(async (name: string) => {
    const id = sessionIdRef.current;
    if (!id) return;
    await fetch(`${API_BASE}/api/sessions/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ display_name: name }),
    });
    setDisplayNameState(name);
  }, []);

  return {
    sessionId,
    displayName,
    isLoaded,
    saveFiles,
    saveMeta,
    saveMessages,
    setDisplayName,
    initialFiles,
    initialMessages,
    initialMeta,
  };
}
