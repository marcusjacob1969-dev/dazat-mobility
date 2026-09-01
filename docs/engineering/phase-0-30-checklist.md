# Engineering Phase 0.30 checklist

## Completed

- [x] Disable Fastify's default request logging so raw request URLs are not emitted.
- [x] Log canonical route templates without query strings.
- [x] Redact authorisation, cookie, API-key and response-cookie fields.
- [x] Minimise request log serialization to the HTTP method.
- [x] Replace error message and stack serialization with redacted values.
- [x] Log unhandled failure metadata without the original error object.
- [x] Runtime-test credential, query and internal-error non-disclosure.
- [x] Retain server-owned request correlation in safe operational logs.

## Remaining external gates

- [ ] Approve monitoring-provider access, regional storage and retention policy.
- [ ] Verify the production edge and provider do not add unsafe request logging.
