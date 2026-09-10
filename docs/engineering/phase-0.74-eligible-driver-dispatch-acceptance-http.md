# Engineering Phase 0.74 — Eligible-Driver Dispatch Acceptance HTTP

The hosted PostgreSQL vertical slice now proves the successful Dispatch branch through real authenticated Rider and Driver HTTP routes. The Driver self-registers and verifies a development-only contact, while the verifier seeds the back-office-controlled approval, compliance, vehicle, pair-insurance, regional permission and maintenance evidence that self-service must never grant.

The Driver goes `AVAILABLE` with fresh, confident location evidence. A second confirmed Rider Booking then enters Dispatch, creates one eligible candidate and one informed offer, and exposes that offer only to the assigned Driver session.

Acceptance is actionable only because the test configuration explicitly enables paired development fixtures for pickup ETA and an independently configured Driver earning. Without both fields, production behavior remains fail closed and blind acceptance remains prohibited.

The Driver accepts through the real idempotent HTTP command. PostgreSQL atomically creates the assignment, transitions availability and Booking state, empties the open-offer list, and produces identical Rider and Driver canonical progress at `DRIVER_ASSIGNED`. All synthetic evidence is enclosed by the verifier's outer rollback.
