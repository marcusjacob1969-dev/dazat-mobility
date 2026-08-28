# ADR-0002 — Identity & Account Foundation

Status: Accepted for Engineering Phase 0.2  
Date: 2026-08-28

## Context

DAZAT must represent one human without collapsing identity, login authority and service roles into one record. The blueprint explicitly separates `Person`, `UserAccount`, `RiderProfile` and `DriverProfile`; sessions and device trust are revocable independently of the person and historical service records. Passkeys/device-native authentication are preferred, DAZAT Shield consumes suspicious-session/device signals, and account recovery is a governed state machine rather than a help-desk override.

## Decision

1. `identity.person` is the minimum canonical human identity anchor when DAZAT has a justified need for one.
2. `identity.user_account` owns authentication/session authority and may be recovered, limited or closed without rewriting historical bookings, journeys, safety or finance.
3. Rider and Driver profiles remain separate domain-owned records linked by stable `person_id` references.
4. Contact points are typed records. Contact verification is separate history; possession of a phone/email is not silently treated as identity proof.
5. Phase 0.2 registration creates a **PENDING** account only. It never creates an authenticated session and returns `CONTACT_VERIFICATION_REQUIRED`.
6. Passkey persistence is verifier-only: credential ID/public-key material, counters/transports and metadata may be stored; private keys never are.
7. Device trust is risk evidence, not permanent identity proof.
8. Sessions are independently revocable. Any DAZAT-issued bearer secret must be persisted only as a strong hash/reference, never plaintext.
9. Account recovery uses explicit states and may revoke sessions/devices or require step-up/human review. It does not rewrite service history.
10. `LIMITED` account state is capability-scoped: essential journey/safety/support and history access can remain while high-risk security/payout changes are held.
11. Account registration is an idempotent database transaction containing identity records, profile creation, append-only account lifecycle evidence and an identity outbox event.
12. The WebAuthn/passkey ceremony itself is behind a provider/standards adapter. Phase 0.2 does not invent custom cryptography or accept a client passkey assertion without server verification.

## Consequences

- The Rider and Driver apps can now start real account registration against the canonical API.
- A person can intentionally be both Rider and Driver without duplicate human identity.
- Driver registration does not imply compliance or permission to go online.
- Authentication provider selection can change without changing the DAZAT identity model.
- Contact verification, complete passkey ceremonies, authenticated session issuance and step-up enforcement remain future checkpoints and cannot be represented as complete in Phase 0.2.
