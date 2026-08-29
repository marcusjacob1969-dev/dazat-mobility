# Rider application shell

The Rider UI is intentionally not being polished before Identity and the canonical Booking/Journey APIs exist.

Current source slice: verified session → Booking/Quote/Confirm → Dispatch projection → pickup Journey reconciliation → self-booker PIN RideCheck. The challenge is returned once and never stored by the app as durable state.
