# Engineering Phase 0.86 — API CycloneDX SBOM Evidence

Every pull request and `main` build now generates a CycloneDX 1.5 software bill of materials from the locked production-only API dependency graph. The validator requires package identity, a UUID serial number, generation time, dependency relationships and the Fastify, PostgreSQL and Zod runtime components. Compiler-only TypeScript and tsx packages must be absent.

The JSON evidence is retained for fourteen days under a commit-specific artifact name. The upload action is pinned by commit SHA. The SBOM contains package metadata, not runtime secrets, user data or provider credentials.

An SBOM improves dependency traceability; it does not itself prove that packages are vulnerability-free or approved for production.
