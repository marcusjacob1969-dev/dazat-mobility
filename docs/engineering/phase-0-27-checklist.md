# Engineering Phase 0.27 checklist

## Completed

- [x] Run hosted CI on the canonical `main` branch.
- [x] Enforce a one-mebibyte API request-body ceiling before domain handling.
- [x] Add fail-closed browser capability, framing, MIME-sniffing and referrer headers.
- [x] Disable caching for API and health responses.
- [x] Add HSTS and same-origin resource policy response contracts.
- [x] Verify headers on build metadata and rejection of an oversized identity request.

## Remaining external gates

- [ ] Confirm edge/proxy header preservation in the selected production hosting platform.
- [ ] Define route-specific upload limits before any evidence-upload endpoint is enabled.
