# 001 — execution, signatures, and source boundary

Chosen 2026-09-11 after runtime and official documentation probes. Node 24 supports Vite 8; lock actual resolved packages. React/Vite provides an independently hostable browser client; viem supplies chain reads, simulation, typed signing and receipts. Foundry builds/tests contracts. Avoid framework-coupled settlement logic.

EXIT Market tracks persistent economic ownership; controlled source requests belong to the market. No transferable receipt/operator approvals that could substitute for exact seller consent. PurchaseQuote EIP-712 domain binds chain and market; struct explicitly binds source/version, residual epoch/depletion, seller net, maker gross and beneficiary. Only seller calls acceptance. Maker signatures authorize that maker's capital alone. Source release becomes internal credited cash without invalidating a quote; withdrawal/depletion does invalidate a quote. Owners persist for later recoveries.

Shared canonical schema: packages/shared/quote.ts. Protocol source admission is explicit; test vault is not BENQI. BENQI requires separate bounded caller-owned accounts, validated on a pinned fork before integration claims.

References checked: https://vite.dev/guide/ ; https://docs.openzeppelin.com/contracts/5.x/api/utils ; https://eips.ethereum.org/EIPS/eip-712 . Package registry probes resolve versions in package-lock.json. No assertion of formal audit.
