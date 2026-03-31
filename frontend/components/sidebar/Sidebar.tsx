"use client";

import { useState } from "react";
import {
  MessageSquare,
  Plus,
  Trash2,
  Upload,
  ChevronLeft,
  ChevronRight,
  Loader2,
  Settings,
  FileText,
} from "lucide-react";
import { clsx } from "clsx";
import { useChatStore } from "@/store/chatStore";
import FileUpload from "@/components/upload/FileUpload";

export default function Sidebar() {
  const [collapsed, setCollapsed] = useState(false);
  const [showUpload, setShowUpload] = useState(false);

  const {
    chats,
    chatsLoading,
    activeChatId,
    setActiveChatId,
    removeChat,
    loadChats,
    setMessages,
  } = useChatStore();

  const handleNewChat = () => {
    setActiveChatId(null);
    setMessages([]);
    setShowUpload(false);
  };

  const handleSelectChat = (chatId: string) => {
    setActiveChatId(chatId);
    setShowUpload(false);
  };

  if (collapsed) {
    return (
      <aside className="flex flex-col items-center gap-3 w-14 border-r border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 py-4">
        <button
          onClick={() => setCollapsed(false)}
          className="p-2 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-500 dark:text-gray-400"
          title="Expand sidebar"
        >
          <ChevronRight size={18} />
        </button>
        <button
          onClick={handleNewChat}
          className="p-2 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-500 dark:text-gray-400"
          title="New chat"
        >
          <Plus size={18} />
        </button>
        <button
          onClick={() => { setCollapsed(false); setShowUpload(true); }}
          className="p-2 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-500 dark:text-gray-400"
          title="Upload documents"
        >
          <Upload size={18} />
        </button>
      </aside>
    );
  }

  return (
    <aside className="flex flex-col w-72 min-w-[18rem] border-r border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 Testing">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 dark:border-gray-700">
        <h1 className="font-semibold text-gray-900 dark:text-gray-100 flex items-center gap-2">
          <MessageSquare size={18} className="text-blue-600" />
          RAG Chat
        </h1>
        <button
          onClick={() => setCollapsed(true)}
          className="p-1 rounded hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-400"
        >
          <ChevronLeft size={16} />
        </button>
      </div>

      {/* Action buttons */}
      <div className="flex gap-2 p-3">
        <button
          onClick={handleNewChat}
          className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium transition-colors"
        >
          <Plus size={15} />
          New Chat
        </button>
        <button
          onClick={() => setShowUpload((v) => !v)}
          className={clsx(
            "flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium transition-colors",
            showUpload
              ? "bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400"
              : "bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-300"
          )}
          title="Upload documents"
        >
          <Upload size={15} />
          Upload
        </button>
      </div>

      {/* Upload panel */}
      {showUpload && (
        <div className="border-b border-gray-200 dark:border-gray-700">
          <FileUpload onUploadComplete={loadChats} />
        </div>
      )}

      {/* Chat history */}
      <div className="flex-1 overflow-y-auto">
        <div className="px-3 py-2">
          <p className="text-xs font-medium text-gray-400 dark:text-gray-500 uppercase tracking-wide mb-2 px-1">
            Recent chats
          </p>

          {chatsLoading ? (
            <div className="flex items-center justify-center py-8 text-gray-400">
              <Loader2 size={20} className="animate-spin" />
            </div>
          ) : chats.length === 0 ? (
            <div className="flex flex-col items-center py-8 text-center text-gray-400 gap-2">
              <FileText size={24} className="opacity-50" />
              <p className="text-sm">No chats yet</p>
              <p className="text-xs">Start a new conversation</p>
            </div>
          ) : (
            <ul className="space-y-0.5">
              {chats.map((chat) => (
                <li key={chat.id}>
                  <button
                    onClick={() => handleSelectChat(chat.id)}
                    className={clsx(
                      "w-full flex items-center gap-2 px-3 py-2 rounded-lg text-left text-sm transition-colors group",
                      activeChatId === chat.id
                        ? "bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400"
                        : "text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700/50"
                    )}
                  >
                    <MessageSquare
                      size={14}
                      className="flex-shrink-0 opacity-60"
                    />
                    <span className="flex-1 truncate">
                      {chat.title || "Untitled chat"}
                    </span>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        removeChat(chat.id);
                      }}
                      className="opacity-0 group-hover:opacity-100 p-0.5 rounded hover:bg-red-100 dark:hover:bg-red-900/30 text-gray-400 hover:text-red-500 transition-all"
                    >
                      <Trash2 size={13} />
                    </button>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      {/* Footer */}
      <div className="border-t border-gray-200 dark:border-gray-700 p-3">
        <div className="flex items-center gap-2 px-2 py-1.5 text-xs text-gray-400 dark:text-gray-500">
          <Settings size={13} />
          <span>Powered by LlamaIndex + OpenAI</span>
        </div>
      </div>
    </aside>
  );
}
