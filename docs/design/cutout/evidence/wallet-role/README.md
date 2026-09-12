# Reviewer account mismatch recovery

Source5530ce8. The user's report follows the app's previous path: disconnected viewers see proof inputs; connection can return the already-authorized funding account, which replaced proof controls with client publication. This is account ownership, not an Arkiv publication failure. The role toggle never selects a wallet account.

Reviewer view now shows an explicit funding-account mismatch and full connected address, keeps the selected task, and provides Choose reviewer account plus manual reconnect guidance. The publication action stays in Client view. Account choice requests only `wallet_requestPermissions` with `eth_accounts`; it neither revokes permissions nor requests signing/spending access. Unsupported providers receive manual connected-site/account instructions; cancellation and pending requests are handled without automatic retry. Choosing the same client account cannot enable reviewer inputs.

26 wallet-network tests and pilot TypeScript/build pass. Actual Chromium with public funded task3/RPC reads and a synthetic wallet passed six cases: funding-account mismatch, Client/Reviewer presentation, canceled selection, unchanged account, actual account-change event/reconnect, and native proof file chooser. Zero signatures, transactions and page errors. The harness first encountered a connection timeout fetching the public config; a subsequent navigation assertion needed to reopen Activity after the role toggle. Corrected run is recorded in local.json. No public wallet selection or teammate acceptance is claimed by the synthetic provider.

Method verified against [MetaMask's official account-permission reference](https://docs.metamask.io/metamask-connect/evm/reference/json-rpc-api/wallet_requestPermissions/). Browser harness remains in ignored `.runtime/cutout-wallet-role/probe.mjs`. No private credential or holder material was read in these tests.

The same six checks passed at the actual production HTTPS origin at18:41UTC, with actual public API/RPC reads and no API/prover interception. The EIP1193 provider remained synthetic. No page errors, signatures or transactions. See production.json.
