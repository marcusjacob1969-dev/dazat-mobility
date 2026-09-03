# Engineering Phase 0.41 — Control Room handover task projection

- [x] Restrict the read to the current owner of one current handover task.
- [x] Revalidate both task-scope and role-assignment validity at read time.
- [x] Require an ACTIVE account and authenticated Support capability.
- [x] Show handover, Support-case, Safety-hold and original-assignment status.
- [x] Show only the next actions permitted by the current lifecycle state.
- [x] Show whether replacement, passenger-transfer and safe-stop evidence exists without returning evidence content.
- [x] Exclude passenger identity, contact, precise location, Safety narrative and financial data.
- [x] Keep the projection read-only and grant no lifecycle mutation authority.

The Journey and Support case identifiers are operational references, not permission to read those aggregates outside their independently authorised APIs.
