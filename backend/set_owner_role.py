from app.core.database import SessionLocal
from app.models import User, UserRole

db = SessionLocal()
try:
    user = db.query(User).filter(User.email == "owner@test.com").first()
    if not user:
        raise SystemExit("User not found")

    user.role = UserRole.OWNER
    db.commit()
    print("SUCCESS: owner@test.com is now OWNER")
finally:
    db.close()
