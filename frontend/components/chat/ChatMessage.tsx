"use client";

import React, { memo } from "react";
import ReactMarkdown, { type Components } from "react-markdown";
import remarkGfm from "remark-gfm";
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter";
import { oneDark } from "react-syntax-highlighter/dist/esm/styles/prism";
import { Bot, User, ChevronDown, ChevronUp, ExternalLink } from "lucide-react";
import { clsx } from "clsx";
import type { OptimisticMessage, SourceChunk } from "@/types";
import { useState } from "react";

interface ChatMessageProps {
  message: OptimisticMessage;
}

function SourcesPanel({ sources }: { sources: SourceChunk[] }) {
  const [open, setOpen] = useState(false);

  if (!sources || sources.length === 0) return null;

  return (
    <div className="mt-2 border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden text-sm">
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-1.5 w-full px-3 py-2 bg-gray-50 dark:bg-gray-800 text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-750 transition-colors"
      >
        {open ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
        <span className="font-medium">{sources.length} source{sources.length > 1 ? "s" : ""}</span>
      </button>
      {open && (
        <div className="divide-y divide-gray-100 dark:divide-gray-700">
          {sources.map((src, i) => (
            <div key={i} className="px-3 py-2">
              <div className="flex items-center justify-between mb-1">
                <span className="font-medium text-gray-700 dark:text-gray-300 flex items-center gap-1">
                  <ExternalLink size={12} />
                  {src.document_name}
                </span>
                <span className="text-xs text-gray-400 dark:text-gray-500 bg-gray-100 dark:bg-gray-800 px-1.5 py-0.5 rounded">
                  {Math.round(src.similarity * 100)}% match
                </span>
              </div>
              <p className="text-gray-500 dark:text-gray-400 line-clamp-2 text-xs leading-relaxed">
                {src.content}
              </p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

const CodeBlock: NonNullable<Components["code"]> = memo(function CodeBlock({
  className,
  children,
  ...props
}) {
  const match = /language-(\w+)/.exec(className || "");
  const language = match ? match[1] : "text";
  const code = String(children).replace(/\n$/, "");

  return match ? (
    <SyntaxHighlighter
      style={oneDark}
      language={language}
      PreTag="div"
      className="rounded-lg !my-2 text-sm"
      {...(props as Record<string, unknown>)}
    >
      {code}
    </SyntaxHighlighter>
  ) : (
    <code
      className="bg-gray-100 dark:bg-gray-800 px-1.5 py-0.5 rounded text-sm font-mono"
      {...props}
    >
      {children}
    </code>
  );
});

function ChatMessage({ message }: ChatMessageProps) {
  const isUser = message.role === "user";

  return (
    <div
      className={clsx(
        "flex gap-3 px-4 py-4 group",
        isUser ? "flex-row-reverse" : "flex-row"
      )}
    >
      {/* Avatar */}
      <div
        className={clsx(
          "flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center",
          isUser
            ? "bg-blue-600 text-white"
            : "bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300"
        )}
      >
        {isUser ? <User size={16} /> : <Bot size={16} />}
      </div>

      {/* Bubble */}
      <div
        className={clsx(
          "max-w-[75%] min-w-0",
          isUser ? "items-end" : "items-start",
          "flex flex-col"
        )}
      >
        <div
          className={clsx(
            "rounded-2xl px-4 py-2.5",
            isUser
              ? "bg-blue-600 text-white rounded-tr-sm"
              : "bg-gray-100 dark:bg-gray-800 text-gray-900 dark:text-gray-100 rounded-tl-sm"
          )}
        >
          {isUser ? (
            <p className="whitespace-pre-wrap text-sm leading-relaxed">
              {message.content}
            </p>
          ) : (
            <div
              className={clsx(
                "prose prose-sm dark:prose-invert max-w-none leading-relaxed",
                message.isStreaming && "streaming-cursor"
              )}
            >
              <ReactMarkdown
                remarkPlugins={[remarkGfm]}
                components={{ code: CodeBlock }}
              >
                {message.content}
              </ReactMarkdown>
            </div>
          )}
        </div>

        {/* Sources (assistant only) */}
        {!isUser && message.sources && message.sources.length > 0 && !message.isStreaming && (
          <div className="mt-1 w-full">
            <SourcesPanel sources={message.sources} />
          </div>
        )}
      </div>
    </div>
  );
}

export default memo(ChatMessage);
