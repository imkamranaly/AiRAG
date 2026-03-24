"use client";

import { useCallback, useEffect, useRef } from "react";
import { nanoid } from "crypto";
import { Bot, FileText } from "lucide-react";
import ChatMessage from "./ChatMessage";
import ChatInput from "./ChatInput";
import { useChatStore } from "@/store/chatStore";
import { streamChat, fetchChat } from "@/lib/api";
import type { OptimisticMessage } from "@/types";

// nanoid isn't available by default, use a simple UUID-like function
function uid() {
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}

export default function ChatInterface() {
  const {
    activeChatId,
    messages,
    appendMessage,
    updateLastAssistantMessage,
    setLastAssistantSources,
    finaliseLastAssistantMessage,
    setMessages,
    isStreaming,
    setIsStreaming,
    addChat,
    loadChats,
  } = useChatStore();

  const bottomRef = useRef<HTMLDivElement>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  // Scroll to bottom when messages update
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Load messages when switching chats
  useEffect(() => {
    if (!activeChatId) {
      setMessages([]);
      return;
    }
    fetchChat(activeChatId).then(({ messages: apiMessages }) => {
      const optimistic: OptimisticMessage[] = apiMessages.map((m) => ({
        id: m.id,
        role: m.role as "user" | "assistant",
        content: m.content,
        sources: (m.metadata?.sources ?? []) as OptimisticMessage["sources"],
      }));
      setMessages(optimistic);
    });
  }, [activeChatId, setMessages]);

  const handleSubmit = useCallback(
    async (query: string) => {
      if (isStreaming) return;

      // Optimistic user message
      appendMessage({ id: uid(), role: "user", content: query });

      // Placeholder streaming assistant message
      appendMessage({
        id: uid(),
        role: "assistant",
        content: "",
        isStreaming: true,
      });

      setIsStreaming(true);
      abortControllerRef.current = new AbortController();

      try {
        await streamChat({
          query,
          chatId: activeChatId ?? undefined,
          signal: abortControllerRef.current.signal,
          onToken: (token) => updateLastAssistantMessage(token),
          onSources: (sources) => setLastAssistantSources(sources),
          onDone: (newChatId) => {
            finaliseLastAssistantMessage(newChatId);
            // Refresh sidebar chat list if new chat was created
            if (!activeChatId) {
              loadChats();
            }
          },
          onError: (err) => {
            updateLastAssistantMessage(
              `\n\n_Error: ${err}. Please try again._`
            );
            finaliseLastAssistantMessage(activeChatId ?? "");
          },
        });
      } catch (e: unknown) {
        const isAbort =
          e instanceof Error && e.name === "AbortError";
        if (!isAbort) {
          updateLastAssistantMessage(
            "\n\n_Connection error. Please try again._"
          );
        }
        finaliseLastAssistantMessage(activeChatId ?? "");
      } finally {
        setIsStreaming(false);
      }
    },
    [
      activeChatId,
      isStreaming,
      appendMessage,
      updateLastAssistantMessage,
      setLastAssistantSources,
      finaliseLastAssistantMessage,
      setIsStreaming,
      loadChats,
    ]
  );

  const handleStop = useCallback(() => {
    abortControllerRef.current?.abort();
    finaliseLastAssistantMessage(activeChatId ?? "");
    setIsStreaming(false);
  }, [activeChatId, finaliseLastAssistantMessage, setIsStreaming]);

  return (
    <div className="flex flex-col h-full">
      {/* Message list */}
      <div className="flex-1 overflow-y-auto">
        {messages.length === 0 ? (
          <EmptyState />
        ) : (
          <div className="max-w-3xl mx-auto py-4">
            {messages.map((msg) => (
              <ChatMessage key={msg.id} message={msg} />
            ))}
            <div ref={bottomRef} />
          </div>
        )}
      </div>

      {/* Input bar */}
      <div className="border-t border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 px-4 py-4">
        <div className="max-w-3xl mx-auto">
          <ChatInput
            onSubmit={handleSubmit}
            onStop={handleStop}
            isStreaming={isStreaming}
          />
        </div>
      </div>
    </div>
  );
}

function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center h-full text-center px-4 gap-4">
      <div className="w-16 h-16 rounded-2xl bg-blue-50 dark:bg-blue-900/20 flex items-center justify-center">
        <Bot size={32} className="text-blue-600 dark:text-blue-400" />
      </div>
      <div>
        <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100 mb-1">
          Chat with your documents
        </h2>
        <p className="text-gray-500 dark:text-gray-400 text-sm max-w-sm">
          Upload PDFs, text, or markdown files, then ask questions. The AI will
          answer using only your documents.
        </p>
      </div>
      <div className="grid grid-cols-2 gap-2 mt-2">
        {[
          "Summarise this document",
          "What are the key findings?",
          "List the main topics",
          "Explain section 3",
        ].map((hint) => (
          <div
            key={hint}
            className="px-3 py-2 border border-gray-200 dark:border-gray-700 rounded-lg text-sm text-gray-500 dark:text-gray-400 flex items-center gap-1.5"
          >
            <FileText size={13} />
            {hint}
          </div>
        ))}
      </div>
    </div>
  );
}
