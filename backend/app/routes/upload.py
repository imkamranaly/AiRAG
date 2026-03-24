import logging
from uuid import UUID

from fastapi import APIRouter, BackgroundTasks, File, HTTPException, Query, UploadFile

from app.models.schemas import DocumentListResponse, DocumentResponse, UploadResponse
from app.services import document_service

logger = logging.getLogger(__name__)
router = APIRouter()


async def _process_in_background(content: bytes, filename: str, document_id: str) -> None:
    """Background task: process document and update status."""
    try:
        await document_service.process_document(content, filename, document_id)
        logger.info("Document %s processed successfully.", document_id)
    except Exception as e:
        logger.error("Document %s processing failed: %s", document_id, e)
        from app.core.db import ensure_pool
        pool = await ensure_pool()
        async with pool.acquire() as conn:
            await conn.execute(
                "UPDATE documents SET status = 'failed', metadata = $1 WHERE id = $2",
                {"error": str(e)},
                document_id,
            )


@router.post("/upload", response_model=UploadResponse, status_code=202)
async def upload_document(
    background_tasks: BackgroundTasks,
    file: UploadFile = File(...),
) -> UploadResponse:
    """
    Upload a document (PDF, TXT, MD, DOCX).
    Processing (chunking + embedding) happens asynchronously in the background.
    Poll /documents to check status.
    """
    content = await document_service.validate_upload(file)

    import mimetypes
    file_type = mimetypes.guess_type(file.filename or "")[0] or "application/octet-stream"

    document_id = await document_service.create_document_record(
        filename=file.filename or "unnamed",
        file_size=len(content),
        file_type=file_type,
    )

    background_tasks.add_task(
        _process_in_background, content, file.filename or "unnamed", document_id
    )

    return UploadResponse(
        document_id=document_id,
        name=file.filename or "unnamed",
        status="processing",
        message="Document uploaded successfully. Processing in background.",
    )


@router.get("/documents", response_model=DocumentListResponse)
async def list_documents(
    limit: int = Query(default=50, ge=1, le=100),
    offset: int = Query(default=0, ge=0),
) -> DocumentListResponse:
    docs = await document_service.get_documents(limit=limit, offset=offset)
    responses = [
        DocumentResponse(
            id=d["id"],
            name=d["name"],
            file_type=d["file_type"],
            file_size=d["file_size"],
            status=d["status"],
            metadata=d.get("metadata") or {},
            created_at=d["created_at"],
            chunk_count=(d.get("metadata") or {}).get("chunk_count"),
        )
        for d in docs
    ]
    return DocumentListResponse(documents=responses, total=len(responses))


@router.delete("/documents/{document_id}", status_code=204)
async def delete_document(document_id: UUID) -> None:
    await document_service.delete_document(str(document_id))
