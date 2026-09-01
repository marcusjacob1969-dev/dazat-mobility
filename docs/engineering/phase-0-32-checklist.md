# Engineering Phase 0.32 checklist

## Completed

- [x] Reject malformed bearer tokens before database access.
- [x] Query sessions by a one-way token hash rather than the bearer secret.
- [x] Prove raw bearer tokens do not enter database query parameters.
- [x] Reject revoked sessions without refreshing activity.
- [x] Reject expired sessions without refreshing activity.
- [x] Enforce account capability restrictions before returning a principal.
- [x] Refresh last_seen_at only for authoritative permitted sessions.
- [x] Return only server-owned principal identity and profile references.

## Remaining external gates

- [ ] Exercise session revocation and rotation through approved production clients.
- [ ] Validate distributed session abuse controls with the selected shared state and edge platforms.
