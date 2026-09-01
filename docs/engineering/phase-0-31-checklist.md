# Engineering Phase 0.31 checklist

## Completed

- [x] Keep proxy trust disabled until an approved edge and proxy topology exist.
- [x] Runtime-test that caller-supplied forwarded IP is not authoritative.
- [x] Runtime-test that caller-supplied forwarded protocol is not authoritative.
- [x] Runtime-test that caller-supplied forwarded host is not authoritative.
- [x] Bound connection establishment time.
- [x] Bound complete request time.
- [x] Bound idle keep-alive time.
- [x] Bound requests reused on one socket.

## Remaining external gates

- [ ] Configure an exact trusted-proxy allowlist for the selected production edge.
- [ ] Validate timeout values under approved load, accessibility and poor-connectivity tests.
- [ ] Configure distributed rate limiting after the shared state and edge platforms are selected.
