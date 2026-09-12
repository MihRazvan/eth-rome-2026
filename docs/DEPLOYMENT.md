> **Historical EXIT document.** For the current Cutout application, use the [Cutout deployment guide](cutout/DEPLOYMENT.md).

# Deployment and access boundaries

## Local

`npm ci && npm run start:local` owns dedicated ports 8547/8787/5173. It explicitly overrides inherited RPC/manifest/data-directory variables with isolated local values. It never deletes Fuji data. The standard Anvil accounts and repeatable testUSDC faucet are intentionally valueless. Restart resets local chain and storage; saved old browser encryption keys are not automatically reactivated.

## Fuji + sponsor services

No funded Fuji/Arkiv account or Swarm postage was supplied to this session. No live publication or Fuji deployment has run. Providing a public RPC alone cannot fund a transaction.

1. Fund four distinct testnet-only accounts with Fuji AVAX, and an Arkiv Tiramisu account with the event network's gas token. Use current [Avalanche testnet faucet](https://core.app/tools/testnet-faucet/) / event sponsor support. Do not fund these demo contracts with real-value tokens.
2. Configure `.env.example` values in a local secret file. The deployment script checks chain identity, distinct accounts and each native balance before deploying. Source uses newly deployed TestUSDC, never canonical USDC/BENQI.
3. `node --env-file=.env --import tsx scripts/deploy.ts --fuji` writes `deployments/fuji.json`. Inspect actual addresses/receipts. All deployment/origination receipts must succeed. Never commit `.env`.
4. Start persistent Node API: `node --env-file=.env --import tsx packages/runtime/server.ts`. Set `EXIT_DEPLOYMENT=deployments/fuji.json`, `EXIT_DATA_DIR` to a persistent private runtime directory, and reverse-proxy the API over HTTPS at the web app's `/api` path. Runtime defaults to loopback8787. Browser RPC is deliberately public; credential-bearing backend RPC stays in environment and SDK errors are sanitized.
5. Configure funded Swarm postage/upload endpoint and independently accessible retrieval endpoint. Client encrypts before upload. Ordinary64-character content references only. Arkiv is the Fuji offer-discovery path; absence/failure does not enable local storage.
6. `node --env-file=.env --import tsx scripts/scenario.ts` waits for actual Fuji installment time and records public transaction hashes. No Anvil RPC methods execute for Fuji.
7. Run `scripts/probe-sponsors.ts` with a real offer record and `ARKIV_EXPIRY_RECORD_PATH` to prove identical fresh queries before/after native entity expiry. Set `SWARM_VERIFIER_URL` to an independent retrieval gateway and run `npm run verify:record -- record.json CLAIM_ID`.

The runtime caps anonymous demo publication at100 records/hour and one generated-request call per claim/mode per30seconds. This bounds expense; it does not promise availability against someone exhausting the shared quota. Team maker wallets independently approve their own funds. Simulated executability does not reserve capital. For production use beyond the test source, authenticated/rate-isolated publication, durable multi-instance coordination and separate source admission are required.

## Web hosting

Vite production build: `npm run build`; output `apps/web/dist`. Vercel static hosting credentials are available in this session. Hosted design preview remains explicitly separate from local-chain and Fuji evidence. A static deployment without the persistent API and funded manifest will show deployment unavailable, with an explicit preview link. It cannot fulfill the self-service public Fuji acceptance requirement until those dependencies exist.

## Keys and certificates

Encryption private keys stay non-extractable in browser IndexedDB. Public signed key certificates are retained in the API data directory and verified against the onchain registry. Back up that public metadata directory for availability; its loss does not transfer claim rights. Browser key loss makes old bids unreadable. Rotation/revocation does not erase copied data, revoke old key possession, or cancel a purchase signature. Cancel quotes separately onchain.
