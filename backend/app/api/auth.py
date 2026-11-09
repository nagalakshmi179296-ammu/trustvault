from uuid import UUID

import jwt
from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.database import get_db
from app.models import User, UserRole
from app.schemas.auth import RegisterRequest, LoginRequest, UserResponse, TokenResponse
from app.security.passwords import hash_password, verify_password
from app.security.tokens import create_access_token

router = APIRouter(prefix="/api/v1/auth", tags=["Authentication"])
bearer_scheme = HTTPBearer(auto_error=False)


def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(bearer_scheme),
    db: Session = Depends(get_db),
) -> User:
    if credentials is None or credentials.scheme.lower() != "bearer":
        raise HTTPException(status_code=401, detail="Authentication required")

    try:
        payload = jwt.decode(
            credentials.credentials,
            settings.jwt_secret_key,
            algorithms=[settings.jwt_algorithm],
        )
        user_id = UUID(payload["sub"])
    except (jwt.InvalidTokenError, ValueError, KeyError):
        raise HTTPException(status_code=401, detail="Invalid or expired token")

    user = db.get(User, user_id)
    if user is None or not user.is_active:
        raise HTTPException(status_code=401, detail="User not found or inactive")

    return user


@router.post("/register", response_model=UserResponse, status_code=201)
def register(data: RegisterRequest, db: Session = Depends(get_db)):
    email = str(data.email).lower().strip()

    existing = db.scalar(select(User).where(User.email == email))
    if existing:
        raise HTTPException(status_code=409, detail="Email already registered")

    user = User(
        email=email,
        full_name=data.full_name,
        password_hash=hash_password(data.password),
        role=UserRole.VIEWER,
        is_active=True,
    )
    db.add(user)
    db.commit()
    db.refresh(user)

    return UserResponse(
        id=user.id,
        email=user.email,
        full_name=user.full_name,
        role=user.role.value if hasattr(user.role, "value") else str(user.role),
    )


@router.post("/login", response_model=TokenResponse)
def login(data: LoginRequest, db: Session = Depends(get_db)):
    email = str(data.email).lower().strip()
    user = db.scalar(select(User).where(User.email == email))

    if user is None or not verify_password(data.password, user.password_hash):
        raise HTTPException(status_code=401, detail="Invalid email or password")

    if not user.is_active:
        raise HTTPException(status_code=403, detail="Account is inactive")

    return TokenResponse(
        access_token=create_access_token(user.id),
        user=UserResponse(
            id=user.id,
            email=user.email,
            full_name=user.full_name,
            role=user.role.value if hasattr(user.role, "value") else str(user.role),
        ),
    )


@router.get("/me", response_model=UserResponse)
def get_me(current_user: User = Depends(get_current_user)):
    return UserResponse(
        id=current_user.id,
        email=current_user.email,
        full_name=current_user.full_name,
        role=current_user.role.value if hasattr(current_user.role, "value") else str(current_user.role),
    )
