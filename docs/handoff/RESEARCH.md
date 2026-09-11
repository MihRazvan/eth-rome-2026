# EXIT — research behind the implementation handoff

**Research snapshot: 11 September 2026.** This is a selective reference for architecture and execution decisions, not another startup instruction file to load into every worker. Product decisions are in PRODUCT.md; the operating procedure is in WORKFLOW.md. Research does not establish deployment, adoption, an audit or a likely prize outcome.

## What the research changed

The strongest handoff fixes the financial contract and observable quality while letting the implementation agent choose the means. Its instructions must also match the installed runtime. “Use a fleet of agents and make it beautiful” supplies neither isolation nor an evaluation method. The resulting recommendation is one accountable integrator, scoped parallel work, a durable acceptance record, real executable evidence, and an independently critiqued frontend.

Repository inspection through the connected GitHub integration found a public repository with default branch main, no commits and no files. The connector had read access only; this research did not initialize or modify the repository. The IDE may have different authorized access and must inspect its current checkout. [Target repository](https://github.com/MihRazvan/eth-rome-2026)

### 1. Current agent capabilities: inspect before configuring

| Area | Verified primary-source finding | Implication for EXIT |
|---|---|---|
| Codex subagents | Current documentation describes native/custom subagents and per-agent configuration. | Use the host's actual agent interfaces and installed schema; do not paste configuration remembered from an older release. [Reference](https://learn.chatgpt.com/docs/agent-configuration/subagents) |
| Codex skills and instructions | Skills load focused procedures; AGENTS.md discovery is hierarchical. | Keep a short canonical project entrypoint and selectively load relevant skills. Avoid conflicting copies of the entire brief. [Skills](https://learn.chatgpt.com/docs/build-skills), [AGENTS.md](https://learn.chatgpt.com/docs/agent-configuration/agents-md) |
| Claude Code subagents | Current docs allow nested subagents and configurable isolation; older blanket advice that subagents cannot delegate is stale. | Check the installed version and expose only relevant tools to each role. Capacity limits are not recommended fleet sizes. [Subagents](https://code.claude.com/docs/en/sub-agents) |
| Claude agent teams | Teams remain experimental; in-process teammates are not restored by session resume. | Use them selectively and persist task ownership/results outside session memory. [Teams](https://code.claude.com/docs/en/agent-teams) |
| Claude worktrees | The default base is the remote default branch; the documented head option carries committed current work. | Specify the intended base before spawning writers. Worktrees do not automatically contain a parent's uncommitted edits. [Worktrees](https://code.claude.com/docs/en/worktrees) |
| Dynamic workflows | Current Claude docs describe reusable JavaScript orchestration for larger task fan-outs. | Potentially useful for repeated adapter review; unnecessary overhead for a few ordinary tasks. Confirm account/runtime availability first. [Workflows](https://code.claude.com/docs/en/workflows) |
| Skills and hooks | Claude skills can affect tool permissions; hooks execute lifecycle automation. | Inspect third-party instructions/scripts and validate project-local hooks. Do not use a hook loop as a substitute for correctness or permission controls. [Skills](https://code.claude.com/docs/en/skills), [Hooks](https://code.claude.com/docs/en/hooks-guide) |

The exact model, context limits and IDE are not known. This bundle therefore prescribes capability discovery and outcomes rather than a universal agent configuration, model roster or mandatory additional agent framework. More orchestration is useful only when it improves independent work and integration.

### 2. Harnesses: durable evidence beats longer instructions

OpenAI's February 11, 2026 harness article describes a short AGENTS.md pointing to structured repository knowledge, agent-readable application behavior, and mechanically enforced boundaries. That supports a compact entrypoint and inspectable local evidence. Its internal throughput results do not predict EXIT delivery or justify relaxed financial-contract checks. [Harness engineering](https://openai.com/index/harness-engineering/)

Anthropic's November 26, 2025 long-running-agent experiment uses persistent feature/progress records and incremental execution, and identifies premature completion claims as a recurring failure. EXIT should carry executable acceptance evidence between sessions rather than trusting a chat summary that the feature works. [Effective harnesses](https://www.anthropic.com/engineering/effective-harnesses-for-long-running-agents)

The March 24, 2026 application-harness article is particularly relevant to the frontend concern: a separate evaluator operates the application through Playwright and critiques originality, design, craft and functionality. It also observes that self-evaluation is generous and later iterations can add unwanted complexity. Our recommendation is independent critique with concrete stopping criteria, rather than a fixed number of polishing loops. [Application harness research](https://www.anthropic.com/engineering/harness-design-long-running-apps)

### 3. Skills and tools worth evaluating

These are candidates to inspect when their task arises, not an instruction to install an entire marketplace. Record the selected revision, applicable license and any fetched remote guidance. Prefer a working host-native capability when equivalent.

| Candidate | Useful job | Inspected reference / caution |
|---|---|---|
| Anthropic frontend-design | Subject-specific art direction, deliberate hierarchy and critique of generic defaults. | [Pinned skill](https://github.com/anthropics/skills/blob/34040c9c568585f6929bedeaad110ad08f079624/skills/frontend-design/SKILL.md). The September 3 update also identifies dark/acid-green and cream/serif styles as potential defaults; swapping palettes alone is insufficient. The skill's own license is Apache-2.0. |
| Vercel web-design-guidelines | Review accessibility, interaction and interface craft after a direction exists. | [Pinned loader](https://github.com/vercel-labs/agent-skills/blob/063bee94c3f4df8453406c830b0a7df0f2860278/skills/web-design-guidelines/SKILL.md). It fetches mutable upstream guidance; record that revision too. It does not supply original art direction. |
| Vercel React best practices | Target relevant rendering, data and performance issues if React is selected. | [Pinned skill](https://github.com/vercel-labs/agent-skills/blob/063bee94c3f4df8453406c830b0a7df0f2860278/skills/react-best-practices/SKILL.md). Load the rules needed for the actual framework, not the entire catalog into every agent. |
| agent-browser | Autonomous observation, interaction, screenshots and isolated browser sessions. | [Inspected repository](https://github.com/vercel-labs/agent-browser/tree/8c15ff9f71ae60c7e99e66afe1e2d4b9bf414fe2), version 0.37.1, Apache-2.0. Current implementation uses Rust/CDP; its discovery skill obtains runtime-aligned core instructions. Do not assume it is Playwright. |
| Playwright | Repeatable user journeys, accessibility checks and regression evidence. | [Best practices](https://playwright.dev/docs/best-practices), [accessibility](https://playwright.dev/docs/accessibility-testing), [visual comparisons](https://playwright.dev/docs/test-snapshots). Test visible behavior and inspect initial screenshots before adopting baselines. |
| Figma MCP | Retrieve a real design system/context or create an editable design workflow when useful. | [Official tools](https://developers.figma.com/docs/figma-mcp-server/tools-and-prompts/). Optional without an existing design; a blank canvas does not solve art direction. |
| Trail of Bits skills | Contract boundary analysis, entry-point inventory, property testing and independent specification review. | [Inspected toolkit](https://github.com/trailofbits/skills/tree/321ccfe628eca0d314b0ee4eaffcdd8a05639aaf), revision dated September 9. Select building-secure-contracts, entry-point-analyzer, property-based-testing, spec-to-code-compliance or differential-review according to the task. Inspect dependencies and scope first. |
| Arkiv official skills | SDK/data-model guidance and structured integration-friction reports. | [Official skill documentation](https://docs.arkiv.network/start-here/agent-skill/), [repository](https://github.com/Arkiv-Network/skills). Inspect arkiv-best-practices for compatibility with the event SDK. arkiv-feedback can submit external issues; use its drafting guidance for friction.md and obtain separate authorization before posting to the sponsor's repository. |
| Swarm agent tools | Source-specific setup or operations when the actual deployment needs them. | [Official documentation](https://docs.ethswarm.org/docs/develop/tools-and-features/ai-agent-skills/). Many examples assume local Bee infrastructure; do not add a node solely to use a skill. |

Our rendered-concept procedure is a proposed application of these findings: compare substantially different market organizations using identical claim data, have another agent critique the resulting screens and tasks, then select one coherent design. It is not a documented guarantee of aesthetic quality. Accessible primitives should support the final composition rather than dictate it.

Useful product references include Pendle's market/trade hierarchy and Unstake.it's direct exchange ticket. Borrow decision clarity, not branding. EXIT must show uncertain collection assumptions where appropriate rather than copying fixed-maturity language. [Pendle swap guide](https://docs.pendle.finance/pendle-v2/AppGuide/Swap), [Unstake.it](https://www.unstake.it/)

### 4. Contract verification and confidential offers

Foundry supports stateful invariant campaigns and pinned forks. For EXIT, handlers should exercise several owners/makers, successful lifecycle actions, malicious callbacks and time-sensitive recovery. Track exercised successful transitions to detect vacuous all-revert runs. Slither adds static findings; Echidna is an optional independent campaign if a specific residual risk warrants it. None is an audit certificate. [Foundry invariants](https://getfoundry.sh/forge/invariant-testing), [fork testing](https://getfoundry.sh/forge/tests/fork-testing), [Slither](https://github.com/crytic/slither), [Echidna](https://github.com/crytic/echidna)

EIP-712 explicitly leaves replay protection to the application. ERC-1271 authorization can depend on current contract state. The settlement design must therefore enforce one-time orders and relevant execution-time authorization rather than treating an old successful signature check as permanent. [EIP-712](https://eips.ethereum.org/EIPS/eip-712), [ERC-1271](https://eips.ethereum.org/EIPS/eip-1271)

HPKE RFC 9180 is a useful established construction for recipient encryption; application identity, replay and metadata policy still need design. The inspected hpke-js revision explicitly says it has not been formally audited, and its secp256k1 extension is experimental. Evaluate a supported standard suite rather than inventing wallet-key encryption. Libsodium sealed boxes are another option, but they do not authenticate the sender; verify the enclosed maker signature. [RFC 9180](https://www.rfc-editor.org/rfc/rfc9180.html), [hpke-js inspected revision](https://github.com/dajiaji/hpke-js/tree/833f78d7abd37ba21764ed37ec228c3af477cbd6), [sealed boxes](https://libsodium.gitbook.io/doc/public-key_cryptography/sealed_boxes)

Swarm's native encrypted reference includes a decryption key, and its documentation warns against sending full encrypted references to public gateways. This materially changes the privacy design: encrypt application data locally before upload and publish only its ciphertext reference. ACT also preserves access to historical versions previously granted, so expiry/revocation cannot promise erasure of a recipient's old copies. [Swarm encryption](https://docs.ethswarm.org/docs/develop/tools-and-features/store-with-encryption/), [ACT](https://docs.ethswarm.org/docs/concepts/access-control/)

### 5. Prior art and source implementation leads

These pins preserve what the earlier research inspected. They are leads for the coding agent to verify against current source and deployed bytecode; they are not universal dependency recommendations. Preserve licenses/notices if reusing code. Published deployment claims and hackathon recognition do not establish contract correctness.

| Reference | Reusable lesson and boundary | Inspected source |
|---|---|---|
| Intentional | Atomic factoring, native withdrawal claims and optional productive funding. Its inspected kernel has one immutable factor signer; do not assume that authorization generalizes to pooled makers. Winner status and current deployed bytecode were not independently verified. | [Repository at 63a3bd28](https://github.com/zkoranges/intentional/tree/63a3bd281fae21c99eba29bb3b4a3630d24b56d1) |
| TenderSwap | Origination, inventory, purchase and collection. An earlier static review found reward behavior differing from the prose description; specify EXIT pricing independently. | [Repository at 298fb55e](https://github.com/Tenderize/tenderswap/tree/298fb55e170fa95856acf9bf0f67af471d33c7aa) |
| lpETH | Adapter-mediated claim custody and resale. Treat mutable adapter/delegatecall authority as a review target; do not transplant its accounting without verification. | [Repository at 0d2cf93e](https://github.com/Tenderize/lpeth/tree/0d2cf93e62a366963313deda6c894542fd607426) |
| BENQI sAVAX | Caller-owned unlock lifecycle supports origination through a bounded account, subject to matching the current implementation. Mainnet sAVAX lead: 0x2b2C81e08f1Af8835a78Bb2A90AE924ACE0eA4bE. | [Published StakedAvax.sol](https://github.com/Benqi-fi/BENQI-Smart-Contracts/blob/e0cfd244726719dfe027c9740878d64d1cad98f2/sAVAX/StakedAvax.sol) |
| Lido withdrawal queue | Native transferable withdrawal NFT and owner-based collection; an Ethereum reference, not a Fuji deployment. | [Official contract documentation](https://docs.lido.fi/contracts/withdrawal-queue-erc721/) |
| Async-vault standards | Pending, claimable and transferable rights are distinct. Standards do not replace implementation admission. | [ERC-7540](https://eips.ethereum.org/EIPS/eip-7540), [ERC-8161](https://eips.ethereum.org/EIPS/eip-8161) |
| Aave Fuji | Optional maker capital strategy. A registry address and aToken balance do not establish available liquidity or successful withdrawal. | [Address book at a359b8c8](https://github.com/aave-dao/aave-address-book/blob/a359b8c8690446a1a430f5f703541f6707ac570d/src/AaveV3Fuji.sol) |

The source-integration plan is a recommendation, not permission to claim support before a full lifecycle passes. BENQI's published source is older than this research and needs implementation matching. The controlled Fuji source remains clearly labeled even if the fork adapter works perfectly.

### 6. Bounty sources and current uncertainties

The supplied manual and sponsor brief establish the requirements in PRODUCT.md. Use the official live pages for changes and final form links, preserving the observed version. [Manual repository snapshot](https://github.com/urbeETH/ethrome-2026-hacker-manual/blob/494d2c401de9efe4c8e97e5070c52d1786b94731/HACKER-MANUAL.md), [prizes](https://www.ethrome.org/hackermanual/prizes.html), [rules](https://www.ethrome.org/hackermanual/rules.html), [submissions](https://www.ethrome.org/hackermanual/submissions.html)

Arkiv's current querying/mutation/live-event references should be tested against the network and version supplied at the event. Public private-offer metadata needs a different schema from plaintext public bids. Entity lifetime and quote validity are separate mechanisms. [Querying](https://docs.arkiv.network/typescript-sdk/querying-data/), [mutations](https://docs.arkiv.network/typescript-sdk/mutating-data/), [live events](https://docs.arkiv.network/typescript-sdk/live-events/)

Swarm ID is a possible gateway/identity route rather than a reason to operate Bee unnecessarily. Verify upload capability, postage and actual browser support; quote-encryption keys remain separate from that identity. [Swarm ID repository](https://github.com/snaha/swarm-id), [getting started](https://swarm.snaha.net/docs/getting-started)

Remaining execution questions are concrete: installed IDE capabilities; current repository state/write access; event SDK and endpoints; upload funding; current source implementation; available test-token capital; cryptographic package choice; and deployment access. None requires selecting a new product or asking the user to choose every implementation detail. The agent should resolve them with probes, document limitations and continue the authorized work.

## How this package should be used

Read START-HERE.md to launch. PRODUCT.md defines outcomes and limits. WORKFLOW.md establishes execution, design critique, verification and Git behavior. Consult this file at a relevant decision or when adopting a tool. Preserve the launch brief as context; let the working repository's actual acceptance ledger, decisions and evidence become the source of implementation status.
