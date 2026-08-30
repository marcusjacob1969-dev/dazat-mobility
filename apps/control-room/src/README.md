# Control Room application shell

The Control Room will consume authorised API/read models. It must never become an alternate database editor or a second source of Booking, Safety, Finance, Driver or Shield truth.

Phase 0.6 adds read-only Journey health, connectivity confidence, route concern and completion/handover expectations without copying raw restricted Safety facts. Staff role grants, Safety response, hold release and authorised handover commands are not implemented, so no internal mutation endpoint is exposed here.

Phase 0.7 documents the Finance projection boundary: no direct balance edits, no blind retry of `STATUS_UNKNOWN`, and no collapsing PaymentIntent, Payment, DriverEarning or Payout into one state.

Phase 0.8 documents the Driver authority boundary. Application progress, document extraction, authorised review, assessed competency, scoped service permission, selected-vehicle eligibility, restrictions and availability are separate truths. No staff mutation route is exposed until role, separation-of-duty, evidence and appeal rules exist.

Phase 0.9 documents Fleet supplier/terms/capability/insurance/agreement/handover/deposit/assignment boundaries. No staff mutation route can publish an offer, invent a discount, accept an agreement, apply a deposit deduction or assign a vehicle.

Phase 0.10 documents maintenance-plan, defect, restriction, recall, warranty-first repair, inspection, return-to-service, reliability, replacement and verified-perk boundaries. No staff mutation route can diagnose a defect, override a restriction, approve repair, return a vehicle to service, assign a replacement or publish an unverified benefit.
