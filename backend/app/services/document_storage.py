
import os
import uuid
from pathlib import Path

from app.security.encryption import encrypt_file, decrypt_file


STORAGE_DIR = Path(__file__).resolve().parents[1] / "storage" / "encrypted"

STORAGE_DIR.mkdir(parents=True, exist_ok=True)


def save_encrypted_document(data: bytes) -> str:
    """Encrypt document contents and save them outside the public web directory."""

    nonce, encrypted_data = encrypt_file(data)

    storage_key = f"{uuid.uuid4().hex}.vault"
    file_path = STORAGE_DIR / storage_key

    # Store nonce followed by authenticated ciphertext.
    temporary_path = file_path.with_suffix(".tmp")

    try:
        with open(temporary_path, "xb") as file:
            file.write(nonce + encrypted_data)

        os.replace(temporary_path, file_path)
    except Exception:
        temporary_path.unlink(missing_ok=True)
        raise

    return storage_key


def read_encrypted_document(storage_key: str) -> bytes:
    """Read and decrypt a document using its server-generated storage key."""

    # Never accept arbitrary filesystem paths.
    if (
        not storage_key.endswith(".vault")
        or len(storage_key) != 38
        or not all(c in "0123456789abcdef" for c in storage_key[:-6])
    ):
        raise ValueError("Invalid storage key")

    file_path = STORAGE_DIR / storage_key

    with open(file_path, "rb") as file:
        stored_data = file.read()

    if len(stored_data) < 29:
        raise ValueError("Encrypted document is corrupted")

    nonce = stored_data[:12]
    encrypted_data = stored_data[12:]

    return decrypt_file(encrypted_data, nonce)
