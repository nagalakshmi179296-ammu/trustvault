
from contextlib import asynccontextmanager
from datetime import datetime, timezone

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from app.api.auth import router as auth_router
from app.api.documents import router as documents_router
from app.api.audit import router as audit_router


@asynccontextmanager
async def lifespan(app: FastAPI):
    print("TrustVault API starting...")
    yield
    print("TrustVault API shutting down...")


app = FastAPI(
    title="TrustVault API",
    description=(
        "Secure document management platform "
        "with encrypted storage and document-level permissions."
    ),
    version="1.0.0",
    lifespan=lifespan,
    docs_url="/api/docs",
    redoc_url="/api/redoc",
    openapi_url="/api/openapi.json",
)

# Register API routers exactly once
app.include_router(auth_router)
app.include_router(documents_router)
app.include_router(audit_router)


app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",
        "https://trustvault-rouge.vercel.app",
    ],
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allow_headers=["Authorization", "Content-Type"],
)

@app.middleware("http")
async def security_headers(request: Request, call_next):
    response = await call_next(request)

    response.headers["X-Content-Type-Options"] = "nosniff"
    response.headers["X-Frame-Options"] = "DENY"
    response.headers["Referrer-Policy"] = "no-referrer"
    response.headers["Cache-Control"] = "no-store"

    return response


@app.get("/", tags=["System"])
async def root():
    return {
        "application": "TrustVault",
        "version": "1.0.0",
        "message": "Secure document platform API",
        "documentation": "/api/docs",
    }


@app.get("/api/v1/health", tags=["System"])
async def health():
    return {
        "status": "healthy",
        "service": "trustvault-api",
        "timestamp": datetime.now(timezone.utc).isoformat(),
    }


@app.get("/api/v1/info", tags=["System"])
async def application_info():
    return {
        "name": "TrustVault",
        "version": "1.0.0",
        "security": {
            "encryption": "AES-256-GCM",
            "audit": "Hash-linked audit events",
            "authorization": "Document-level access control",
        },
    }


@app.exception_handler(Exception)
async def global_exception_handler(
    request: Request,
    exc: Exception,
):
    print(f"Unhandled application error: {type(exc).__name__}")

    return JSONResponse(
        status_code=500,
        content={"detail": "Internal server error"},
    )
