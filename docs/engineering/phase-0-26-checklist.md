# Engineering Phase 0.26 checklist

## Completed

- [x] Default verification delivery to disabled unless development console mode is explicit.
- [x] Verify all provider and operational mutation switches reject unapproved enablement.
- [x] Verify database, Redis and strong verification peppers are mandatory.
- [x] Verify development pricing requires safe integer minor units and canonical currency.
- [x] Verify safety-critical ports, attempt counts and confidence bounds fail closed.
- [x] Execute configuration contracts with the compiled production configuration loader.

## Remaining external gates

- [ ] Supply production secrets through an approved secrets manager.
- [ ] Approve providers and operational mutations separately before changing disabled modes.
