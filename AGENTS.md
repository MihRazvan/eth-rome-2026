# Current product: Cutout
Start with `docs/README.md`, `docs/cutout/ARCHITECTURE.md` and `docs/CONTINUATION.md`. Cutout is the user-approved pivot on `review-pass/product`; its active source is under `experiments/qualification/`. The EXIT contract below is preserved for earlier work, not an instruction to restore the old product. Use `docs/cutout/` for current submission/deployment guidance.

# EXIT
Read docs/handoff/PRODUCT.md and WORKFLOW.md. Canonical requirements P1–P7 are mandatory. Track actual results in docs/ACCEPTANCE.md; restart from docs/CONTINUATION.md. Never label fixtures, local-chain tests or unverified sponsor paths as live integrations.

Integrator owns root configuration, lockfile, shared quote schema, generated ABIs, deployment manifests and pushes. Writers use isolated worktrees from an explicit commit and only assigned paths. Preserve handoff documents and dependency licenses. No secrets in Git or logs. Normal coherent commits/pushes are authorized; no force pushes.
