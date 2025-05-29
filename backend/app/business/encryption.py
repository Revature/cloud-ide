# business/encryption.py
"""Module for encrypting and decrypting text using AES-128 CBC mode with PKCS7 padding."""

import os
import base64
from cryptography.hazmat.primitives.ciphers import Cipher, algorithms, modes
from cryptography.hazmat.primitives import padding
from cryptography.hazmat.backends import default_backend

def encrypt_text(text: str) -> str:
    """
    Encrypts the given text using AES-128 CBC mode with PKCS7 padding.

    Uses the key from the specified environment variable (default: ENCRYPTION_KEY).
    The IV is set to be the same as the key (truncated to 16 bytes).
    Returns a URL-safe Base64 encoded string of IV + ciphertext.
    """
    min_encrypton_length = 16
    # print("Encrypting text")
    key = os.getenv("ENCRYPTION_KEY")
    if not key:
        raise ValueError("ENCRYPTION_KEY environment variable is not set.")

    key_bytes = key.encode("utf-8")
    if len(key_bytes) < min_encrypton_length:
        raise ValueError("ENCRYPTION_KEY must be at least 16 bytes long.")
    key_bytes = key_bytes[:16]

    # Use key_bytes as the IV (note: not recommended for production)
    iv = key_bytes

    backend = default_backend()
    cipher = Cipher(algorithms.AES(key_bytes), modes.CBC(iv), backend=backend)

    # Pad the text so its length is a multiple of 16 bytes.
    padder = padding.PKCS7(128).padder()
    padded_data = padder.update(text.encode("utf-8")) + padder.finalize()

    encryptor = cipher.encryptor()
    ciphertext = encryptor.update(padded_data) + encryptor.finalize()

    encrypted = iv + ciphertext
    # print("Encrypted text")
    return base64.urlsafe_b64encode(encrypted).decode("utf-8")

def decrypt_text(encrypted_text: str) -> str:
    """
    Decrypts the given URL-safe Base64 encoded string that was encrypted with AES-128 CBC mode with PKCS7 padding.

    Uses the key from the specified environment variable (default: ENCRYPTION_KEY).
    Expects that the first 16 bytes of the decoded data are the IV.
    Returns the original plaintext.
    """
    min_encryption_length = 16
    # print("Decrypting text")
    key = os.getenv("ENCRYPTION_KEY")
    if not key:
        raise ValueError("ENCRYPTION_KEY environment variable is not set.")

    key_bytes = key.encode("utf-8")
    if len(key_bytes) < min_encryption_length:
        raise ValueError("ENCRYPTION_KEY must be at least 16 bytes long.")
    key_bytes = key_bytes[:16]

    # Decode the encrypted text
    encrypted_bytes = base64.urlsafe_b64decode(encrypted_text)
    iv = encrypted_bytes[:16]
    ciphertext = encrypted_bytes[16:]

    backend = default_backend()
    cipher = Cipher(algorithms.AES(key_bytes), modes.CBC(iv), backend=backend)
    decryptor = cipher.decryptor()
    padded_plaintext = decryptor.update(ciphertext) + decryptor.finalize()

    # Unpad the plaintext
    unpadder = padding.PKCS7(128).unpadder()
    plaintext_bytes = unpadder.update(padded_plaintext) + unpadder.finalize()
    # print("Decrypted text")
    return plaintext_bytes.decode("utf-8")
