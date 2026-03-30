---
name: test-backend
description: Run backend tests, interpret failures, and fix them. Use after implementing a backend feature.
---

Run and fix backend tests for the AiRAG FastAPI application.

## Steps

1. Run the full test suite:
   ```bash
   cd /home/kamran/AI-RAG/AiRAG/backend && python -m pytest -v 2>&1
   ```

2. If all tests pass → report "All backend tests passing ✓" and stop.

3. If tests fail:
   a. Read each failing test file and the source files it tests.
   b. Identify the root cause (not just the assertion failure).
   c. Fix the issue — prefer fixing source code over changing tests unless the test itself is wrong.
   d. Re-run only the failing tests to confirm fix:
      ```bash
      cd /home/kamran/AI-RAG/AiRAG/backend && python -m pytest tests/test_<name>.py -v 2>&1
      ```
   e. Run the full suite once more to check for regressions.

## Fix Rules

- **Patch at service layer** — if a test patches the wrong layer, fix the patch target not the test structure.
- **Never loosen assertions** to make tests pass — if a test asserts `status_code == 201` and the route returns 200, fix the route.
- **Async test functions** need `@pytest.mark.asyncio` and `pytest-asyncio` installed.
- **Import errors** — check `requirements.txt` for missing packages before adding code.
- **Pool errors** (`PostgreSQL is not reachable`) in tests — the test must mock `get_pool` or `ensure_pool`.

## Common Fix Patterns

### Missing mock for DB pool
```python
# Add to test fixtures:
from unittest.mock import AsyncMock, MagicMock, patch

@pytest.fixture(autouse=True)
def mock_pool():
    mock_conn = AsyncMock()
    mock_conn.__aenter__ = AsyncMock(return_value=mock_conn)
    mock_conn.__aexit__ = AsyncMock(return_value=False)
    mock_pool = MagicMock()
    mock_pool.acquire.return_value = mock_conn
    with patch("app.core.db.get_pool", return_value=mock_pool):
        yield mock_conn
```

### Async service function not awaited
```python
# Wrong:
mock.return_value = {"id": "abc"}
# Right for async service:
mock = AsyncMock(return_value={"id": "abc"})
```

## Output Format

```
Backend Tests
─────────────
Ran: N tests
Passed: N
Failed: N

Failures fixed:
  - tests/test_<name>.py::test_<case> — <root cause> → <fix applied>

Final result: PASSING / STILL FAILING
```
