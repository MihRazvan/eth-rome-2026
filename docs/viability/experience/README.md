# Read-only withdrawal check evidence

Observed 11 September 2026. Implementation starts from `43458634b3f148bfa288d99a29246541ddd2ac89` with the integrator's shared-source correction `2aaeb21` cherry-picked locally as `ad13e63`. This screen is a validation instrument, not an enabled mainnet trading venue.

## Checks completed

- TypeScript: `tsc --noEmit` passed.
- Production build: `vite build apps/web` passed with a temporary local `main.tsx` route mounting `ExitCheck` at `?check=1`. That temporary change was restored before committing. The integrator owns the actual lazy-route integration. Existing HPKE crypto-externalization and bundle-size warnings remained in this temporary combined bundle.
- Five deterministic browser tests passed in `tests/browser/exit-check.spec.ts`. Their Ethereum JSON-RPC is explicitly mocked. They verify pending facts, exact finalized amounts, direct-source collection links, claimed/closed/invalid states, implementation-drift blocking, late-request isolation, visible RPC failure without fallback, keyboard operation, 390px overflow, public-example ownership labeling and assumption clearing. The calculator produced no network requests during input and left URL and browser storage free of the entered assumption.
- Browser tests used an isolated Vite frontend at `127.0.0.1:5175` and a temporary Playwright config with no `webServer` hook. Command: `EXIT_BROWSER_BASE_URL=http://127.0.0.1:5175 playwright test --config /tmp/exit-check-playwright.config.cjs`. Config selected this worktree's `tests/browser/exit-check.spec.ts`, one worker and a 30-second timeout. No shared stack was started or reset.

## Separate actual public RPC observations

Chromium called `https://ethereum-rpc.publicnode.com` directly, without route mocks, a wallet, signatures or API8787. Reads used the current confirmed block, not an archive pin. No transaction was simulated or submitted.

- Lido #135118 was pending at block **25956637**, request face **1000 ETH**, owned by the public address shown in [browser-rpc-smoke.json](browser-rpc-smoke.json). Its four completed days of age are not a remaining ETA. No funded buyer is claimed.
- Lido #135117 was finalized at block **25956644**, source-reported amount **1000 ETH**. The UI says “Finalized — check collection” and explicitly discloses that collection execution has not been simulated.
- ether.fi #82510 had a deleted request record at block **25956644**. The UI shows “Request closed” and explains that deletion does not prove a payout amount or recipient. No purchase calculator is shown.

The latter observations are recorded in [browser-current-states.json](browser-current-states.json). Public state can change after these blocks. Source finalization is not an execution guarantee, and source-address matching is not an audit or acquisition-eligibility guarantee. The current ether.fi implementation's legacy stored fee is not displayed as an active charge or automatically subtracted.

Screenshots: [empty desktop](check-empty-desktop.png), [pending desktop](check-public-example-desktop.png), [pending 390px](check-public-example-mobile.png), [Lido finalized](check-lido-finalized-current.png), [ether.fi closed](check-etherfi-closed-current.png). Actual browser smoke recorded no page errors and no horizontal overflow at 390px. Independent integrator review found the desktop receipt coherent and state/assumption boundaries clear.

The ceiling calculator starts with every input blank. Explicit eventual recovery, remaining days, annual capital hurdle, haircut, buyer upfront/collection costs, reserve, protocol-fee basis points and seller transaction costs are required before a result appears. ETH/WETH are equivalent economic units here, with no USD conversion. The shared bigint model returns payment before seller gas and separately displays effective proceeds. No seller floor, funded bid, accepted price, ETA or market yield is invented.
