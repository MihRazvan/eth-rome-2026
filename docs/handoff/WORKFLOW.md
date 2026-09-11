# EXIT — implementation operating contract

This workflow is a recommendation for the actual IDE runtime, with mandatory delivery and evidence outcomes. Use its available capabilities rather than pretending this prompt installs them. The user wants sustained autonomous implementation, original product design, sound contracts and regular pushes. There is no assumed implementation-time cap.

## 1. Establish the real starting point

Inspect the working directory, all applicable project instructions, current branch, uncommitted work, origin, upstream and existing architecture before editing. The expected remote is https://github.com/MihRazvan/eth-rome-2026; it was empty at research time. Do not reset or replace work that has since appeared.

Record a small capability inventory: host/model/version where exposed; native subagents and isolation; skills/MCP tools; browser interaction and screenshots; shell/network; compiler and package tooling; RPCs; Git authentication; testnet deployment and hosting access. Check credentials by status or capability, without printing secret values. Distinguish installed, reachable, verified and unavailable. Use installed help and current official documentation for version-sensitive features.

Choose a compatible stack after short executable probes of the hardest boundaries: claim acquisition, a signed atomic trade, Arkiv create/query/expiry, and client-encrypted Swarm round-trip. Run independent probes concurrently when useful. Solidity/Foundry, TypeScript, Viem/Wagmi and a suitable web framework are reasonable candidates, not mandatory version pins. Keep runtime/library APIs aligned and lock actual chosen versions. Do not choose architecture by maximizing sponsor logos or dependency count.

