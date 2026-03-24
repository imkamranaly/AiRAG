"use client";

import { create } from "zustand";
import { devtools } from "zustand/middleware";
import type { Chat, OptimisticMessage, SourceChunk } from "@/types";
import { deleteChat, fetchChats } from "@/lib/api";

interface ChatStore {
  // Chat list (sidebar)
  chats: Chat[];
  chatsLoading: boolean;
  loadChats: () => Promise<void>;
  addChat: (chat: Chat) => void;
  removeChat: (chatId: string) => void;
  updateChatTitle: (chatId: string, title: string) => void;

  // Active session
  activeChatId: string | null;
  setActiveChatId: (id: string | null) => void;

  // Messages for the active chat
  messages: OptimisticMessage[];
  setMessages: (messages: OptimisticMessage[]) => void;
  appendMessage: (msg: OptimisticMessage) => void;
  updateLastAssistantMessage: (token: string) => void;
  setLastAssistantSources: (sources: SourceChunk[]) => void;
  finaliseLastAssistantMessage: (chatId: string) => void;

  // UI state
  isStreaming: boolean;
  setIsStreaming: (v: boolean) => void;
}

export const useChatStore = create<ChatStore>()(
  devtools(
    (set, get) => ({
      // ── Chat list ────────────────────────────────────────────────────────────
      chats: [],
      chatsLoading: false,

      loadChats: async () => {
        set({ chatsLoading: true });
        try {
          const res = await fetchChats();
          set({ chats: res.chats });
        } catch (e) {
          console.error("Failed to load chats:", e);
        } finally {
          set({ chatsLoading: false });
        }
      },

      addChat: (chat) =>
        set((s) => ({ chats: [chat, ...s.chats] })),

      removeChat: async (chatId) => {
        await deleteChat(chatId);
        set((s) => ({
          chats: s.chats.filter((c) => c.id !== chatId),
          activeChatId: s.activeChatId === chatId ? null : s.activeChatId,
          messages: s.activeChatId === chatId ? [] : s.messages,
        }));
      },

      updateChatTitle: (chatId, title) =>
        set((s) => ({
          chats: s.chats.map((c) => (c.id === chatId ? { ...c, title } : c)),
        })),

      // ── Active session ────────────────────────────────────────────────────────
      activeChatId: null,
      setActiveChatId: (id) => set({ activeChatId: id, messages: [] }),

      // ── Messages ──────────────────────────────────────────────────────────────
      messages: [],
      setMessages: (messages) => set({ messages }),
      appendMessage: (msg) => set((s) => ({ messages: [...s.messages, msg] })),

      updateLastAssistantMessage: (token) =>
        set((s) => {
          const msgs = [...s.messages];
          const last = msgs[msgs.length - 1];
          if (last && last.role === "assistant" && last.isStreaming) {
            msgs[msgs.length - 1] = { ...last, content: last.content + token };
          }
          return { messages: msgs };
        }),

      setLastAssistantSources: (sources) =>
        set((s) => {
          const msgs = [...s.messages];
          const last = msgs[msgs.length - 1];
          if (last && last.role === "assistant") {
            msgs[msgs.length - 1] = { ...last, sources };
          }
          return { messages: msgs };
        }),

      finaliseLastAssistantMessage: (chatId) =>
        set((s) => {
          const msgs = [...s.messages];
          const last = msgs[msgs.length - 1];
          if (last && last.role === "assistant") {
            msgs[msgs.length - 1] = { ...last, isStreaming: false };
          }
          return { messages: msgs, activeChatId: chatId };
        }),

      // ── UI ────────────────────────────────────────────────────────────────────
      isStreaming: false,
      setIsStreaming: (v) => set({ isStreaming: v }),
    }),
    { name: "chat-store" }
  )
);
