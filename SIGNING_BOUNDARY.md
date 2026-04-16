# Signing Boundary

## Principle
Main app orchestrates intents; signer service performs signing.

## Flow
1. Backend creates `SigningRequest` with unsigned payload.
2. Backend sends signing request to signer boundary.
3. Signer returns signed payload + signer reference.
4. Backend broadcasts via network adapter and persists tx hash.

## Security intent
- Avoid private key exposure in main app process.
- Enable future HSM, multisig, and approval workflows with minimal refactor.