Create a concise native instruction entrypoint (AGENTS.md, CLAUDE.md or the host's actual equivalent), pointing to canonical project files rather than duplicating this entire bundle. Respect existing instructions. Do not overwrite global agent settings. Project-local skills and hooks are useful when inspected and scoped to a demonstrated need.

## 2. Own delivery with a durable execution loop

Maintain a compact, versioned record of:

- Product requirements and security invariants, with stable IDs.
- A dependency-aware acceptance ledger: requirement, owner, state, verification command/artifact, actual result and unresolved blocker.
- Consequential architecture/design decisions: alternatives, evidence, chosen boundary and consequences.
- Current continuation state: branch/SHA, last passing integrated check, running services and ports, active workers, unresolved failures and next action.

Keep the entrypoint short. Load source research and specialized instructions when needed. After a context reset, inspect Git and these records, reproduce the baseline and resume. Do not restart planning or silently discard an unfinished branch.

The execution loop is: select an acceptance outcome, inspect its dependencies, implement a coherent change, execute it, inspect evidence, obtain targeted critique, fix material findings, integrate, commit and update state. Mark completion from reproducible evidence. Do not lower a requirement or skip a check merely to make the ledger green. Record justified specification corrections explicitly.

Get one vertical slice working early: actual claim → actual maker quote → discovery → trade ticket → atomic purchase → new owner's collection. Expand into the full residual, privacy, real-source and demo requirements. This is dependency ordering, not permission to stop at a thin prototype. Continue until the agreed product is complete or a named external blocker prevents a specific part.

Use deterministic commands for setup, start/stop, deployment, scenarios and verification. Services should produce useful logs and explicit readiness signals. Retries need a diagnosis and a stopping condition; an endless autonomous loop is not a harness. After repeated identical failure, preserve the reproduction, change the approach and continue independent work.

## 3. Delegate with explicit ownership

Prefer native subagents for bounded work. Use a continuing agent team or reusable fan-out workflow only when several workstreams actually need it and the installed runtime supports it. Match concurrency to independent tasks, available resources and review capacity. The user authorizes delegation; there is no requirement to keep a fixed fleet busy.

The lead owns integration, shared interfaces, canonical deployment manifests and pushes. Useful roles are:

| Role | Bounded responsibility |
|---|---|
| Protocol engineer | Settlement, source-account/adapters and adversarial tests within agreed interfaces. |
| Design lead | Rendered concepts, selected visual system and frontend composition. |
| Integration engineer | Arkiv/Swarm/private-envelope transport after quote and privacy schemas are agreed. |
| Independent security reviewer | Challenge implemented authority, economic invariants and privacy boundaries; return concrete traces and severity. |
| Browser evaluator | Operate the actual app, critique design and reproduce failures without relying on the builder's success claim. |

These are responsibilities, not mandatory permanent agents. Split or combine according to actual independence. A frontend worker can use explicit typed fixtures while contracts develop; it must later verify the live path. A security reviewer should reason independently from the specification before reading the implementation's explanation.

Each delegation includes objective, base commit, owned paths, applicable invariants, dependencies/interfaces, prohibited shared changes, tools/permissions, expected artifact, verification and integration contact. Commit shared schemas/ABIs before parallel writers depend on them. An empty repository needs a real initial commit before ordinary worktrees can branch from it.

Use separate worktrees or isolated directories for writers. Explicitly choose the common base: some tools default to the remote default branch rather than the lead's current work. Do not assume uncommitted edits propagate. Assign one owner to lockfiles, root configuration, ABI generation and design tokens. Separate local chains, funded test accounts/nonces, ports and output directories where concurrency would collide. Worktrees do not isolate remote databases, cloud resources or Git metadata by themselves.

Workers return their actual patch/commit, commands/results and unresolved findings. The lead inspects changes, resolves integration conflicts and verifies the combined head. A passing worker branch is not evidence that the final application works. If native delegation is unavailable, use the same boundaries in sequential passes and state that independent-agent review was unavailable; never fabricate agent reports.

## 4. Make the frontend demonstrably original

Load a relevant design skill after inspecting its provenance and instructions. Consult current real product screens for specific lessons in trading, portfolio accounting and claim inspection. Record references and what is borrowed; do not copy another product's identity or assume a component kit creates art direction.

Compare two or three meaningfully different rendered application directions using identical realistic position and quote data. Explore enough of the market, trade ticket and position detail to judge differences in hierarchy and interaction, then develop the strongest direction across required screens and widths. Dealer desk, collection calendar and claim dossier are starting hypotheses, not prescribed themes. Keep concepts isolated from the production route until selected. If an existing design already establishes a coherent direction, evaluate and improve it rather than automatically recreating concepts.

Have an independent critic operate or inspect the rendered concepts against these questions:

- Can a newcomer explain the exchange within 15 seconds and find the next action?
- Are net payment, acquired rights, uncertainty and risk legible at the decision point?
- Can the buyer reconcile cash collected and residual exposure?
- Does the interface have a recognizable EXIT-specific structure or interaction?
- Does it remain coherent with long values, actual states and narrower screens?

Choose the strongest direction autonomously, record weaknesses and fix them. Establish one semantic token system, type hierarchy, numerical formatting, spacing/density, accessible primitives and restrained motion. One design lead controls the shared composition. “Dark terminal,” “editorial serif” and “no purple gradients” are insufficient art direction by themselves.

Implement the complete states in PRODUCT.md alongside the happy path. Browse before wallet connection; put useful markets in front of judges immediately. Provide explorer evidence without making users understand internal services to trade. Keep fixtures explicit and never serve them as a fallback for failed live reads.

Perform browser walkthroughs at desktop, compact laptop and mobile widths; inspect screenshots, keyboard/focus behavior, console/network errors and actual transaction recovery. Use an existing working browser tool, agent-browser or Playwright according to need. Playwright tests should use user-visible behavior and reliable state assertions, paired with independent chain checks. Screenshot baselines detect changes after visual acceptance; generating a baseline and passing against itself does not prove good design.

Iterate until identified material problems are resolved. Stop optional aesthetic churn when the chosen direction is coherent and the acceptance criteria pass. Do not claim browser verification if no browser was available; finish what can be verified and identify the missing evidence.

## 5. Verify finance and privacy independently

Build tests around P1–P7 and realistic adversarial sequences. Use multiple makers/owners, stateful actions, cash accounting independent of the implementation, malicious callbacks, quote cancellation/replay, signature changes, time transitions, partial collection and recovery. Verify that neither a maker nor an outsider can force settlement using standing token/operator approval without the seller accepting the exact quote. Demonstrate successful state transitions in fuzz/invariant campaigns; all-reverting handlers can pass vacuously. Preserve failing seeds/traces and minimal reproductions.

Use pinned-block forks for real sources; record implementation identity and distinguish local simulation, fork execution and public testnet transactions. Run appropriate static analysis and triage findings against the actual build. Add another analyzer/fuzzer only to answer a concrete remaining question. Strong tooling and AI review do not justify an “audited” claim.

For Private Offers, test seller, competing maker and outsider contexts against the actual stored bytes. Check tampering, wrong keys, substituted key certificates and cross-request replay. Reject new encryption to expired or revoked key bindings; test reload/key loss and the documented handling of previously encrypted offers. Key rotation/revocation does not erase earlier plaintext, stop someone retaining an old key from decrypting, or cancel an already-signed purchase quote. Quote cancellation and settlement deadlines are enforced separately. Inspect public entities, upload bodies, URLs and logs for private data. Verify that received plaintext has a valid bound maker signature. Losing offers remain unavailable to outsiders while submitted settlement terms are visibly public.

Test the complete product with independent local-chain fixtures, then exercise the real Fuji/Arkiv/Swarm path. Confirm chain ownership and balances after UI actions, not just an optimistic success toast. Verify adverse source outcomes and third-party service permissions. Distinguish skipped checks, blocked external tests and actual failures in CI and the ledger.

Before release, conduct a fresh-context specification-to-code review and a browser evaluation of the integrated head. Reproduce material findings; resolve critical/high issues affecting the required flow before describing the build as ready. Repeat checks to close concrete risks or required gates, rather than adding arbitrary test volume.

## 6. Commit and push as work becomes reviewable

The user authorizes regular commits and normal pushes of this project's work through your actual authorized access. Inspect repository policy and choose a suitable integration branch; preserve any existing default-branch workflow and teammate work. For an empty remote, bootstrap a real coherent initial commit, then establish the integration path. Only the integrator publishes the combined branch unless a worker's separate branch is explicitly assigned.

Commit one meaningful change with its relevant tests and documentation. Inspect the diff and staged files, run appropriate checks, exclude secrets/generated noise, and write an ordinary accurate message such as:

- Add claim-bound quote settlement
- Reject offers after partial cash withdrawal
- Encrypt maker offers for the seller
- Show residual proceeds in the buyer portfolio

Push after verified integration milestones rather than saving everything for a final dump. Verify that the remote branch points to the intended commit. Inspect CI for that exact SHA and distinguish pending, failed and passed runs. If integration changes the head, rerun affected checks before treating earlier evidence as current. Do not create cosmetic micro-commits on a timer. Use real timestamps, configured identity and required attribution; preserve licenses and pre-existing history. Do not force-push, erase teammate changes or rewrite history to simulate human authorship. If access fails, report the concrete failure and retain usable commits while continuing local work; do not claim they were pushed.

## 7. Autonomy and the final handoff

Resolve routine architectural, design and implementation decisions yourself. Use existing permitted resources and testnet credentials. Do not defeat host restrictions, install uninspected hooks, expose secrets, spend real funds or publish to unrelated destinations. Where a genuinely missing credential or user-only decision blocks work, explain exactly what is blocked after completing useful independent work. Do not repeatedly ask permission for the regular Git pushes already authorized here.

Prepare the app for deployment and use existing authorized deployment access where available. Record the actual URL, chain/network, addresses, source block and deployment commit; check the deployed app rather than assuming the local build represents it. If hosting/deployment access is unavailable, deliver the fully runnable build and concrete deployment commands with the blocker clearly stated.

The final report should identify what works, where to run/view it, commit and push status, verified evidence, unresolved limitations and the next required external action. Leave the repository understandable to a teammate and resumable by a fresh agent. Prepare the required demo and sponsor evidence from actual results. Never fill friction.md with invented SDK problems or mark a required conversation/submission complete because its documentation was drafted.
