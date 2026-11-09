
import hashlib
import json

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models import AuditEvent


def record_audit_event(
    db: Session,
    actor_id,
    document_id,
    action: str,
    outcome: str = "success",
    details: str = "",
    ip_address: str = None,
):
    try:
        previous = db.scalar(
            select(AuditEvent)
            .order_by(AuditEvent.created_at.desc(), AuditEvent.id.desc())
            .limit(1)
        )

        previous_hash = previous.event_hash if previous else "GENESIS"

        payload = {
            "actor_id": str(actor_id) if actor_id else None,
            "document_id": str(document_id) if document_id else None,
            "action": action,
            "outcome": outcome,
            "details": details,
            "ip_address": ip_address,
            "previous_hash": previous_hash,
        }

        canonical = json.dumps(
            payload,
            sort_keys=True,
            separators=(",", ":"),
        )

        event_hash = hashlib.sha256(
            canonical.encode("utf-8")
        ).hexdigest()

        event = AuditEvent(
            actor_id=actor_id,
            document_id=document_id,
            action=action,
            outcome=outcome,
            details=details,
            ip_address=ip_address,
            previous_hash=previous_hash,
            event_hash=event_hash,
        )

        db.add(event)
        db.commit()

        return event

    except Exception:
        db.rollback()
        raise
