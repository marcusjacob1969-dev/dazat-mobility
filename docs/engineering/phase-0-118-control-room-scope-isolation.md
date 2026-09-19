# Phase 0.118 — Control Room Core Journey scope isolation

The HTTP/PostgreSQL proof now verifies that a valid Control Room fatigue-handover task scope is bound to its governed Journey booking.

Reusing the valid handover scope against another completed booking or a private unrelated booking returns `CORE_JOURNEY_NOT_FOUND`. No general Control Room booking lookup is introduced.