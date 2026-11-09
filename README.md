# TrustVault

Secure document-sharing prototype built with Next.js, FastAPI and PostgreSQL.

## Features
- JWT authentication
- Document upload and listing
- AES-GCM encrypted file storage
- READ and EDIT permissions
- Permission revocation
- Server-side access control
- Hash-linked audit events

## Local Setup

### Database
docker compose up -d

### Backend
cd backend
.venv\Scripts\Activate.ps1
python -m uvicorn app.main:app --host 127.0.0.1 --port 8000

### Frontend (new terminal)
cd frontend
npm install
npm run dev

## URLs
Frontend: http://localhost:3000
API documentation: http://127.0.0.1:8000/api/docs

## Tests
From the backend directory:
python -m pytest tests -v

## Security limitations
This is a hackathon prototype, not a production-certified security system. The audit trail is hash-linked but not independently immutable. AWS KMS integration and independent penetration testing have not been completed.

Use synthetic demonstration documents only.

## GitHub
https://github.com/nagalakshmi179296-ammu/trustvault
