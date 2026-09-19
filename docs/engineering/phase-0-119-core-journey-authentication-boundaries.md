# Phase 0.119 — Core Journey authentication boundaries

The database-backed HTTP verifier now covers authentication for all three Core Journey read surfaces.

Expired sessions are rejected on Rider, Driver and Control Room routes. Requests without a bearer token are rejected with `AUTHENTICATION_REQUIRED` on Driver and Control Room routes as well as the existing Rider proof.

This is additive proof only; no route or authorization policy is weakened.