# EXIT
Read docs/handoff/PRODUCT.md and WORKFLOW.md. Canonical requirements P1–P7 are mandatory. Track actual results in docs/ACCEPTANCE.md; restart from docs/CONTINUATION.md. Never label fixtures, local-chain tests or unverified sponsor paths as live integrations.

Integrator owns root configuration, lockfile, shared quote schema, generated ABIs, deployment manifests and pushes. Writers use isolated worktrees from an explicit commit and only assigned paths. Preserve handoff documents and dependency licenses. No secrets in Git or logs. Normal coherent commits/pushes are authorized; no force pushes.
