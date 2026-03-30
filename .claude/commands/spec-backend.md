Generate a detailed backend feature spec and write it to `.specs/`.

## Usage

```
/spec-backend <feature description>
```

Examples:
```
/spec-backend "document tagging — users can assign tags to uploaded documents"
/spec-backend "search history endpoint with full-text filtering"
/spec-backend "rate limiting middleware for the chat endpoint"
```

## What This Command Does

1. Parse the feature description from $ARGUMENTS.
2. Derive a kebab-case slug from the description (e.g. "document tagging" → `document-tagging`).
3. Create the `.specs/` directory if it doesn't exist.
4. Write a complete spec to `.specs/backend-<slug>.md`.
5. Report the spec path and next steps.

## Spec File to Generate

Write the file at `.specs/backend-<slug>.md` using exactly this structure — fill in every section with real detail based on the feature description and the existing codebase:

```markdown
# Backend Spec: <Feature Title>

## Status
`draft`

## Summary
One paragraph describing the feature, its purpose, and its scope within the backend.

## Context
- **Affected files**: list existing files that will be modified
- **Problem**: what this solves
- **Non-goals**: what is explicitly out of scope

## API Contract

### `<METHOD> /api/v1/<path>`

**Request body** (`application/json`):
\```json
{
  "field": "type — description"
}
\```

**Response** (`200 OK`):
\```json
{
  "field": "type — description"
}
\```

**Error cases**:
- `400` — validation failure (describe when)
- `404` — resource not found (describe when)
- `500` — internal error

## Service Design

### `backend/app/services/<name>_service.py`

Functions to implement:

\```python
async def function_name(arg: Type) -> ReturnType:
    """Describe what this does."""
    ...
\```

## Schema Changes

### New models in `backend/app/models/schemas.py`

\```python
class <Name>Request(BaseModel):
    field: str

class <Name>Response(BaseModel):
    id: uuid.UUID
    field: str
    created_at: datetime
\```

## Config Changes

New settings to add to `backend/app/core/config.py` (if any):
- `SETTING_NAME: type = default  # description`

## Database / OpenSearch Changes

Describe any new tables, columns, or OpenSearch index mappings required.

## Tests

### `backend/tests/test_<name>.py`

Test cases to cover:
- Happy path: describe expected input → output
- Validation error: describe invalid input
- Not found case (if applicable)
- Service error propagation
```

## After Writing the Spec

Tell the user:
1. The spec path: `.specs/backend-<slug>.md`
2. To review it and change `Status` to `approved` when ready
3. Then run `/implement .specs/backend-<slug>.md` to generate the code
