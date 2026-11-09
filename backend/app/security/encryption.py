import base64
import os

from cryptography.hazmat.primitives.ciphers.aead import AESGCM

from app.core.config import settings


def get_encryption_key() -> bytes:
    try:
        key = base64.b64decode(
            settings.document_encryption_key,
            validate=True,
        )
    except Exception as exc:
        raise ValueError("Invalid document encryption key") from exc

    if len(key) != 32:
        raise ValueError("Document encryption key must be 32 bytes")

    return key


def encrypt_file(data: bytes) -> tuple[bytes, bytes]:
    key = get_encryption_key()
    nonce = os.urandom(12)

    encrypted_data = AESGCM(key).encrypt(nonce, data, None)

    return nonce, encrypted_data


def decrypt_file(encrypted_data: bytes, nonce: bytes) -> bytes:
    key = get_encryption_key()

    return AESGCM(key).decrypt(nonce, encrypted_data, None)