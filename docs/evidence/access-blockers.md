# Official testnet/storage access probes — September 11, 2026

Bounded read-only inspection at approximately 17:09–17:12 UTC. Used fresh Playwright browser context `exit-access`, official pages/docs, public frontend source and one anonymous read-only faucet-info request. No account/private key was generated. No existing wallet or keystore was accessed. No CAPTCHA was solved or bypassed, no login completed, no faucet claim/gift redemption submitted, and no real funds spent.

## Arkiv Tiramisu

- [Official Hub faucet](https://hub.arkiv.network/faucet) loaded HTTP 200. Its rendered UI requires connecting a wallet and signing in to claim test GLM.
- Anonymous `GET https://hub.arkiv.network/api/faucet` returned **401** with `{"error":"Unauthorized"}`.
- The page's publicly served JavaScript constructs `POST /api/faucet` with `{recipient, captchaToken}`, shows CAPTCHA verification as a claim phase, and includes a wallet SIWE sign-in gate. No anonymous authorized claim API was identified. The production page version was `359854c`.
- [Official Tiramisu network documentation](https://docs.arkiv.network/networks/tiramisu/) and [Hub](https://hub.arkiv.network/) remain the supported route. Existing EXIT live-read probe proves network access, not faucet authority or write funds.

**Precise remaining action:** connect a project-only wallet in the official Hub, sign its login message, complete the human CAPTCHA and claim test GLM; or arrange a legitimate transfer of existing test GLM to the project's public deployment address. Respect the displayed claim cooldown. Generating another random address alone does not remove the authentication/CAPTCHA gates.

## Avalanche Fuji

- [Official Builder Hub faucet](https://build.avax.network/console/primary-network/faucet) loaded HTTP 200. The rendered requirements are wallet detected, wallet connected and Builder Hub Account. It provides a Log In step. This fresh review context had no such authenticated session.
- [Official Core faucet](https://core.app/tools/testnet-faucet/?subnet=c&token=c) loaded. Navigated the network and token selection controls only, choosing the existing Fuji C-Chain / AVAX defaults.
- The final public form requested destination address, coupon code and **“I'm not a robot” reCAPTCHA**. It explained that a valid coupon or positive AVAX balance on mainnet C-Chain is required, and limited drops to one per 24 hours. The request button offered 2 test AVAX but remained disabled. No address was entered and no request was submitted.
- The displayed faucet had approximately 3,624.818 test AVAX, so the observed blocker was access qualification/CAPTCHA rather than an empty faucet.
- [Ava Labs faucet repository](https://github.com/ava-labs/avalanche-faucet) independently documents CAPTCHA-protected send-token requests. Its self-hosting setup does not grant access to Ava Labs' funded faucet.

**Precise remaining action:** an eligible human completes the official Builder Hub login/wallet flow or uses a legitimate Core faucet coupon plus CAPTCHA for a new project-only address. Alternatively transfer already-held test AVAX to that address. No mainnet purchase or existing private-key access is necessary or authorized for EXIT.

## Swarm ID / event postage

- [Swarm ID quick start](https://swarm.snaha.net/docs/getting-started/) explicitly requires both authentication and `connectionInfo.canUpload`; a connected identity can still have no upload capability.
- [Subsidised gateway documentation](https://swarm.snaha.net/docs/subsidised-gateway/) requires an operator-funded Bee gateway/postage stamp. `subsidisedGatewayUrl` is configurable infrastructure, not a promised free public upload endpoint. The documentation did not publish a universally available funded endpoint for EXIT.
- The live [identity UI](https://swarm-id.snaha.net/?signin) offered create/import account. It did not grant an anonymous upload/postage balance. No identity was created.
- [Official ETHRome manual, Swarm brief](https://github.com/urbeETH/ethrome-2026-hacker-manual/blob/main/HACKER-MANUAL.md#swarm--1000-build-an-app-where-users-own-their-data) offers free weekend storage through gift codes collected at the Swarm desk on Friday evening. No gift code or sponsor-assigned subsidised endpoint is present in this session.

**Precise remaining action:** collect the authorized event gift code and complete its documented redemption/onboarding, then verify `canUpload` and an actual upload/retrieval; or supply a legitimate funded postage batch plus upload gateway. Account creation alone is insufficient. EXIT's ordinary-bytes transport remains usable once funded access is provided; protect application ciphertext locally regardless of the storage identity path.

## Conclusion

No permitted anonymous programmatic faucet or free-postage route was verified in this bounded official-source check. Public write tests remain blocked by provider-controlled login/CAPTCHA/coupon/postage access. This result does not claim that no other official access program exists. The runnable local implementation and previously successful public read connectivity are separate evidence.
