---
name: spec-review
description: Review a spec file for completeness, consistency with codebase patterns, and readiness for implementation. Use before approving any spec.
---

Review the spec file at the path provided in $ARGUMENTS.

## Steps

1. Read the spec file at the given path.
2. Read every file listed under "Affected files" in the spec's Context section.
3. Check each item in the checklist below.
4. Report findings grouped by: BLOCKING (must fix before implement) / WARNING (should fix) / OK.
5. If all checks pass, confirm the spec is ready and tell the user to change `Status` to `approved`.

## Review Checklist

### Structure
- [ ] Status field is present (`draft` or `approved`)
- [ ] Summary is clear and scoped — one feature, one paragraph
- [ ] Context lists actual file paths that exist in the repo
- [ ] Non-goals are explicitly stated

### API Contract (backend specs)
- [ ] HTTP method and path are specified
- [ ] Request body fields are typed
- [ ] Response schema matches existing Pydantic naming (`*Request` / `*Response`)
- [ ] Error cases (400, 404, 500) are listed
- [ ] Path matches existing route prefix `/api/v1/`

### Service Design (backend specs)
- [ ] Function signatures use `async def`
- [ ] Uses `get_pool()` for route-level calls or `ensure_pool()` for background tasks
- [ ] No business logic leaking into routes
- [ ] New service file follows `<resource>_service.py` naming

### Schema Changes (backend specs)
- [ ] New Pydantic models are in `schemas.py` only
- [ ] Model names follow `*Request` / `*Response` convention
- [ ] No duplicate model names that already exist in `schemas.py`

### Component Design (frontend specs)
- [ ] New types are in `types/index.ts` only — not inline
- [ ] API calls are in `lib/api.ts` only — not in components
- [ ] Shared state goes into `chatStore.ts` — not prop-drilled
- [ ] Components use `clsx` for conditional classes
- [ ] `"use client"` is justified (uses hooks or events)

### OpenSearch specs
- [ ] Index mapping JSON is valid (all field types are valid OpenSearch types)
- [ ] `knn_vector` dimension matches 1536 (text-embedding-3-small)
- [ ] `space_type` is `cosinesimil` (consistent with existing pgvector cosine usage)
- [ ] Migration steps include docker-compose, requirements.txt, and config.py changes
- [ ] Old `PostgreSQLRetriever` is commented out, not deleted

### Tests
- [ ] Test cases listed cover: happy path, validation error, not-found
- [ ] Backend tests patch service layer (not DB)
- [ ] Frontend tests mock `lib/api.ts` (not fetch)

## Output Format

```
## Spec Review: <spec filename>

### BLOCKING
- <issue> → <suggested fix>

### WARNING
- <issue> → <suggested fix>

### OK
- <list of checks that passed>

### Verdict
READY / NOT READY — <one line summary>
```
