"use client";

import { useEffect } from "react";
import Sidebar from "@/components/sidebar/Sidebar";
import ChatInterface from "@/components/chat/ChatInterface";
import { useChatStore } from "@/store/chatStore";

export default function HomePage() {
  const loadChats = useChatStore((s) => s.loadChats);

  useEffect(() => {
    loadChats();
  }, [loadChats]);

  return (
    <div className="flex h-screen overflow-hidden bg-white dark:bg-gray-900">
      <Sidebar />
      <main className="flex-1 flex flex-col min-w-0">
        <ChatInterface />
      </main>
    </div>
  );
}
