# Deaddrop application

[Quickstart](../../../docs/deaddrop/QUICKSTART.md) · [User flow](../../../docs/deaddrop/USER-FLOW.md) · [Architecture](../../../docs/deaddrop/ARCHITECTURE.md) · [Deployment](../../../docs/deaddrop/DEPLOYMENT.md)

Clients fund public technical-review scopes with test USDC. Reviewers apply for an issuer-approved pass, save it privately in their browser, generate a task-specific eligibility proof, and deliver a report encrypted for the client and themselves. The client decrypts before approving payment on Fuji.

`web/` is the customer interface. `hosting/` serves verified public data and relays encrypted enrollment messages; credential signing remains with an explicit offline issuer operator. Account-free report uploads use the public Swarm gateway. The compatibility name `review-pass` remains in protocol domains and persisted formats.

For the local chain/Bee stack use the [quickstart](../../../docs/deaddrop/QUICKSTART.md). For the real two-wallet flow use [testing](../../../docs/deaddrop/TESTING.md). Historical local and public receipts are retained as dated evidence; current status is in the [evidence index](../../../docs/deaddrop/EVIDENCE.md).
