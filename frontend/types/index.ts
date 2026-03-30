// ── Document types ────────────────────────────────────────────────────────────

export type DocumentStatus = "processing" | "ready" | "failed";

export interface Document {
  id: string;
  name: string;
  file_type: string;
  file_size: number;
  status: DocumentStatus;
  metadata: Record<string, unknown>;
  created_at: string;
  chunk_count?: number;
}

export interface UploadResponse {
  document_id: string;
  name: string;
  status: DocumentStatus;
  message: string;
}

// ── Chat / Message types ──────────────────────────────────────────────────────

export type MessageRole = "user" | "assistant";

export interface SourceChunk {
  document_id: string;
  document_name: string;
  content: string;
  similarity: number;
  chunk_index: number;
}

export interface Message {
  id: string;
  chat_id: string;
  role: MessageRole;
  content: string;
  metadata: {
    sources?: SourceChunk[];
    [key: string]: unknown;
  };
  created_at: string;
}

// Optimistic message (before server confirms)
export interface OptimisticMessage {
  id: string; // temporary client id
  role: MessageRole;
  content: string;
  isStreaming?: boolean;
  sources?: SourceChunk[];
}

export interface Chat {
  id: string;
  title: string | null;
  created_at: string;
  updated_at: string;
  message_count?: number;
}

// ── SSE stream event types ────────────────────────────────────────────────────

export interface StreamTokenEvent {
  type: "token";
  data: string;
}

export interface StreamSourcesEvent {
  type: "sources";
  data: SourceChunk[];
}

export interface StreamDoneEvent {
  type: "done";
  data: { chat_id: string };
}

export interface StreamErrorEvent {
  type: "error";
  data: string;
}

export type StreamEvent =
  | StreamTokenEvent
  | StreamSourcesEvent
  | StreamDoneEvent
  | StreamErrorEvent;

// ── API response wrappers ─────────────────────────────────────────────────────

export interface ChatListResponse {
  chats: Chat[];
  total: number;
}

export interface DocumentListResponse {
  documents: Document[];
  total: number;
}

// ── Auth types ────────────────────────────────────────────────────────────────

export interface RegisterRequest {
  email: string;
  password: string;
  full_name: string;
}

export interface UserResponse {
  id: string;
  email: string;
  full_name: string;
  created_at: string;
}

export interface LoginRequest {
  email: string;
  password: string;
}

export interface TokenResponse {
  access_token: string;
  token_type: string;
  user: UserResponse;
}

export interface AuthState {
  user: UserResponse | null;
  token: string | null;
  isLoading: boolean;
  error: string | null;
}
