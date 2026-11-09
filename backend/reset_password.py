from getpass import getpass
from app.core.database import SessionLocal
from app.models import User
from app.security.passwords import hash_password

db = SessionLocal()

try:
    user = db.query(User).filter(User.email == "owner@test.com").first()

    if user is None:
        print("Account not found")
    else:
        password = input("Enter a new password (minimum 12 characters): ")

        if len(password) < 12:
            print("Password must contain at least 12 characters")
        else:
            user.password_hash = hash_password(password)
            db.commit()
            print("Password reset successful for:", user.email)
finally:
    db.close()
