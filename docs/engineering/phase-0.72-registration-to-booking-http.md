# Engineering Phase 0.72 — Registration-to-confirmed-Booking HTTP

Hosted disposable-PostGIS verification now starts the Rider vertical slice at the public Identity boundary. It submits an idempotent Rider registration, requests a synthetic development-only contact challenge, confirms the returned six-digit code, receives an opaque bearer session and verifies that session through the authenticated route.

That newly issued session—not a pre-seeded credential—then creates, quotes and confirms the Phase 0.71 Booking and reads its canonical progress. Finally, the session is revoked through HTTP and immediately fails authentication.

The code is exposed only because the hosted fixture explicitly selects development-console delivery and the development exposure flag. The transaction is rolled back, production providers remain disabled and no real contact is used.
