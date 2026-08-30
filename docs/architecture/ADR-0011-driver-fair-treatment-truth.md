# ADR-0011: Driver fair-treatment truth without an opaque score

- Status: Accepted for Engineering Phase 0.11 source foundation
- Date: 2026-08-30
- Blueprint source: §54.4 and detailed Driver/Safety/Dispatch/Finance constraints

## Decision

DAZAT keeps rating feedback, Safety, compliance, reliability, customer feedback, cancellations, training and security as separate evidence dimensions. It does not calculate or consume an opaque aggregate Driver Score.

Rating feedback is append-only feedback and cannot itself become a conduct finding, restriction or Dispatch-ranking input. A complaint moves through distinct allegation, Driver-response opportunity, assessment, finding and action records. SafetyEvent remains the canonical owner of restricted Safety facts; DriverComplaint and RiderConductCase reference that truth instead of copying it into general operations.

Every terminal Driver offer receives an exact outcome attribution: accepted, declined, timed out, technical failure, withdrawn, Driver became ineligible or assigned elsewhere. Ordinary declines and timeouts create neither misconduct nor an acceptance-rate or Dispatch-priority penalty. Reliability assessment begins only after a Driver accepted a commitment and must consider vehicle, system, provider, traffic and external causes.

Precautionary Driver restrictions use the narrowest safe scope, carry a review route and are not guilt. High-impact complaint findings, restrictions, offboarding decisions and incentive qualifications retain an independent appeal route; resolution never overwrites the original decision history.

RiderConductCase is Safety-owned. An assigned Driver may report violence, harassment, discrimination, fraud, dangerous behaviour or contact abuse. An unsafe Journey termination atomically persists the canonical Safety event and RiderConductCase, interrupts the leg, cancels the assignment, opens passenger continuity, moves the Driver to break and protects the Driver from an automatic rating or fault finding.

Driver incentives are immutable, versioned Finance-approved terms. They remain separate from base earnings and cannot use acceptance coercion, unsafe fatigue pressure or a secret Dispatch-priority boost. Offboarding preserves earnings, disputes, vehicle-return obligations and historical Safety and Finance records.

## Consequences

- Control Room cannot treat a rating or allegation as a finding.
- Dispatch does not read rating or complaint counts for candidate ranking.
- Ordinary offer refusal remains genuinely non-punitive and auditable.
- Safety can protect passengers immediately without declaring the Driver guilty.
- Driver self-service exposes current fair-treatment dimensions, protected rider-conduct reporting, safe termination, incentives and appeal submission.
- Authorised reviewer mutation, evidence upload/scanning and separation-of-duty administration remain later operational work; no general staff database editor is exposed.

## Production boundary

This phase creates source, schema, contracts, routes and structural/domain tests. It does not claim production migration execution, operational role configuration, evidence-storage integration, notification delivery or regulatory/legal approval.
