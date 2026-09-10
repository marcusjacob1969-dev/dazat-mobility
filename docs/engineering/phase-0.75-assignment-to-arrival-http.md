# Engineering Phase 0.75 — Assignment-to-Arrival HTTP

The hosted PostgreSQL vertical slice now continues beyond Dispatch assignment. The assigned Driver acknowledges the Booking through the real idempotent HTTP command, which atomically materialises the canonical Journey and first leg and advances both Journey and Booking to en route.

The same authenticated Driver submits a recent, accurate and confident pickup observation through the location-evidence route. The verifier deliberately expects its authoritative `DELAYED` classification while it remains within the governed critical-decision window. The geofenced arrival command consumes that persisted evidence, records an accepted arrival-evidence row, and advances canonical state to `DRIVER_ARRIVED` / `ARRIVED`.

Both acknowledgement and arrival are replayed with the same idempotency keys and must return their original responses. Rider and Driver progress projections then converge on the same completed arrival milestone. No external mapping, location or messaging provider is contacted.
