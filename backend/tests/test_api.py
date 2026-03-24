"""
Basic integration tests for the RAG API.
Run with: pytest backend/tests/ -v
"""
import pytest
from fastapi.testclient import TestClient
from unittest.mock import AsyncMock, MagicMock, patch

from app.main import app

client = TestClient(app)


# ── Health check ──────────────────────────────────────────────────────────────

def test_health_check():
    response = client.get("/health")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "ok"
    assert "version" in data


# ── Document endpoints ─────────────────────────────────────────────────────────

@patch("app.routes.upload.document_service.get_documents")
def test_list_documents_empty(mock_get_docs):
    mock_get_docs.return_value = []
    response = client.get("/api/v1/documents")
    assert response.status_code == 200
    data = response.json()
    assert data["documents"] == []
    assert data["total"] == 0


@patch("app.routes.upload.document_service.validate_upload")
@patch("app.routes.upload.document_service.create_document_record")
@patch("app.routes.upload.document_service.process_document")
def test_upload_txt(mock_process, mock_create, mock_validate):
    mock_validate.return_value = b"hello world"
    mock_create.return_value = "test-doc-id-1234"
    mock_process.return_value = {"document_id": "test-doc-id-1234", "chunk_count": 1}

    files = {"file": ("test.txt", b"hello world content", "text/plain")}
    response = client.post("/api/v1/upload", files=files)
    assert response.status_code == 202
    data = response.json()
    assert data["status"] == "processing"
    assert "document_id" in data


# ── History endpoints ──────────────────────────────────────────────────────────

@patch("app.routes.history.history_service.list_chats")
def test_list_chats_empty(mock_list):
    mock_list.return_value = []
    response = client.get("/api/v1/history")
    assert response.status_code == 200
    data = response.json()
    assert data["chats"] == []


@patch("app.routes.history.history_service.create_chat")
def test_create_chat(mock_create):
    from datetime import datetime, timezone
    now = datetime.now(timezone.utc).isoformat()
    mock_create.return_value = {
        "id": "chat-id-1234",
        "title": "Test Chat",
        "created_at": now,
        "updated_at": now,
    }
    response = client.post("/api/v1/history", json={"title": "Test Chat"})
    assert response.status_code == 201
    data = response.json()
    assert data["title"] == "Test Chat"


@patch("app.routes.history.history_service.get_chat")
def test_get_chat_not_found(mock_get):
    mock_get.return_value = None
    response = client.get("/api/v1/history/00000000-0000-0000-0000-000000000000")
    assert response.status_code == 404


# ── Chunking unit test ────────────────────────────────────────────────────────

def test_simple_chunk():
    from app.services.document_service import _simple_chunk

    text = " ".join([f"word{i}" for i in range(100)])
    chunks = _simple_chunk(text)
    assert len(chunks) > 0
    for chunk in chunks:
        assert isinstance(chunk, str)
        assert len(chunk) > 0
