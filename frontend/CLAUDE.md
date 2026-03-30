# Frontend — Next.js 14 / TypeScript Conventions

Root: `frontend/`
Run: `cd frontend && npm run dev`  (port 3000)
Test: `cd frontend && npm test`
API base: `NEXT_PUBLIC_API_URL` env var (default: `http://127.0.0.1:8000`)

## Directory Structure

```
frontend/
  app/
    layout.tsx          Root layout — metadata, global CSS
    page.tsx            Main page — "use client", renders Sidebar + ChatInterface
    globals.css         Tailwind base styles
  components/
    chat/
      ChatInterface.tsx  Message list, SSE streaming, abort control
      ChatMessage.tsx    Renders one message — Markdown, code blocks, sources panel
      ChatInput.tsx      Text input bar + submit/stop buttons
    sidebar/
      Sidebar.tsx        Chat history list, new chat button, upload toggle
    upload/
      FileUpload.tsx     Drag-and-drop file upload, progress states
  lib/
    api.ts              ALL API calls — never use fetch directly in components
  store/
    chatStore.ts        Zustand global state — chats, messages, streaming flag
  types/
    index.ts            ALL TypeScript types — never inline types in components
```

## Component Rules

### When to use `"use client"`
Add `"use client"` at the top only if the component uses:
- React hooks (`useState`, `useEffect`, `useRef`, `useMemo`, `useCallback`)
- Browser event handlers (`onClick`, `onChange`, `onSubmit`)
- Zustand store (`useChatStore`)
- SSE / streaming (`fetch` with `ReadableStream`)

Server Components (no `"use client"`) are fine for pure display.

### Component Template

```tsx
"use client";

import { memo } from "react";
import clsx from "clsx";
import type { MyType } from "@/types";

interface Props {
  value: MyType;
  className?: string;
}

export const MyComponent = memo(function MyComponent({ value, className }: Props) {
  return (
    <div className={clsx("base-classes", className)}>
      {/* content */}
    </div>
  );
});
```

- Use `memo()` for pure display components
- Always accept `className?: string` for composability
- Use `clsx(...)` for conditional classes — never template literals

## State Management (Zustand)

The store is at `frontend/store/chatStore.ts`. All shared state lives here.

```ts
// Reading state
import { useChatStore } from "@/store/chatStore";
const { chats, activeChatId } = useChatStore();

// Writing state — call store actions
const { setActiveChatId, appendMessage } = useChatStore();
```

Use `useState` only for **local UI state** (e.g. dropdown open/closed, hover).
Use `useChatStore` for anything shared between components.

## API Client Rules

All API calls go in `frontend/lib/api.ts`. Components call named functions — never raw `fetch`.

```ts
// lib/api.ts — add new functions at the bottom
export async function fetchTags(): Promise<TagListResponse> {
  return apiFetch<TagListResponse>("/api/v1/tags");
}

export async function createTag(name: string): Promise<TagResponse> {
  return apiFetch<TagResponse>("/api/v1/tags", {
    method: "POST",
    body: JSON.stringify({ name }),
  });
}
```

## TypeScript Types

All types go in `frontend/types/index.ts`. Never define types inline in component files.

```ts
// types/index.ts — append new types at the bottom
export interface Tag {
  id: string;
  name: string;
  color: string | null;
  created_at: string;
}

export interface TagListResponse {
  tags: Tag[];
  total: number;
}
```

## Styling

- **Tailwind CSS** only — no CSS modules, no styled-components
- **clsx** for conditional classes: `clsx("base", { "active": isActive }, className)`
- **Dark mode**: always add `dark:` variants when a component has a background or text color
- Follow the existing color palette: gray-900 backgrounds, gray-100 text, blue-600 accents

## SSE Streaming Pattern

The existing pattern in `ChatInterface.tsx` — replicate it for any new streaming feature:

```ts
const res = await fetch(`${API_URL}/api/v1/chat`, { method: "POST", body: ..., signal });
const reader = res.body!.getReader();
const decoder = new TextDecoder();
let buffer = "";

while (true) {
  const { done, value } = await reader.read();
  if (done) break;
  buffer += decoder.decode(value, { stream: true });
  const parts = buffer.split("\n\n");
  buffer = parts.pop() ?? "";
  for (const part of parts) {
    if (!part.startsWith("data: ")) continue;
    const event = JSON.parse(part.slice(6));
    // handle event
  }
}
```

## Testing

- Test framework: Jest + React Testing Library
- Test files: `components/<feature>/__tests__/<ComponentName>.test.tsx`
- Mock API calls — never make real HTTP requests in tests
- Use `@testing-library/user-event` for interaction simulation

```tsx
// components/chat/__tests__/ChatInput.test.tsx
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ChatInput } from "../ChatInput";

test("calls onSubmit with trimmed value", async () => {
  const onSubmit = jest.fn();
  render(<ChatInput onSubmit={onSubmit} isStreaming={false} />);
  await userEvent.type(screen.getByRole("textbox"), "  hello  ");
  await userEvent.keyboard("{Enter}");
  expect(onSubmit).toHaveBeenCalledWith("hello");
});
```
