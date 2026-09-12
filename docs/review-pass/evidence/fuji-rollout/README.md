# Public Fuji rollout — September12,2026

Contracts deployed from clean `a9d0181640148523b2b9ecbb160fbab76f2455a0`. `deployment.json` contains the public manifest, intended/observed code hashes and finalized receipts; its local-only setup directory was removed. No private keys, registry contents or holder credentials are included.

| Contract | Fuji address | Source verification |
|---|---|---|
| Qualification escrow | `0xb431e570d506168711cc1f9f91e325b3114c62af` | [Sourcify exact runtime match](https://repo.sourcify.dev/43113/0xb431e570d506168711cc1f9f91e325b3114c62af) |
| Qualification verifier | `0x9c1293e7e499d56fdc52186e7624dcfa04dfcbd1` | [Sourcify exact runtime match](https://repo.sourcify.dev/43113/0x9c1293e7e499d56fdc52186e7624dcfa04dfcbd1) |
| Wallet encryption-key registry | `0x181db4e48a0e76fdc50101085ac3b831464792c1` | [Sourcify exact runtime match](https://repo.sourcify.dev/43113/0x181db4e48a0e76fdc50101085ac3b831464792c1) |

The payment token is canonical Fuji testUSDC. The project deployer controls both the issuer root and the trusted test arbitrator. This is a disclosed team-administered experiment, not independent arbitration or external accreditation. Contracts are directly callable; the hosted funded workspace remains disabled because the whole public snapshot is not yet published on Swarm.

Sourcify verification of the verifier/keys succeeded through Foundry. The first escrow submission omitted external OpenZeppelin sources and failed compilation. Resubmission through the official v2 API supplied each exact metadata source after independently checking its keccak256; exact runtime match succeeded. `source-verification.json` records all three lookups. Sourcify reported its Etherscan forwarding quota exhausted; no Etherscan verification is claimed. [Official API reference](https://docs.sourcify.dev/docs/api/).

`gas-funding.json` records two real finalized0.05testAVAX transfers to separate agent-controlled rehearsal wallets. `rehearsal-balances.json` records their actual zero testUSDC/GLM balances afterward. User participant wallets were not modified. Required client funding is10testUSDC on Fuji and0.03testGLM on Arkiv Tiramisu to `0x7259c94d93d83E539B57ba7A360cB06Bd9b53a60`. The reviewer does not need starting stablecoins.

The hosted snapshot publisher is live at https://review-pass-ethrome-2026.vercel.app, deployment `dpl_AmeSTCQExKT7jF6T6fafJiRvYf5f` (immutable https://review-pass-ethrome-2026-85jb79pyg-mihrazvans-projects.vercel.app). Its explicit publication button reads only the two build-reviewed public files, verifies original byte hashes/length/root, uploads the whole snapshot using the participant's Swarm ID and independently retrieves it. Public connection-test upload previously succeeded; no actual issuer-snapshot upload is claimed here. Fresh unauthenticated Chromium checks and screenshots are in this directory; no fixture responses or upload impersonation were used.

Validation:18contract tests passed,19storage/read-API tests passed,6publisher tests passed,1optional network test skipped; TypeScript and isolated public build passed. An actual wrong connection-note reference was rejected by publication finalization, and the active build refused the missing snapshot reference, preserving the existing deployment manifest. Qualification CI at sourcea9d0181 passed(run34698195160). [Separate public browser-proof probe](../fuji-crypto-probe/README.md) proves cryptographic compatibility via eth_call only.

Next: participant clicks **Publish demo issuer snapshot** in their connected Swarm ID session and supplies its reference; operator runs `publish-snapshot.mjs`, then validated active build/deploy. Fund the controlled client above, then complete actual scope funding, qualification acceptance, encrypted delivery, client approval/payment and Arkiv native-expiry/WSS evidence. No public funded lifecycle is represented as complete by this directory.
