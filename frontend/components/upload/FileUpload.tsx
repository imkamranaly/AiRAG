"use client";

import { useState, useCallback } from "react";
import { useDropzone } from "react-dropzone";
import { Upload, X, CheckCircle, AlertCircle, Loader2, FileText } from "lucide-react";
import { clsx } from "clsx";
import { uploadDocument } from "@/lib/api";

interface UploadedFile {
  id: string;
  name: string;
  size: number;
  status: "uploading" | "processing" | "done" | "error";
  error?: string;
}

const ACCEPTED_TYPES = {
  "application/pdf": [".pdf"],
  "text/plain": [".txt"],
  "text/markdown": [".md"],
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": [".docx"],
};

function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export default function FileUpload({ onUploadComplete }: { onUploadComplete?: () => void }) {
  const [files, setFiles] = useState<UploadedFile[]>([]);

  const processFile = useCallback(
    async (file: File) => {
      const id = `${Date.now()}-${Math.random()}`;
      const entry: UploadedFile = {
        id,
        name: file.name,
        size: file.size,
        status: "uploading",
      };

      setFiles((prev) => [entry, ...prev]);

      try {
        await uploadDocument(file);
        setFiles((prev) =>
          prev.map((f) => (f.id === id ? { ...f, status: "processing" } : f))
        );
        // Simulate short delay before marking done (backend processes async)
        setTimeout(() => {
          setFiles((prev) =>
            prev.map((f) => (f.id === id ? { ...f, status: "done" } : f))
          );
          onUploadComplete?.();
        }, 1500);
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : "Upload failed";
        setFiles((prev) =>
          prev.map((f) =>
            f.id === id ? { ...f, status: "error", error: msg } : f
          )
        );
      }
    },
    [onUploadComplete]
  );

  const onDrop = useCallback(
    (accepted: File[]) => {
      accepted.forEach(processFile);
    },
    [processFile]
  );

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: ACCEPTED_TYPES,
    maxSize: 50 * 1024 * 1024, // 50 MB
    multiple: true,
  });

  const removeFile = (id: string) => {
    setFiles((prev) => prev.filter((f) => f.id !== id));
  };

  return (
    <div className="p-4 space-y-4">
      {/* Drop zone */}
      <div
        {...getRootProps()}
        className={clsx(
          "border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-colors",
          isDragActive
            ? "border-blue-500 bg-blue-50 dark:bg-blue-900/10"
            : "border-gray-200 dark:border-gray-700 hover:border-blue-400 dark:hover:border-blue-500 hover:bg-gray-50 dark:hover:bg-gray-800/50"
        )}
      >
        <input {...getInputProps()} />
        <Upload
          size={32}
          className={clsx(
            "mx-auto mb-3",
            isDragActive ? "text-blue-500" : "text-gray-400"
          )}
        />
        <p className="text-sm font-medium text-gray-700 dark:text-gray-300">
          {isDragActive ? "Drop files here" : "Drag & drop files here"}
        </p>
        <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">
          PDF, TXT, MD, DOCX · Max 50 MB each
        </p>
        <button
          type="button"
          className="mt-3 px-4 py-1.5 text-xs font-medium bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
        >
          Browse files
        </button>
      </div>

      {/* File list */}
      {files.length > 0 && (
        <div className="space-y-2">
          {files.map((file) => (
            <div
              key={file.id}
              className="flex items-center gap-3 px-3 py-2.5 bg-gray-50 dark:bg-gray-800 rounded-lg"
            >
              <FileText size={16} className="flex-shrink-0 text-gray-400" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-700 dark:text-gray-300 truncate">
                  {file.name}
                </p>
                <p className="text-xs text-gray-400">{formatBytes(file.size)}</p>
              </div>

              <StatusIcon status={file.status} />

              {(file.status === "done" || file.status === "error") && (
                <button
                  onClick={() => removeFile(file.id)}
                  className="flex-shrink-0 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
                >
                  <X size={14} />
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function StatusIcon({ status }: { status: UploadedFile["status"] }) {
  switch (status) {
    case "uploading":
      return (
        <span className="text-xs text-blue-500 flex items-center gap-1">
          <Loader2 size={14} className="animate-spin" /> Uploading
        </span>
      );
    case "processing":
      return (
        <span className="text-xs text-yellow-500 flex items-center gap-1">
          <Loader2 size={14} className="animate-spin" /> Processing
        </span>
      );
    case "done":
      return <CheckCircle size={16} className="text-green-500 flex-shrink-0" />;
    case "error":
      return <AlertCircle size={16} className="text-red-500 flex-shrink-0" />;
  }
}
