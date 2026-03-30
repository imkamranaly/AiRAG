Scaffold a new React component with its types, API stub, and test file.

## Usage

```
/scaffold-component <ComponentName> [feature-folder]
```

Examples:
```
/scaffold-component DocumentCard documents
/scaffold-component TagBadge tags
/scaffold-component ExportButton
```

If `feature-folder` is omitted, use `<componentname-lowercased>/` as the folder.

## What This Command Does

1. Parse `<ComponentName>` and optional `[feature-folder]` from $ARGUMENTS.
2. Derive:
   - `folder` = feature-folder arg, or lowercase ComponentName
   - `slug` = kebab-case of ComponentName (e.g. `DocumentCard` → `document-card`)
   - `propsType` = `<ComponentName>Props`
3. Read `frontend/types/index.ts` and `frontend/lib/api.ts` before modifying them.
4. Create `frontend/components/<folder>/<ComponentName>.tsx`.
5. Create `frontend/components/<folder>/__tests__/<ComponentName>.test.tsx`.
6. Append type stub to `frontend/types/index.ts`.
7. Append API function stub to `frontend/lib/api.ts`.

## Files to Generate

### `frontend/components/<folder>/<ComponentName>.tsx`

```tsx
"use client";

import { memo } from "react";
import clsx from "clsx";
import type { <ComponentName>Props } from "@/types";

export const <ComponentName> = memo(function <ComponentName>({
  // destructure props here
  className,
}: <ComponentName>Props) {
  return (
    <div className={clsx("", className)}>
      {/* TODO: implement */}
    </div>
  );
});
```

### `frontend/components/<folder>/__tests__/<ComponentName>.test.tsx`

```tsx
import { render, screen } from "@testing-library/react";
import { <ComponentName> } from "../<ComponentName>";

describe("<ComponentName>", () => {
  it("renders without crashing", () => {
    render(<ComponentName />);
    // TODO: add assertions
  });

  it("applies custom className", () => {
    const { container } = render(<ComponentName className="custom" />);
    expect(container.firstChild).toHaveClass("custom");
  });
});
```

### Type stub to append to `frontend/types/index.ts`

```ts
// ── <ComponentName> ──────────────────────────────────────────────────────────

export interface <ComponentName>Data {
  id: string;
  // TODO: add fields
}

export interface <ComponentName>Props {
  // TODO: add props
  className?: string;
}
```

### API stub to append to `frontend/lib/api.ts`

```ts
// ── <ComponentName> API ──────────────────────────────────────────────────────

export async function fetch<ComponentName>s(): Promise<<ComponentName>Data[]> {
  // TODO: replace with real endpoint
  return apiFetch<<ComponentName>Data[]>("/api/v1/<slug>s");
}
```

## After Scaffolding

Print this message to the user:

```
Scaffolded: <ComponentName>

Created:
  frontend/components/<folder>/<ComponentName>.tsx
  frontend/components/<folder>/__tests__/<ComponentName>.test.tsx

Modified:
  frontend/types/index.ts     (appended <ComponentName>Props + <ComponentName>Data)
  frontend/lib/api.ts         (appended fetch<ComponentName>s stub)

Next steps:
  1. Fill in the Props interface in types/index.ts
  2. Implement the component in <ComponentName>.tsx
  3. Update the API function in lib/api.ts with the real endpoint
  4. Import and use the component where needed
  5. Run tests: npm test -- <ComponentName>
```
