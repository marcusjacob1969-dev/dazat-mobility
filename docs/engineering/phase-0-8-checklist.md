# Engineering Phase 0.8 Checklist

Checkpoint: Driver Onboarding, Competency, Compliance and Scoped Operating Permission Truth
Status: SOURCE IMPLEMENTED / STATIC AND PURE-DOMAIN GUARDS VERIFIED / EXTERNAL VERIFICATION DISABLED / DATABASE AND APP RUNTIME UNVERIFIED

## Source implementation

- [x] Resumable, versioned `DriverApplication` lifecycle with guarded transitions and append-only history.
- [x] Deferred database agreement between current application, transition history and DriverProfile projection.
- [x] Immutable authorised application decision required before `APPROVED` or `DECLINED` can commit.
- [x] Driver self-service can start/resume and recognise only already-authoritative contact verification.
- [x] No Driver/staff API can mint identity verification, document verification, competency, permission, restriction or approval truth.
- [x] Versioned compliance requirements separated by evidence kind, region and service.
- [x] Driver document integrity/provenance, supersession/expiry lifecycle and immutable authorised review.
- [x] OCR/extraction permanently constrained as non-authoritative.
- [x] Versioned training modules and repeatable attempts; attendance remains distinct from passed competency.
- [x] High-risk training requires assessed evidence meeting the module pass mark.
- [x] Scoped, validity-bounded service permissions; high-risk permission requires current assessed competency.
- [x] Narrow, vehicle-aware precautionary restrictions that do not imply guilt.
- [x] Derived operating eligibility with explicit blockers and separately evaluated availability.
- [x] Going online, candidate selection and offer acceptance revalidate current service permission and applicable restrictions.
- [x] Dispatch candidate evidence retains required service, DriverPermission and applicable restriction IDs.
- [x] Driver and Control Room surfaces present the approval/permission/availability boundary.
- [x] OpenAPI 0.0.8 documents only safe start/resume and read projections.

## Verification completed here

- [x] Phase 0.8 structural/security verifier passes.
- [x] Pure-domain tests cover application transitions, document authority, assessed competency, independent eligibility gates and scoped restriction behaviour.
- [x] Node TypeScript syntax checks pass for non-JSX Phase 0.8 modules.
- [x] OpenAPI YAML parses, JSON parses and repository whitespace/error checks pass.
- [x] Existing Phase 0.1–0.7 structural and source tests remain passing.

## Not yet executed or claimed

- [ ] Run migrations 0001–0008 against PostgreSQL 16 + PostGIS and exercise deferred authority/history constraints.
- [ ] Test concurrent application start/resume, approval, document review, training attempt and permission-window transactions.
- [ ] Compile Fastify, Expo and Vite workspaces after installing declared workspace dependencies.
- [ ] Select and approve identity/document verification providers, if any; implement signed callbacks and reconciliation only afterward.
- [ ] Define and approve jurisdiction-, region- and service-specific licensing, document, insurance, training and renewal rules.
- [ ] Implement authorised review roles, separation of duties, step-up, queues, appeals and decision/restriction workflows.
- [ ] Implement evidence upload, malware scanning, encryption/key handling, retention/deletion and restricted staff access.
- [ ] Implement competency expiry/renewal processing, permission issue/revoke workflows and eligibility recomputation workers.
- [ ] Conduct accessibility, privacy, safeguarding, licensing, insurance, employment-status, security and operational review.

This checkpoint is executable source evidence, not production readiness, a licensing determination, approval to onboard Drivers, an identity-verification certification or permission to operate a transport service.
