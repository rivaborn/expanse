# cryptr.mjs - Encryption/Decryption

## Overview
Wrapper around the Cryptr library for AES-256-GCM symmetric encryption. Used to encrypt Reddit OAuth refresh tokens before storing in the database.

## Variables
- `cryptr_instance` - Initialized Cryptr instance using `ENCRYPTION_KEY` env var

## Functions

### `encrypt(unencrypted_thing)`
Encrypts a primitive value. Always returns a string. Used when saving Reddit refresh tokens to the database.

### `decrypt(encrypted_thing)`
Decrypts an encrypted string back to plaintext. Used when creating snoowrap requesters that need the raw refresh token.
