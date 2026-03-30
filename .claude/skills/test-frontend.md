---
name: test-frontend
description: Run frontend tests, interpret failures, and fix them. Use after implementing a frontend feature.
---

Run and fix frontend tests for the AiRAG Next.js application.

## Steps

1. Run the full test suite:
   ```bash
   cd /home/kamran/AI-RAG/AiRAG/frontend && npm test -- --watchAll=false 2>&1
   ```

2. If all tests pass → report "All frontend tests passing ✓" and stop.

3. If tests fail:
   a. Read each failing test file and the component/module it tests.
   b. Identify root cause.
   c. Fix the issue — prefer fixing source code over changing tests.
   d. Re-run the specific failing file:
      ```bash
      cd /home/kamran/AI-RAG/AiRAG/frontend && npm test -- --watchAll=false <ComponentName> 2>&1
      ```
   e. Run the full suite once more to check for regressions.

## Fix Rules

- **Mock `lib/api.ts`** — tests must never make real HTTP calls. If a test hits the network, add a mock.
- **Never loosen assertions** — fix the component/function, not the test expectation.
- **`act()` warnings** — wrap state-updating interactions in `act()` or use `await userEvent.*` (which handles this automatically).
- **Missing providers** — if a component uses `useChatStore`, wrap the render in a store provider or mock the hook.

## Common Fix Patterns

### Mock the API module
```tsx
import * as api from "@/lib/api";
jest.mock("@/lib/api");

beforeEach(() => {
  (api.fetchDocuments as jest.Mock).mockResolvedValue({ documents: [], total: 0 });
});
```

### Mock Zustand store
```tsx
import { useChatStore } from "@/store/chatStore";
jest.mock("@/store/chatStore");

beforeEach(() => {
  (useChatStore as jest.Mock).mockReturnValue({
    chats: [],
    activeChatId: null,
    setActiveChatId: jest.fn(),
  });
});
```

### Async rendering
```tsx
import { waitFor } from "@testing-library/react";

// Wait for async state updates:
await waitFor(() => {
  expect(screen.getByText("Expected text")).toBeInTheDocument();
});
```

### Test file not found by Jest
Check `jest.config.js` `testMatch` pattern. Default: `**/__tests__/**/*.test.tsx`.

## Output Format

```
Frontend Tests
──────────────
Ran: N tests across N test suites
Passed: N
Failed: N

Failures fixed:
  - <TestFile>::<test name> — <root cause> → <fix applied>

Final result: PASSING / STILL FAILING
```
