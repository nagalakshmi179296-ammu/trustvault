from app.services.audit_service import record_audit_event
from pathlib import Path
from uuid import UUID

from fastapi import (
    APIRouter,
    Depends,
    File,
    Form,
    HTTPException,
    UploadFile,
    status,
)
from fastapi.responses import Response
from sqlalchemy import select, or_
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.api.auth import get_current_user
from app.models import (
    Document,
    DocumentPermission,
    User,
    PermissionLevel,
)
from app.schemas.documents import DocumentResponse
from app.services.document_storage import (
    STORAGE_DIR,
    save_encrypted_document,
    read_encrypted_document,
)

router = APIRouter(
    prefix="/api/v1/documents",
    tags=["Documents"],
)

MAX_FILE_SIZE = 10 * 1024 * 1024

ALLOWED_EXTENSIONS = {
    ".pdf", ".txt", ".docx", ".png", ".jpg", ".jpeg"
}


# --------------------------------------------------
# DOCUMENT ACCESS CONTROL
# --------------------------------------------------


def get_accessible_document(
    document_id: UUID,
    user: User,
    db: Session,
    require_edit: bool = False,
):
    document = db.get(Document, document_id)

    if not document:
        raise HTTPException(404, "Document not found")

    # Document owner always has full access
    if document.owner_id == user.id:
        return document

    permission = db.scalar(
        select(DocumentPermission).where(
            DocumentPermission.document_id == document_id,
            DocumentPermission.user_id == user.id,
        )
    )

    # Hide documents the user cannot access
    if not permission:
        raise HTTPException(404, "Document not found")

    # EDIT permission includes READ access
    if require_edit and permission.permission != PermissionLevel.EDIT:
        raise HTTPException(
            403,
            "Edit permission required",
        )

    return document


# --------------------------------------------------
# UPLOAD DOCUMENT
# --------------------------------------------------

