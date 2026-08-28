# Engineering Phase 0.2 — Identity & Account Traceability

Blueprint baseline: DAZAT Mobility Master Blueprint v0.4 PRE-WORK COMPLETE.

| Requirement / invariant | Phase 0.2 implementation evidence | Status |
|---|---|---|
| Person, UserAccount, RiderProfile and DriverProfile remain distinct | `0001_foundation.sql`, `0002_identity_account_foundation.sql`, registration transaction | IMPLEMENTED_SOURCE / DB_NOT_EXECUTED_HERE |
| Same person may be Rider and Driver | `profileKinds('BOTH')`, registration service can create both profiles | IMPLEMENTED_SOURCE + DOMAIN_TEST |
| Contact points are typed; verification is separate | `identity.contact_point`, `identity.verification_record` | IMPLEMENTED_SOURCE / VERIFICATION_PROVIDER_NOT_WIRED |
| Passkeys/device-native authentication preferred | `identity.authenticator`, `authentication-port.ts` | PASSKEY_READY_MODEL / CEREMONY_NOT_IMPLEMENTED |
| Device trust is evidence, not identity proof | `identity.device_trust_record`, ADR-0002 | IMPLEMENTED_MODEL |
| Sessions revocable independently of Person | `identity.session`, `isSessionAuthoritative()` | IMPLEMENTED_MODEL + DOMAIN_TEST |
| Account recovery explicit state machine | `identity.account_recovery_case`, recovery domain transitions | IMPLEMENTED_MODEL + DOMAIN_TEST |
| Lost-device/recovery can revoke auth without deleting service history | storage boundaries + ADR-0002 | ARCHITECTURE_ENFORCED / USE CASE LATER |
| Limited Account Mode preserves essential access and holds risky changes | `canUseAccountCapability()` | IMPLEMENTED_DOMAIN + DOMAIN_TEST |
| Registration must not manufacture verification/authentication certainty | endpoint returns PENDING + CONTACT_VERIFICATION_REQUIRED | IMPLEMENTED_SOURCE + STATIC CHECK |
| Driver signup must not imply driver eligibility | Driver UI wording + separate `driver_profile.onboarding_status` | IMPLEMENTED_SOURCE + STATIC CHECK |
| Identity command is idempotent | `identity.command_deduplication` + registration transaction | IMPLEMENTED_SOURCE / DB INTEGRATION TEST PENDING |
| Identity event commits with domain transaction | `identity.outbox_message` written inside registration transaction | IMPLEMENTED_SOURCE / DB INTEGRATION TEST PENDING |
| Raw auth secrets must not be stored | passkey private key absent; `session_token_hash` only | IMPLEMENTED_SCHEMA RULE / SECURITY TESTS LATER |

## Explicit non-claims

Phase 0.2 does **not** claim that email/SMS verification, passkey/WebAuthn cryptographic ceremonies, MFA/step-up enforcement, session bearer-token issuance, account recovery operations, Shield risk decisions, driver compliance, or production identity-provider integration are complete.
