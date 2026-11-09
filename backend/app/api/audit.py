from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.api.auth import get_current_user
from app.models import User, UserRole, AuditEvent

router = APIRouter(prefix="/api/v1/audit", tags=["Audit"])


@router.get("/")
def get_audit_history(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    if current_user.role not in (UserRole.OWNER, UserRole.ADMIN):
        raise HTTPException(status_code=403, detail="Access denied")

    events = db.scalars(
        select(AuditEvent)
        .order_by(AuditEvent.created_at.desc())
        .limit(200)
    ).all()

    return [
        {
            "id": str(event.id),
            "actor_id": str(event.actor_id) if event.actor_id else None,
            "document_id": str(event.document_id) if event.document_id else None,
            "action": event.action,
            "outcome": event.outcome,
            "details": event.details,
            "previous_hash": event.previous_hash,
            "event_hash": event.event_hash,
            "created_at": event.created_at.isoformat(),
        }
        for event in events
    ]