@router.post(
    "/upload",
    response_model=DocumentResponse,
    status_code=status.HTTP_201_CREATED,
)
async def upload_document(
    file: UploadFile = File(...),
    category: str = Form(default="General", max_length=80),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    if not file.filename:
        raise HTTPException(400, "Filename is required")

    original_name = Path(file.filename).name.strip()
    extension = Path(original_name).suffix.lower()

    if not original_name or extension not in ALLOWED_EXTENSIONS:
        raise HTTPException(400, "Unsupported file type")

    data = await file.read(MAX_FILE_SIZE + 1)
    await file.close()

    if not data:
        raise HTTPException(400, "Empty files are not allowed")

    if len(data) > MAX_FILE_SIZE:
        raise HTTPException(413, "Maximum upload size is 10 MB")

    storage_key = save_encrypted_document(data)

    document = Document(
        owner_id=current_user.id,
        name=original_name,
        category=category.strip() or "General",
        storage_key=storage_key,
        encrypted=True,
    )

    try:
        db.add(document)
        db.commit()
        db.refresh(document)
        record_audit_event(
            db=db,
            actor_id=current_user.id,
            document_id=document.id,
            action="DOCUMENT_UPLOAD",
            outcome="success",
            details=f"Uploaded document: {document.name}",
            ip_address=None,  # You can pass the actual IP address if available
        )
    except Exception:
        db.rollback()
        (STORAGE_DIR / storage_key).unlink(missing_ok=True)
        raise HTTPException(500, "Could not save document metadata")

    return document


# --------------------------------------------------
# LIST OWNED AND SHARED DOCUMENTS
# --------------------------------------------------

@router.get("/", response_model=list[DocumentResponse])
def list_documents(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    shared_document_ids = select(
        DocumentPermission.document_id
    ).where(
        DocumentPermission.user_id == current_user.id
    )

    documents = db.scalars(
        select(Document).where(
            or_(
                Document.owner_id == current_user.id,
                Document.id.in_(shared_document_ids),
            )
        ).order_by(Document.created_at.desc())
    ).all()

    return documents


# --------------------------------------------------
# GET DOCUMENT DETAILS
# --------------------------------------------------

@router.get("/{document_id}", response_model=DocumentResponse)
def get_document(
    document_id: UUID,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    return get_accessible_document(
        document_id,
        current_user,
        db,
    )


# --------------------------------------------------
# DOWNLOAD DOCUMENT
# --------------------------------------------------

@router.get("/{document_id}/download")
def download_document(
    document_id: UUID,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    document = get_accessible_document(
        document_id,
        current_user,
        db,
    )

    try:
        content = read_encrypted_document(document.storage_key)
        record_audit_event(
            db=db,
            actor_id=current_user.id,
            document_id=document.id,
            action="DOCUMENT_DOWNLOAD",
            outcome="success",
            details=f"Downloaded document: {document.name}",
            ip_address=None,  # You can pass the actual IP address if available
        )


    except FileNotFoundError:
        raise HTTPException(404, "Stored document not found")

    except Exception:
        raise HTTPException(500, "Could not decrypt document")

    safe_name = Path(document.name).name.replace('"', "")

    return Response(
        content=content,
        media_type="application/octet-stream",
        headers={
            "Content-Disposition": f'attachment; filename="{safe_name}"',
            "Cache-Control": "no-store",
            "X-Content-Type-Options": "nosniff",
        },
    )


# --------------------------------------------------
# GRANT OR UPDATE DOCUMENT PERMISSION
# --------------------------------------------------

@router.post("/{document_id}/permissions")
def grant_document_permission(
    document_id: UUID,
    email: str = Form(...),
    permission: str = Form(...),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    document = db.get(Document, document_id)

    if not document:
        raise HTTPException(404, "Document not found")

    if document.owner_id != current_user.id:
        raise HTTPException(
            403,
            "Only the document owner can share it",
        )

    target_user = db.scalar(
        select(User).where(
            User.email == email.strip().lower()
        )
    )

    if not target_user or not target_user.is_active:
        raise HTTPException(404, "Active recipient not found")

    if target_user.id == current_user.id:
        raise HTTPException(400, "Cannot share with yourself")

    try:
        permission_level = PermissionLevel(permission.lower())
    except ValueError:
        raise HTTPException(
            400,
            "Permission must be read or edit",
        )

    existing = db.scalar(
        select(DocumentPermission).where(
            DocumentPermission.document_id == document_id,
            DocumentPermission.user_id == target_user.id,
        )
    )

    if existing:
        existing.permission = permission_level
        existing.granted_by = current_user.id
        message = "Permission updated"

    else:
        existing = DocumentPermission(
            document_id=document_id,
            user_id=target_user.id,
            permission=permission_level,
            granted_by=current_user.id,
        )
        db.add(existing)
        message = "Permission granted"

    try:
        db.commit()
    except Exception:
        db.rollback()
        raise HTTPException(500, "Could not save permission")

    return {
        "message": message,
        "document_id": str(document_id),
        "recipient": target_user.email,
        "permission": permission_level.value,
    }


# --------------------------------------------------
# LIST DOCUMENT PERMISSIONS
# --------------------------------------------------

@router.get("/{document_id}/permissions")
def list_document_permissions(
    document_id: UUID,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    document = db.get(Document, document_id)

    if not document:
        raise HTTPException(404, "Document not found")

    if document.owner_id != current_user.id:
        raise HTTPException(
            403,
            "Only the owner can view permissions",
        )

    permissions = db.scalars(
        select(DocumentPermission).where(
            DocumentPermission.document_id == document_id
        )
    ).all()

    results = []

    for item in permissions:
        recipient = db.get(User, item.user_id)

        results.append({
            "user_id": str(item.user_id),
            "email": recipient.email if recipient else None,
            "permission": item.permission.value,
            "created_at": item.created_at.isoformat(),
        })

    return results


# --------------------------------------------------
# REVOKE DOCUMENT PERMISSION
# --------------------------------------------------

@router.delete("/{document_id}/permissions/{user_id}")
def revoke_document_permission(
    document_id: UUID,
    user_id: UUID,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    document = db.get(Document, document_id)

    if not document:
        raise HTTPException(404, "Document not found")

    if document.owner_id != current_user.id:
        raise HTTPException(
            403,
            "Only the owner can revoke access",
        )

    permission = db.scalar(
        select(DocumentPermission).where(
            DocumentPermission.document_id == document_id,
            DocumentPermission.user_id == user_id,
        )
    )

    if not permission:
        raise HTTPException(404, "Permission not found")

    try:
        db.delete(permission)
        db.commit()

    except Exception:
        db.rollback()
        raise HTTPException(500, "Could not revoke permission")

    return {
        "message": "Access revoked successfully",
        "document_id": str(document_id),
        "user_id": str(user_id),
    }
