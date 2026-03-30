Generate a detailed frontend feature spec and write it to `.specs/`.

## Usage

```
/spec-frontend <feature description>
```

Examples:
```
/spec-frontend "document list panel showing upload status with polling"
/spec-frontend "message copy button on assistant bubbles"
/spec-frontend "dark/light mode toggle in sidebar footer"
/spec-frontend "tag filter chips in the sidebar above chat history"
```

## What This Command Does

1. Parse the feature description from $ARGUMENTS.
2. Derive a kebab-case slug from the description.
3. Create the `.specs/` directory if it doesn't exist.
4. Write a complete spec to `.specs/frontend-<slug>.md`.
5. Report the spec path and next steps.

## Spec File to Generate

Write the file at `.specs/frontend-<slug>.md` using exactly this structure — fill in every section with real detail based on the feature and the existing codebase:

```markdown
# Frontend Spec: <Feature Title>

## Status
`draft`

## Summary
One paragraph describing the UI feature, the user-facing behaviour, and which part of the app it lives in.

## Context
- **Affected components**: list existing components that will be modified
- **Affected store slices**: list Zustand state that will change
- **Problem**: what UX problem this solves
- **Non-goals**: what is out of scope

## User Story
As a [user type], I want to [action] so that [outcome].

## UI Behaviour

Step-by-step from the user's perspective:

1. User sees / clicks / types...
2. System responds with...
3. Loading state: what the user sees while waiting
4. Empty state: what the user sees with no data
5. Error state: what the user sees on failure

## Component Design

### New Components

**`frontend/components/<feature>/<ComponentName>.tsx`**

Props:
\```ts
interface Props {
  prop: Type;  // description
}
\```

Behaviour:
- Describe internal state (useState)
- Describe effects (useEffect)
- Describe event handlers

### Modified Components

**`frontend/components/<existing>/<Name>.tsx`** — describe the change

## Types

New types to add to `frontend/types/index.ts`:

\```ts
export interface <TypeName> {
  id: string;
  field: Type;  // description
}
\```

## API Changes

New functions to add to `frontend/lib/api.ts`:

\```ts
export async function functionName(arg: Type): Promise<ReturnType> {
  return apiFetch<ReturnType>("/api/v1/path", { ... });
}
\```

## Store Changes

New state/actions to add to `frontend/store/chatStore.ts` (if shared state needed):

\```ts
// State
fieldName: Type;

// Action
setFieldName: (value: Type) => void;
\```

## Tests

### `frontend/components/<feature>/__tests__/<ComponentName>.test.tsx`

Test cases to cover:
- Renders with default/empty state
- User interaction (click, type, submit)
- Loading state display
- Error state display
- API call is made with correct arguments (mock `lib/api.ts`)
```

## After Writing the Spec

Tell the user:
1. The spec path: `.specs/frontend-<slug>.md`
2. To review it and change `Status` to `approved` when ready
3. Then run `/implement .specs/frontend-<slug>.md` to generate the code
