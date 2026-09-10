# Engineering Phase 0.81 — Reproducible Non-Root API Container

DAZAT's API now has a multi-stage Node 24 container build rooted at the monorepo. The build stage installs the locked dependency graph and compiles Domain, Contracts, Design System and API workspaces. The runtime stage contains only production dependencies and compiled runtime packages.

The process runs as the image's unprivileged `node` user. Its health check calls the dependency-independent `/health/live` endpoint, while orchestration must use `/health/ready` before routing traffic. Required secrets and service URLs remain runtime inputs and are not embedded in the image.

CI builds the image for pull requests and `main`. This checkpoint deliberately does not publish an image, create cloud resources, supply secrets or enable any provider or operational mutation.
