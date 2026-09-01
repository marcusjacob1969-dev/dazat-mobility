# Phase 0.27 HTTP-security traceability

| HTTP boundary | Result |
|---|---|
| CI targets canonical hosted `main` branch | SOURCE CREATED |
| API body limit rejects payloads above one mebibyte | RUNTIME TEST PASSED |
| Responses disable MIME sniffing and framing | RUNTIME TEST PASSED |
| Responses use restrictive CSP, permissions and referrer policy | RUNTIME TEST PASSED |
| Responses are not cacheable and advertise HSTS | RUNTIME TEST PASSED |
| Production edge/proxy preservation | NOT EXECUTED IN THIS WORKSPACE |
