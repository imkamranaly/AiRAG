import type {
  Chat,
  ChatListResponse,
  Document,
  DocumentListResponse,
  OptimisticMessage,
  SourceChunk,
  StreamEvent,
  UploadResponse,
} from "@/types";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000";

// ── Generic fetch helper ──────────────────────────────────────────────────────

async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API_URL}${path}`, {
    headers: { "Content-Type": "application/json", ...init?.headers },
    ...init,
  });

  if (!res.ok) {
    let message = `API error ${res.status}`;
    try {
      const body = await res.json();
      message = body.detail || body.message || message;
    } catch {
      // ignore parse errors
    }
    throw new Error(message);
  }

  return res.json() as Promise<T>;
}

// ── Document API ──────────────────────────────────────────────────────────────

export async function uploadDocument(file: File): Promise<UploadResponse> {
  const form = new FormData();
  form.append("file", file);

  const res = await fetch(`${API_URL}/api/v1/upload`, {
    method: "POST",
    body: form,
    // No Content-Type header — browser sets multipart boundary automatically
  });

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.detail || `Upload failed: ${res.status}`);
  }

  return res.json();
}

export async function fetchDocuments(): Promise<DocumentListResponse> {
  return apiFetch<DocumentListResponse>("/api/v1/documents");
}

export async function deleteDocument(documentId: string): Promise<void> {
  await apiFetch(`/api/v1/documents/${documentId}`, { method: "DELETE" });
}

// ── Chat streaming API ────────────────────────────────────────────────────────

export interface StreamChatOptions {
  query: string;
  chatId?: string;
  onToken: (token: string) => void;
  onSources: (sources: SourceChunk[]) => void;
  onDone: (chatId: string) => void;
  onError: (error: string) => void;
  signal?: AbortSignal;
}

export async function streamChat(options: StreamChatOptions): Promise<void> {
  const { query, chatId, onToken, onSources, onDone, onError, signal } = options;

  const res = await fetch(`${API_URL}/api/v1/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ query, chat_id: chatId }),
    signal,
  });

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.detail || `Chat request failed: ${res.status}`);
  }

  const reader = res.body?.getReader();
  if (!reader) throw new Error("No response body");

  const decoder = new TextDecoder();
  let buffer = "";

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });

      // SSE messages are separated by double newlines
      const parts = buffer.split("\n\n");
      buffer = parts.pop() ?? ""; // keep incomplete chunk in buffer

      for (const part of parts) {
        const line = part.trim();
        if (!line.startsWith("data: ")) continue;

        try {
          const event: StreamEvent = JSON.parse(line.slice(6));

          switch (event.type) {
            case "token":
              onToken(event.data);
              break;
            case "sources":
              onSources(event.data);
              break;
            case "done":
              onDone(event.data.chat_id);
              break;
            case "error":
              onError(event.data);
              break;
          }
        } catch {
          // Malformed JSON — skip
        }
      }
    }
  } finally {
    reader.releaseLock();
  }
}

// ── History API ───────────────────────────────────────────────────────────────

export async function fetchChats(): Promise<ChatListResponse> {
  return apiFetch<ChatListResponse>("/api/v1/history");
}

export async function fetchChat(chatId: string): Promise<{
  chat: Chat;
  messages: Array<{
    id: string;
    chat_id: string;
    role: string;
    content: string;
    metadata: Record<string, unknown>;
    created_at: string;
  }>;
}> {
  return apiFetch(`/api/v1/history/${chatId}`);
}

export async function createChat(title?: string) {
  return apiFetch<Chat>("/api/v1/history", {
    method: "POST",
    body: JSON.stringify({ title }),
  });
}

export async function updateChatTitle(chatId: string, title: string): Promise<Chat> {
  return apiFetch<Chat>(`/api/v1/history/${chatId}`, {
    method: "PATCH",
    body: JSON.stringify({ title }),
  });
}

export async function deleteChat(chatId: string): Promise<void> {
  await apiFetch(`/api/v1/history/${chatId}`, { method: "DELETE" });
}
