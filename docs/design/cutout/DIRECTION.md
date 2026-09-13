# Cutout — product and visual direction

The user renamed the active Review Pass product **Cutout** on 12 September 2026 and supplied six HTML references, preserved in `references/`. These are design references, not evidence of deployed functionality. Historical EXIT/Review Pass research, contracts, protocol identifiers, device-key namespaces, and receipts retain their original names and provenance.

## The product, in ordinary language

Post a technical review task and fund its reward. A reviewer proves that their test qualification is valid without publishing a reusable credential identifier. They deliver a report encrypted for themselves and the client. The client opens it and approves payment, or disputes delivery under the agreed deadlines.

Qualification establishes eligibility, not report quality. Wallets, task metadata and payments remain public. Wallet reuse links tasks. This version uses a test issuer and test assets.

## Art direction

Paper as the workspace, ink as structure, orange as an action. Use Archivo for expressive, tightly set display type and readable controls; IBM Plex Mono for receipts and compact technical details. Exact reference colors: ink `#17150F`, board `#E8D9B8`, backing `#E0D3B2`, cut orange `#F04E23`. Adjust small text for contrast. Self-host fonts and preserve their licenses.

The recognizable motif is the person-shaped hole: qualification remains while the reusable identifier is cut away. Use crop marks, perforated boundaries, an asymmetric paper task form, a draft receipt, and a sealed report. No arbitrary stock photographs or decorative dashboard metrics.

The supplied shell is the selected direction. The brand sheet supplies tokens; task/reviewer/report references supply interaction patterns. The collective reference is future product exploration: multiple collectives, skill levels, fictional guilds, ENS names and roster counts are not current features. A drag gesture never manufactures a successful proof or decryption.

## Customer journeys

- **Tasks:** write a public brief and preview the reward, or browse the actual filtered opportunity board as a reviewer. Setup comes when taking a funded action.
- **Activity:** follow actual assignments, open delivered reports and inspect transaction receipts.
- **Your workspace:** payment wallet, private report keys, storage connection, qualification help and test deployment details. Customers do not paste Swarm addresses, batch IDs or signing keys.
- **Try the demo:** an explicitly labelled browser-only walkthrough available without sign-in. Uses actual browser encryption/decryption; task funding, qualification verification and payment are simulations. It is not sponsor integration evidence and does not replace the live Fuji workspace.

## Implementation boundaries

Preserve the existing onchain setup and browser key namespaces. Brand changes must not rotate device keys or strand earlier reports. The active gateway-funded adapter requires no customer storage account. Swarm ID remains optional; its account controls belong inside the workspace if that adapter is selected. The older account/postage prerequisite was superseded by verified public gateway uploads and the paid task #4 lifecycle.

In the live report flow, the prominent cut/open action performs actual retrieval, commitment verification and recipient decryption. Approval is enabled only after that report was opened in the current rendered session; the action rechecks its current committed digest. This is a client experience safeguard, not a new escrow restriction.

## Verification

The reviewer board now uses paper task cards with a reward stub, acceptance cutoff and presentation sorting. After decryption, the sealed-report interaction becomes a compact verified state. [Selective UX decisions](../../cutout/UX-PRIORITIES.md).

Record current rendered desktop/mobile evidence, keyboard walkthrough, real browser AES-GCM roundtrip, sponsor/network failure behavior and exact test results in `docs/ACCEPTANCE.md`. Earlier public cryptographic verification and funded wallet receipts remain historical evidence. A newly styled page does not prove a completed public funded lifecycle.
