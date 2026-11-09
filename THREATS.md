# TrustVault — Threat Model

## 1. Project overview
TrustVault is a prototype secure document-sharing application built with a Next.js frontend, FastAPI backend and PostgreSQL database. It supports document uploads, authenticated access, owner-controlled sharing and access revocation.

## 2. Assets to protect
- Uploaded documents and their contents.
- User credentials and authentication tokens.
- Document ownership and permission records.
- Audit-event records.
- Encryption keys and application configuration.

## 3. Threat actors
- An unauthenticated person attempting to access the API.
- An authenticated user attempting to access another user's documents.
- A user attempting to retain access after permission revocation.
- An administrator or attacker with access to the application server or database.

## 4. Main threats and mitigations

| Threat | Mitigation in this prototype |
|---|---|
| Unauthenticated API access | JWT-based authentication |
| Cross-user document access | Server-side ownership and permission checks |
| Unauthorized document editing | EDIT permission check |
| Access after revocation | Permission is checked when the document is requested |
| Plaintext document storage | AES-GCM encryption before local storage |
| Password disclosure | Password hashing |
| Unauthorized permission changes | Owner-only permission-management routes |
| Audit record alteration | Hash-linked audit-event records |

## 5. Known limitations and residual risks
- This is a hackathon prototype, not a production security certification.
- Encryption keys are not managed through AWS KMS.
- Local encrypted-file storage is not equivalent to hardened cloud object storage.
- The hash-linked audit records are stored in the application database. They are not externally immutable or tamper-proof.
- No independent audit-chain verification or concurrency protection has been established.
- Denied-attempt audit coverage has not been fully verified.
- Production deployment, HTTPS, rate limiting, monitoring, backups and penetration testing require further work.
- Anyone with sufficient server or database access may be able to compromise application data or audit records.

## 6. Security testing priorities
1. Verify that unauthenticated requests cannot access protected endpoints.
2. Verify that one user cannot access another user's private documents.
3. Verify that READ permission does not permit editing.
4. Verify that revocation blocks subsequent document access.
5. Verify that stored document files are encrypted.
6. Verify that audit events are generated for supported operations.

## 7. Responsible use
Use only test documents and accounts during demonstrations. Do not upload confidential customer, banking, identity or personal documents.
