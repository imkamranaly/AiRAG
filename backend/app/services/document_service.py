import io
import json
import logging
import uuid
from pathlib import Path
from typing import Any, Dict, List

from fastapi import HTTPException, UploadFile

from app.core.config import get_settings
from app.core.db import ensure_pool as get_pool
from app.services.embedding_service import embed_texts

logger = logging.getLogger(__name__)
settings = get_settings()


def _vec(embedding: List[float]) -> str:
    """Serialise a float list to a PostgreSQL vector literal: '[0.1,0.2,...]'."""
    return "[" + ",".join(str(x) for x in embedding) + "]"


def _parse_pdf(content: bytes) -> str:
    try:
        import pypdf
        reader = pypdf.PdfReader(io.BytesIO(content))
        pages = [page.extract_text() or "" for page in reader.pages]
        return "\n\n".join(p for p in pages if p.strip())
    except Exception as e:
        raise HTTPException(status_code=422, detail=f"Failed to parse PDF: {e}")


def _parse_docx(content: bytes) -> str:
    try:
        import docx
        doc = docx.Document(io.BytesIO(content))
        return "\n\n".join(p.text for p in doc.paragraphs if p.text.strip())
    except Exception as e:
        raise HTTPException(status_code=422, detail=f"Failed to parse DOCX: {e}")


def _parse_text(content: bytes) -> str:
    for encoding in ("utf-8", "latin-1", "cp1252"):
        try:
            return content.decode(encoding)
        except UnicodeDecodeError:
            continue
    raise HTTPException(status_code=422, detail="Could not decode text file.")


def _extract_text(content: bytes, filename: str) -> str:
    ext = Path(filename).suffix.lower()
    if ext == ".pdf":
        return _parse_pdf(content)
    if ext == ".docx":
        return _parse_docx(content)
    if ext in (".txt", ".md", ".markdown"):
        return _parse_text(content)
    raise HTTPException(status_code=422, detail=f"Unsupported file type: {ext}")


def _chunk_text(text: str) -> List[str]:
    """Sentence-aware chunking using LlamaIndex SentenceSplitter."""
    try:
        from llama_index.core.node_parser import SentenceSplitter
        splitter = SentenceSplitter(
            chunk_size=settings.CHUNK_SIZE,
            chunk_overlap=settings.CHUNK_OVERLAP,
        )
        chunks = splitter.split_text(text)
        return [c for c in chunks if c.strip()]
    except Exception as e:
        logger.warning("LlamaIndex chunking failed, falling back to simple splitter: %s", e)
        return _simple_chunk(text)


def _simple_chunk(text: str) -> List[str]:
    size = settings.CHUNK_SIZE
    overlap = settings.CHUNK_OVERLAP
    words = text.split()
    chunks, i = [], 0
    while i < len(words):
        chunk = " ".join(words[i : i + size])
        if chunk.strip():
            chunks.append(chunk)
        i += size - overlap
    return chunks


async def validate_upload(file: UploadFile) -> bytes:
    ext = Path(file.filename or "").suffix.lower()
    if ext not in settings.ALLOWED_EXTENSIONS:
        raise HTTPException(
            status_code=400,
            detail=f"File type '{ext}' not allowed. Allowed: {settings.ALLOWED_EXTENSIONS}",
        )
    content = await file.read()
    size_mb = len(content) / (1024 * 1024)
    if size_mb > settings.MAX_FILE_SIZE_MB:
        raise HTTPException(
            status_code=413,
            detail=f"File too large ({size_mb:.1f} MB). Max: {settings.MAX_FILE_SIZE_MB} MB",
        )
    return content


async def process_document(
    content: bytes, filename: str, document_id: str
) -> Dict[str, Any]:
    """
    Full pipeline:
    1. Extract text
    2. Chunk
    3. Embed
    4. Store chunks in PostgreSQL
    """
    # 1. Extract text
    text = _extract_text(content, filename)
    if not text.strip():
        raise HTTPException(status_code=422, detail="Document contains no extractable text.")

    # 2. Chunk
    chunks = _chunk_text(text)
    logger.info("[doc:%s] Extracted %d chunks from '%s'", document_id, len(chunks), filename)

    # 3. Embed all chunks in one batched call
    embeddings = await embed_texts(chunks)

    # 4. Persist chunks + mark document ready
    pool = await get_pool()
    async with pool.acquire() as conn:
        chunk_rows = [
            (
                str(uuid.uuid4()),
                document_id,
                chunk,
                _vec(embedding),
                idx,
                {"filename": filename, "char_count": len(chunk)},
            )
            for idx, (chunk, embedding) in enumerate(zip(chunks, embeddings))
        ]
        await conn.executemany(
            """INSERT INTO chunks (id, document_id, content, embedding, chunk_index, metadata)
               VALUES ($1, $2, $3, $4::vector, $5, $6)""",
            chunk_rows,
        )
        await conn.execute(
            """UPDATE documents
               SET status = 'ready', metadata = $1
               WHERE id = $2""",
            {"chunk_count": len(chunks), "char_count": len(text)},
            document_id,
        )

    return {"document_id": document_id, "chunk_count": len(chunks)}


async def create_document_record(
    filename: str, file_size: int, file_type: str
) -> str:
    doc_id = str(uuid.uuid4())
    pool = await get_pool()
    async with pool.acquire() as conn:
        await conn.execute(
            """INSERT INTO documents (id, name, file_type, file_size, status)
               VALUES ($1, $2, $3, $4, 'processing')""",
            doc_id, filename, file_type, file_size,
        )
    return doc_id


async def get_documents(limit: int = 50, offset: int = 0) -> List[Dict]:
    pool = await get_pool()
    async with pool.acquire() as conn:
        rows = await conn.fetch(
            """SELECT id, name, file_type, file_size, status, metadata, created_at, updated_at
               FROM documents
               ORDER BY created_at DESC
               LIMIT $1 OFFSET $2""",
            limit, offset,
        )
    return [dict(r) for r in rows]


async def delete_document(document_id: str) -> None:
    pool = await get_pool()
    async with pool.acquire() as conn:
        # chunks deleted via ON DELETE CASCADE
        await conn.execute("DELETE FROM documents WHERE id = $1", document_id)
