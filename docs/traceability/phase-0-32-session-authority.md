# Phase 0.32 session-authority traceability

| Session boundary | Result |
|---|---|
| Malformed bearer token avoids storage | RUNTIME TEST PASSED |
| Session lookup uses SHA-256 token hash | RUNTIME TEST PASSED |
| Raw bearer token is absent from queries | RUNTIME TEST PASSED |
| Revoked session fails closed | RUNTIME TEST PASSED |
| Expired session fails closed | RUNTIME TEST PASSED |
| Denied account capability fails closed | RUNTIME TEST PASSED |
| Invalid or denied session does not refresh activity | RUNTIME TEST PASSED |
| Authoritative permitted session refreshes activity | RUNTIME TEST PASSED |
