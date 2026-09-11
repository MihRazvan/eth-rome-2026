import { useEffect, useState } from "react";
import type {
  AppActions,
  AppData,
  Claim,
  Offer,
  OfferMode,
  TransactionResult,
} from "./model";
import "./styles.css";

export function money(value?: string, digits = 2) {
  if (value === undefined || !/^-?\d+(\.\d+)?$/.test(value)) return "—";
  const negative = value.startsWith("-");
  const [whole, fraction = ""] = value.replace(/^-/, "").split(".");
  const normalizedWhole = whole.replace(/^0+(?=\d)/, "");
  const displayedFraction = fraction.replace(/0+$/, "").padEnd(digits, "0");
  return `${negative ? "-" : ""}${normalizedWhole.replace(/\B(?=(\d{3})+(?!\d))/g, ",")}${displayedFraction ? "." + displayedFraction : ""}`;
}

function Arrow({ direction = "right" }: { direction?: "right" | "up" }) {
  return (
    <svg
      aria-hidden="true"
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
    >
      <path
        d={
          direction === "right"
            ? "M5 12h14m-6-6 6 6-6 6"
            : "M6 18 18 6M6 6h12v12"
        }
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
function Lock() {
  return (
    <svg
      aria-hidden="true"
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
    >
      <rect
        x="5"
        y="10"
        width="14"
        height="11"
        rx="2"
        stroke="currentColor"
        strokeWidth="1.7"
      />
      <path
        d="M8 10V7a4 4 0 0 1 8 0v3"
        stroke="currentColor"
        strokeWidth="1.7"
      />
    </svg>
  );
}
function Status({
  children,
  tone = "neutral",
}: {
  children: React.ReactNode;
  tone?: "neutral" | "green" | "blue" | "orange";
}) {
  return (
    <span className={`status ${tone}`}>
      <i />
      {children}
    </span>
  );
}
function Amount({ value, small = false }: { value?: string; small?: boolean }) {
  return (
    <span className={small ? "amount small" : "amount"}>
      {money(value)}
      <span className="unit">USDC</span>
    </span>
  );
}
function Receipt({
  claim,
  compact = false,
}: {
  claim: Claim;
  compact?: boolean;
}) {
  const expected = Number(claim.expected),
    collected = Number(claim.withdrawn);
  const total = expected + collected;
  return (
    <div className={`receipt ${compact ? "compact" : ""}`}>
      <div className="receipt-top">
        <span className="receipt-symbol">↗</span>
        <div>
          <strong>{claim.title}</strong>
          <span>Claim #{claim.id}</span>
        </div>
        <Status tone={claim.status === "loss" ? "orange" : "green"}>
          {claim.status === "partial"
            ? "Partially collected"
            : claim.status === "loss"
              ? "Adverse outcome"
              : "Withdrawal right"}
        </Status>
      </div>
      <div className="receipt-value">
        <span>Expected remaining proceeds</span>
        <Amount value={claim.expected} />
        <p>{claim.timing} · Timing is source-controlled</p>
      </div>
      <div
        className="rights-strip"
        aria-label={`${money(claim.withdrawn)} withdrawn, ${money(claim.expected)} remaining`}
      >
        <div className="cash-segment" style={{ flex: collected || 0.001 }} />
        <div className="pending-segment" style={{ flex: expected || 0.001 }} />
      </div>
      <div className="receipt-split">
        <div>
          <span>
            <i className="dot collected" />
            Already withdrawn
          </span>
          <strong>{money(claim.withdrawn)}</strong>
        </div>
        <div>
          <span>
            <i className="dot residual" />
            Remaining rights
          </span>
          <strong>{total ? Math.round((expected / total) * 100) : 0}%</strong>
        </div>
      </div>
      <div className="perforation" />
      <div className="receipt-footer">
        <span>{claim.source}</span>
        <span>Test source</span>
      </div>
    </div>
  );
}

export default function App({
  data,
  actions,
}: {
  data: AppData;
  actions: AppActions;
}) {
  const [page, setPage] = useState<"markets" | "trade" | "portfolio" | "claim">(
    "markets",
  );
  const [selectedId, setSelectedId] = useState<string>();
  const [mode, setMode] = useState<OfferMode>("public");
  const [filter, setFilter] = useState("all");
  const [search, setSearch] = useState("");
  const [offerId, setOfferId] = useState<string>();
  const [busy, setBusy] = useState("");
  const [notice, setNotice] = useState<{
    error?: boolean;
    message: string;
    url?: string;
  }>();
  const [review, setReview] = useState(false);
  const [reviewTerms, setReviewTerms] = useState<{
    claim: Claim;
    offer: Offer;
  }>();
  const [makeBid, setMakeBid] = useState(false);
  const [bid, setBid] = useState("");
  const [bidMode, setBidMode] = useState<OfferMode>("public");
  const [riskAccepted, setRiskAccepted] = useState(false);
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);
  const claim = data.claims.find((c) => c.id === selectedId) || data.claims[0];
  const offers = data.offers
    .filter(
      (o) =>
        o.claimId === claim?.id &&
        o.mode === (page === "markets" ? "public" : mode),
    )
    .map((o) => ({
      ...o,
      status:
        o.deadline <= now && o.status === "valid"
          ? ("expired" as const)
          : o.status,
    }))
    .sort((a, b) => Number(b.net || 0) - Number(a.net || 0));
  const validOffers = offers.filter((o) => o.status === "valid");
  const offer = validOffers.find((o) => o.id === offerId) || validOffers[0];
  const params = new URLSearchParams(window.location.search);
  const concept =
    data.environment === "preview"
      ? params.get("concept") || "receipt"
      : "receipt";
  async function run(
    label: string,
    action: () => Promise<TransactionResult | void>,
  ) {
    if (busy) return;
    setBusy(label);
    setNotice(undefined);
    try {
      const result = await action();
      setNotice({
        message: result?.message || `${label} complete.`,
        url: result?.explorerUrl,
      });
      if (result?.status === "confirmed" || result?.status === "replaced") {
        setReview(false);
        setMakeBid(false);
      }
    } catch (error) {
      setNotice({
        error: true,
        message:
          error instanceof Error
            ? error.message
            : "The operation failed. Refresh chain state before retrying.",
      });
    } finally {
      setBusy("");
    }
  }
  function navigate(next: typeof page, id?: string) {
    setPage(next);
    if (id) setSelectedId(id);
    setReview(false);
    setNotice(undefined);
    setOfferId(undefined);
    setRiskAccepted(false);
  }
  const unavailable = data.environment === "unavailable";
  const canTransact = !!data.wallet && !data.wrongNetwork && !unavailable;
  const filtered = data.claims.filter(
    (c) =>
      (filter === "all" ||
        (filter === "collectible" && Number(c.claimable) > 0) ||
        (filter === "residual" && c.status === "partial")) &&
      `${c.id} ${c.title} ${c.source}`
        .toLowerCase()
        .includes(search.toLowerCase()),
  );
  const own = data.claims.filter((c) => c.isOwner || c.realized !== undefined);
  const networkLabel =
    data.environment === "preview"
      ? "Design preview"
      : data.environment === "local"
        ? "Local chain"
        : data.environment === "fuji"
          ? "Avalanche Fuji"
          : "Disconnected";
  return (
    <div className={`app concept-${concept}`}>
      <a className="skip-link" href="#main">
        Skip to content
      </a>
      <header className="app-header">
        <button
          className="brand"
          onClick={() => navigate("markets")}
          aria-label="EXIT markets"
        >
          EXIT<span className="brand-arrow">↗</span>
        </button>
        <nav aria-label="Main navigation">
          <button
            aria-current={page === "markets" ? "page" : undefined}
            onClick={() => navigate("markets")}
          >
            Markets
          </button>
          <button
            aria-current={page === "trade" ? "page" : undefined}
            onClick={() => navigate("trade")}
          >
            Sell a withdrawal
          </button>
          <button
            aria-current={page === "portfolio" ? "page" : undefined}
            onClick={() => navigate("portfolio")}
          >
            Portfolio
          </button>
        </nav>
        <div className="header-wallet">
          <span className="network">
            <i />
            {networkLabel}
          </span>
          <button
            className="button connect"
            disabled={!!busy}
            onClick={() =>
              run(
                data.wrongNetwork ? "Switch network" : "Connect wallet",
                data.wrongNetwork ? actions.switchNetwork : actions.connect,
              )
            }
          >
            {data.wrongNetwork
              ? "Switch network"
              : data.wallet
                ? `${data.wallet.slice(0, 6)}…${data.wallet.slice(-4)}`
                : "Connect wallet"}
          </button>
        </div>
      </header>
      {data.environment === "preview" && (
        <div className="environment-banner">
          Design preview · Illustrative data, no connected chain or live offers.
          <a href={window.location.pathname}>
            Open connected app <Arrow />
          </a>
        </div>
      )}
      {data.environment === "local" && (
        <div className="environment-banner local">
          Local chain demonstration · Real local transactions, test assets
          without monetary value.
        </div>
      )}
      {data.wrongNetwork && (
        <div className="alert error">
          Your wallet is on a different network. Switch to {data.chainName} to
          trade. Browsing remains available.
        </div>
      )}
      <main id="main">
        {notice && (
          <div
            className={`alert ${notice.error ? "error" : "success"}`}
            role={notice.error ? "alert" : "status"}
          >
            <span>
              {notice.message}
              {notice.url && (
                <>
                  {" "}
                  <a href={notice.url} target="_blank" rel="noreferrer">
                    View transaction ↗
                  </a>
                </>
              )}
            </span>
            <button
              aria-label="Dismiss notification"
              onClick={() => setNotice(undefined)}
            >
              ×
            </button>
          </div>
        )}
        {data.error && (
          <div className="alert error" role="alert">
            <span>{data.error}</span>
            <button onClick={() => run("Refresh", actions.refresh)}>
              Retry
            </button>
          </div>
        )}
        {data.loading && (
          <div className="loading" role="status">
            Reading claims and offer records…
          </div>
        )}
        {page === "markets" && (
          <>
            <div className="page-heading">
              <div>
                <h1>
                  Time is an asset.
                  <br />
                  Trade yours.
                </h1>
                <p>
                  Sell your withdrawal. Get paid now.
                  <br className="mobile-break" /> Let the buyer wait.
                </p>
              </div>
              <div className="heading-note">
                <span className="source-mark">A</span>
                <div>
                  Withdrawal markets on Avalanche
                  <strong>Test USDC · EXIT Test Withdrawal Vault</strong>
                </div>
              </div>
            </div>
            <div className="market-overview">
              <div className="market-intro">
                <span className="section-kicker">The exchange</span>
                <h2>
                  Cash today. <br />
                  The remaining rights <br />
                  change hands.
                </h2>
                <div className="exchange-steps">
                  <div>
                    <span className="step-node">1</span>
                    <p>
                      Pick your withdrawal<span>See what is still owed.</span>
                    </p>
                  </div>
                  <div>
                    <span className="step-node">2</span>
                    <p>
                      Compare buyer offers
                      <span>You choose your exact payment.</span>
                    </p>
                  </div>
                  <div>
                    <span className="step-node">3</span>
                    <p>
                      Sell in one transaction
                      <span>The buyer collects what comes next.</span>
                    </p>
                  </div>
                </div>
                <button
                  className="text-button"
                  onClick={() => navigate("trade")}
                >
                  Find an exit <Arrow />
                </button>
              </div>
              {claim ? (
                <Receipt claim={claim} />
              ) : (
                <div className="empty-receipt">
                  <span className="receipt-symbol">↗</span>
                  <h2>
                    {unavailable
                      ? "Connect a deployment"
                      : "Your next withdrawal starts here"}
                  </h2>
                  <p>
                    {unavailable
                      ? "No chain data is being shown. Configure the application to browse onchain claims."
                      : "Create a backed test claim to explore the complete withdrawal lifecycle."}
                  </p>
                  <button
                    className="button primary"
                    onClick={() => run("Create test claim", actions.originate)}
                    disabled={!canTransact || !!busy}
                  >
                    Create test claim
                  </button>
                  {unavailable && (
                    <a href="?preview=1">View explicit design preview</a>
                  )}
                </div>
              )}
              <div className="market-offer">
                <span className="section-kicker">
                  {claim ? `Claim #${claim.id}` : "Withdrawal offers"}
                </span>
                <span className="today-label">Best valid offer received</span>
                <div className="offer-hero">
                  {money(offer?.net, 2)}
                  <span>test USDC to the seller</span>
                </div>
                <div className="offer-comparison">
                  <span>Expected remaining</span>
                  <strong>{money(claim?.expected)}</strong>
                  <span>Protocol fee</span>
                  <strong>{money(offer?.fee)}</strong>
                  <span>Settlement</span>
                  <strong>Atomic onchain</strong>
                </div>
                <button
                  className="button primary"
                  disabled={!claim}
                  onClick={() => navigate("trade", claim?.id)}
                >
                  Compare offers <Arrow />
                </button>
                <p className="fine-print">
                  Payment is exact. Source proceeds and timing carry risk. Gas
                  is separate.
                </p>
              </div>
            </div>
            <section className="market-list">
              <div className="section-heading">
                <h2>
                  Available withdrawals{" "}
                  <span className="count">{filtered.length}</span>
                </h2>
                <button
                  className="text-button"
                  onClick={() => run("Refresh", actions.refresh)}
                  disabled={!!busy}
                >
                  ↻ Refresh
                </button>
              </div>
              <div className="table-controls">
                <div className="segmented" aria-label="Filter claims">
                  {[
                    ["all", "All claims"],
                    ["collectible", "Collectible now"],
                    ["residual", "Residual rights"],
                  ].map(([value, label]) => (
                    <button
                      key={value}
                      aria-pressed={filter === value}
                      onClick={() => setFilter(value)}
                    >
                      {label}
                    </button>
                  ))}
                </div>
                <label className="search">
                  <svg
                    width="16"
                    height="16"
                    viewBox="0 0 24 24"
                    fill="none"
                    aria-hidden="true"
                  >
                    <circle
                      cx="10"
                      cy="10"
                      r="6"
                      stroke="currentColor"
                      strokeWidth="1.8"
                    />
                    <path
                      d="m15 15 5 5"
                      stroke="currentColor"
                      strokeWidth="1.8"
                    />
                  </svg>
                  <input
                    aria-label="Search claims"
                    placeholder="Search claim or source"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                  />
                </label>
              </div>
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>Withdrawal</th>
                      <th>Expected remaining</th>
                      <th>Withdrawn to date</th>
                      <th>Collection window</th>
                      <th>Position</th>
                      <th>
                        <span className="sr-only">Actions</span>
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.map((c) => (
                      <tr key={c.id}>
                        <td>
                          <button
                            className="claim-link"
                            onClick={() => navigate("claim", c.id)}
                          >
                            <span className="claim-icon">↗</span>
                            <span>
                              <strong>
                                {c.title} <span>#{c.id}</span>
                              </strong>
                              <small>{c.source}</small>
                            </span>
                          </button>
                        </td>
                        <td>
                          <strong className="number">
                            {money(c.expected)}
                          </strong>
                          <small>test USDC</small>
                        </td>
                        <td className="number">{money(c.withdrawn)}</td>
                        <td>
                          {c.timing}
                          <small>Source-controlled estimate</small>
                        </td>
                        <td>
                          <Status
                            tone={
                              c.status === "loss"
                                ? "orange"
                                : c.status === "partial"
                                  ? "blue"
                                  : "green"
                            }
                          >
                            {c.status === "partial"
                              ? "Residual"
                              : c.status === "loss"
                                ? "Loss scenario"
                                : Number(c.claimable) > 0
                                  ? "Collectible"
                                  : "Pending"}
                          </Status>
                        </td>
                        <td>
                          <button
                            className="row-action"
                            aria-label={`View claim ${c.id}`}
                            onClick={() => navigate("claim", c.id)}
                          >
                            <Arrow />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {filtered.length === 0 && (
                <div className="empty">
                  <h3>
                    {search
                      ? "No matching withdrawals"
                      : "No withdrawals available"}
                  </h3>
                  <p>
                    {search
                      ? "Try another claim number or source name."
                      : "Connect a wallet, get test funds and create a backed test claim."}
                  </p>
                </div>
              )}
              <div className="market-disclosure">
                <span>
                  <i className="dot residual" />
                  Team-operated demo makers use a disclosed pricing formula.
                </span>
                <span>
                  Test source only · no third-party production collateral
                </span>
              </div>
            </section>
          </>
        )}
        {page === "trade" && (
          <>
            <div className="page-heading compact-heading">
              <div>
                <h1>Make your exit.</h1>
                <p>
                  Choose the payment you receive for your remaining withdrawal
                  rights.
                </p>
              </div>
              <button
                className="button secondary"
                onClick={() => run("Create test claim", actions.originate)}
                disabled={!canTransact || !!busy}
              >
                Create test claim <span>+</span>
              </button>
            </div>
            {claim ? (
              <div className="trade-layout">
                <div className="trade-main">
                  <div className="section-heading">
                    <h2>Your withdrawal</h2>
                    <label className="select-label">
                      <span className="sr-only">Select withdrawal</span>
                      <select
                        value={claim.id}
                        onChange={(e) => {
                          setSelectedId(e.target.value);
                          setOfferId(undefined);
                        }}
                      >
                        {data.claims.map((c) => (
                          <option value={c.id} key={c.id}>
                            Claim #{c.id}
                            {c.isOwner ? " · Yours" : ""}
                          </option>
                        ))}
                      </select>
                    </label>
                  </div>
                  <Receipt claim={claim} />
                  <div className="section-heading offers-title">
                    <div>
                      <h2>
                        Competing offers{" "}
                        <span className="count">{offers.length}</span>
                      </h2>
                      <p>
                        {!data.wallet
                          ? "Connect your wallet to request fresh offers."
                          : !claim.isOwner
                            ? "Only the claim owner can request fresh offers."
                            : "Signed buyer offers. You decide which to accept."}
                      </p>
                    </div>
                    <button
                      className="text-button"
                      disabled={!canTransact || !claim.isOwner || !!busy}
                      title={
                        !data.wallet
                          ? "Connect your wallet to request offers"
                          : !claim.isOwner
                            ? "Only the claim owner can request offers"
                            : data.wrongNetwork
                              ? "Switch to the configured network"
                              : undefined
                      }
                      onClick={() =>
                        run("Request offers", () =>
                          actions.requestOffers(claim.id, mode),
                        )
                      }
                    >
                      {busy === "Request offers"
                        ? "Requesting…"
                        : "Request fresh offers"}
                    </button>
                  </div>
                  <div className="mode-switch">
                    <div className="segmented">
                      <button
                        aria-pressed={mode === "public"}
                        onClick={() => {
                          setMode("public");
                          setOfferId(undefined);
                        }}
                      >
                        Public offers
                      </button>
                      <button
                        aria-pressed={mode === "private"}
                        onClick={() => {
                          setMode("private");
                          setOfferId(undefined);
                        }}
                      >
                        <Lock /> Private Offers
                      </button>
                    </div>
                    <span>
                      {mode === "private"
                        ? "Only you can read received bids."
                        : "Offer terms are publicly readable."}
                    </span>
                  </div>
                  {mode === "private" && (
                    <div className="privacy-panel">
                      <Lock />
                      <div>
                        <strong>Private negotiation. Public settlement.</strong>
                        <p>
                          Offers are encrypted for your separate device key
                          before upload. Team-operated demonstration prices
                          follow a known formula; test bid confidentiality with
                          a custom private offer. Competing buyers and storage
                          providers cannot read your bids. Accepted terms and
                          addresses become public when submitted onchain—even if
                          settlement fails.
                        </p>
                        {data.privateKeyStatus !== "available" && (
                          <>
                            <p className="key-warning">
                              {data.privateKeyStatus === "missing"
                                ? "No offer key is available on this browser. Create or restore a key to read private offers. Losing it can make earlier offers unreadable."
                                : "Unlock the encryption key on this browser to compare private offers."}
                            </p>
                            <button
                              className="button secondary"
                              disabled={!canTransact || !!busy}
                              onClick={() =>
                                run("Unlock private offers", () =>
                                  actions.unlockPrivateOffers(claim.id),
                                )
                              }
                            >
                              {data.privateKeyStatus === "missing"
                                ? "Set up offer key"
                                : "Unlock offer key"}
                            </button>
                          </>
                        )}
                      </div>
                    </div>
                  )}
                  <div className="offers-list">
                    {offers.map((o, index) => (
                      <button
                        className={`offer-row ${o.id === offer?.id ? "selected" : ""} ${o.status !== "valid" ? "invalid" : ""}`}
                        key={o.id}
                        disabled={o.status !== "valid"}
                        onClick={() => setOfferId(o.id)}
                      >
                        <span className="radio-dot" />
                        <span className="maker-avatar">
                          {o.maker.slice(-1)}
                        </span>
                        <span className="maker-name">
                          <strong>{o.maker}</strong>
                          <small>
                            {o.teamOperated
                              ? "Team-operated maker"
                              : "Independent maker"}{" "}
                            ·{" "}
                            {o.status === "valid"
                              ? `Expires in ${Math.max(0, Math.floor((o.deadline - now) / 60000))}m ${Math.max(0, Math.floor((o.deadline - now) / 1000) % 60)}s`
                              : o.status}
                          </small>
                          {o.reason && (
                            <small className="offer-reason">{o.reason}</small>
                          )}
                        </span>
                        {index === 0 && o.status === "valid" && (
                          <span className="best-label">Best received</span>
                        )}
                        <span className="offer-price">
                          {o.status === "encrypted" ? <Lock /> : money(o.net)}
                          <small>
                            {o.status === "encrypted"
                              ? "Encrypted"
                              : "test USDC net"}
                          </small>
                        </span>
                      </button>
                    ))}
                  </div>
                  {offers.length === 0 && (
                    <div className="empty">
                      <h3>
                        {mode === "private"
                          ? "No readable private offers"
                          : "No offers received yet"}
                      </h3>
                      <p>
                        {mode === "private"
                          ? "Set up your offer key and request new encrypted offers. No plaintext fallback is used."
                          : "Request fresh offers from the funded demonstration makers. Offers can expire or become unfunded."}
                      </p>
                    </div>
                  )}
                  <div className="risk-note">
                    <span>↗</span>
                    <p>
                      <strong>You sell the remaining rights in full.</strong>{" "}
                      After settlement you cannot collect, cancel or redirect
                      the claim. The buyer assumes source timing, currency and
                      loss risk.
                    </p>
                  </div>
                </div>
                <aside className="trade-ticket">
                  <span className="section-kicker">Your settlement</span>
                  <h2>You receive</h2>
                  <div className="ticket-net">
                    {money(offer?.net)}
                    <span>test USDC</span>
                  </div>
                  <div className="ticket-rows">
                    <div>
                      <span>Buyer pays</span>
                      <strong>{money(offer?.gross)}</strong>
                    </div>
                    <div>
                      <span>Protocol fee</span>
                      <strong>{money(offer?.fee)}</strong>
                    </div>
                    <div>
                      <span>Seller net payment</span>
                      <strong>{money(offer?.net)}</strong>
                    </div>
                    <div>
                      <span>Network gas</span>
                      <strong>Separate · wallet estimate</strong>
                    </div>
                  </div>
                  <div className="ticket-receive">
                    <span>Buyer acquires</span>
                    <strong>All remaining rights to #{claim.id}</strong>
                    <span>Expected {money(claim.expected)} test USDC</span>
                    <span>Includes supported later recoveries</span>
                  </div>
                  <div className="decision-context">
                    {networkLabel} · Test source
                    <br />
                    {claim.source}
                  </div>
                  <button
                    className="button primary full"
                    disabled={
                      !!busy || !offer || (!!data.wallet && !claim.isOwner)
                    }
                    onClick={() =>
                      !data.wallet
                        ? run("Connect wallet", actions.connect)
                        : data.wrongNetwork
                          ? run("Switch network", actions.switchNetwork)
                          : (() => {
                              setReviewTerms({
                                claim: { ...claim },
                                offer: { ...offer! },
                              });
                              setReview(true);
                            })()
                    }
                  >
                    {!data.wallet
                      ? "Connect to sell"
                      : data.wrongNetwork
                        ? "Switch network"
                        : !claim.isOwner
                          ? "Only the owner can sell"
                          : offer
                            ? "Review sale"
                            : "Waiting for valid offers"}
                    <Arrow />
                  </button>
                  <p className="fine-print">
                    Quotes do not reserve buyer funds. Executability is checked
                    again before settlement.
                  </p>
                  <button
                    className="text-button"
                    onClick={() => navigate("claim", claim.id)}
                  >
                    Inspect claim and risks <Arrow />
                  </button>
                </aside>
              </div>
            ) : (
              <div className="empty">
                <h2>No withdrawal selected</h2>
                <p>
                  Create a backed test claim from Portfolio to receive offers.
                </p>
                <button
                  className="button primary"
                  onClick={() => navigate("portfolio")}
                >
                  Open Portfolio
                </button>
              </div>
            )}
          </>
        )}
        {page === "portfolio" && (
          <>
            <div className="page-heading compact-heading">
              <div>
                <h1>
                  What you hold.
                  <br />
                  What you’ve collected.
                </h1>
                <p>
                  Follow each claim from acquisition to its final supported
                  recovery.
                </p>
              </div>
              <button
                className="button secondary"
                disabled={!!busy}
                onClick={() => run("Refresh", actions.refresh)}
              >
                ↻ Refresh balances
              </button>
            </div>
            <div className="portfolio-layout">
              <section>
                <div className="section-heading">
                  <h2>
                    Your positions <span className="count">{own.length}</span>
                  </h2>
                  <span>
                    {data.wallet
                      ? "Connected wallet"
                      : "Connect to load your positions"}
                  </span>
                </div>
                {!data.wallet ? (
                  <div className="empty portfolio-empty">
                    <div className="large-icon">↗</div>
                    <h2>Your next chapter starts here.</h2>
                    <p>
                      Connect your wallet to see withdrawal rights, collected
                      cash and your exact purchase costs.
                    </p>
                    <button
                      className="button primary"
                      disabled={!!busy}
                      onClick={() => run("Connect wallet", actions.connect)}
                    >
                      Connect wallet
                    </button>
                  </div>
                ) : own.length === 0 ? (
                  <div className="empty">
                    <h2>No claims owned by this wallet</h2>
                    <p>
                      Get test funds and create a withdrawal, or make an offer
                      on an existing position.
                    </p>
                  </div>
                ) : (
                  own.map((c) => (
                    <article className="position" key={c.id}>
                      <div className="position-head">
                        <button
                          className="claim-link"
                          onClick={() => navigate("claim", c.id)}
                        >
                          <span className="claim-icon">↗</span>
                          <span>
                            <strong>
                              {c.title} #{c.id}
                            </strong>
                            <small>{c.source}</small>
                          </span>
                        </button>
                        <Status tone={c.status === "loss" ? "orange" : "blue"}>
                          {c.status}
                        </Status>
                      </div>
                      <div className="cash-flow">
                        <div>
                          <span>Acquisition cost</span>
                          <strong>{money(c.cost)}</strong>
                        </div>
                        <span className="flow-operator">−</span>
                        <div>
                          <span>Cash withdrawn</span>
                          <strong>{money(c.walletWithdrawn)}</strong>
                        </div>
                        <span className="flow-operator">=</span>
                        <div>
                          <span>Unrecovered cost</span>
                          <strong>{money(c.residualCost)}</strong>
                        </div>
                      </div>
                      <div className="position-residual">
                        <div>
                          <span>Expected remaining</span>
                          <strong>
                            {money(c.expected)} <small>test USDC</small>
                          </strong>
                        </div>
                        <div>
                          <span>Claimable now</span>
                          <strong>{money(c.claimable)}</strong>
                        </div>
                        <div>
                          <span>Realized result</span>
                          <strong>{money(c.realized)}</strong>
                        </div>
                      </div>
                      <p className="fine-print">
                        Expected proceeds may change. Unrealized estimates are
                        not realized profit. Gas and operating costs excluded.
                      </p>
                      <div className="position-actions">
                        <button
                          className="button secondary"
                          disabled={
                            !canTransact ||
                            !c.isOwner ||
                            !!busy ||
                            Number(c.claimable) <= 0
                          }
                          onClick={() =>
                            run("Collect proceeds", () => actions.collect(c.id))
                          }
                        >
                          Collect proceeds
                        </button>
                        <button
                          className="button secondary"
                          disabled={
                            !canTransact ||
                            !c.isOwner ||
                            !!busy ||
                            Number(c.collected) <= 0
                          }
                          onClick={() =>
                            run("Withdraw cash", () => actions.withdraw(c.id))
                          }
                        >
                          Withdraw cash
                        </button>
                        <button
                          className="button primary"
                          disabled={!c.isOwner}
                          onClick={() => navigate("trade", c.id)}
                        >
                          Sell remaining rights <Arrow />
                        </button>
                      </div>
                    </article>
                  ))
                )}
              </section>
              <aside>
                <div className="setup-card">
                  <span className="section-kicker">
                    Try the complete lifecycle
                  </span>
                  <h2>
                    A real test claim.
                    <br />
                    Your own wallet.
                  </h2>
                  <p>
                    Fund, originate, sell, collect and resell on the configured
                    test chain.
                  </p>
                  <div className="setup-row">
                    <span className="step-node">1</span>
                    <div>
                      <strong>Get test funds</strong>
                      <p>Test USDC balance: {money(data.balance)}</p>
                    </div>
                    <button
                      disabled={!canTransact || !!busy}
                      onClick={() => run("Get test funds", actions.faucet)}
                    >
                      Get funds
                    </button>
                  </div>
                  <div className="setup-row">
                    <span className="step-node">2</span>
                    <div>
                      <strong>Create a backed claim</strong>
                      <p>Deposit test USDC into the test vault.</p>
                    </div>
                    <button
                      disabled={!canTransact || !!busy}
                      onClick={() =>
                        run("Create test claim", actions.originate)
                      }
                    >
                      Create
                    </button>
                  </div>
                  <div className="setup-row">
                    <span className="step-node">3</span>
                    <div>
                      <strong>Find your buyer</strong>
                      <p>Request fresh team-operated maker offers.</p>
                    </div>
                    <button onClick={() => navigate("trade")} disabled={!claim}>
                      Sell
                    </button>
                  </div>
                  <p className="fine-print">
                    Test assets have no monetary value. If funding is
                    unavailable, existing positions remain inspectable and
                    collectible.
                  </p>
                </div>
                <div className="risk-note">
                  <Lock />
                  <p>
                    Private offer keys stay on your device. A wallet
                    reconnection does not recover a lost encryption key.
                  </p>
                </div>
              </aside>
            </div>
          </>
        )}
        {page === "claim" && claim && (
          <>
            <button className="breadcrumb" onClick={() => navigate("markets")}>
              ← All withdrawals
            </button>
            <div className="page-heading compact-heading">
              <div>
                <h1>
                  {claim.title}
                  <span className="claim-number">#{claim.id}</span>
                </h1>
                <p>
                  {claim.source} · {networkLabel} · Test source
                </p>
              </div>
              <div className="detail-actions">
                <button
                  className="button secondary"
                  disabled={!canTransact || !!busy}
                  onClick={() => {
                    setMakeBid(true);
                    setBid("");
                    setRiskAccepted(false);
                  }}
                >
                  Make an offer
                </button>
                <button
                  className="button primary"
                  onClick={() => navigate("trade", claim.id)}
                >
                  {claim.isOwner
                    ? "Sell remaining rights"
                    : "View buyer offers"}
                  <Arrow />
                </button>
              </div>
            </div>
            <div className="detail-layout">
              <section>
                <Receipt claim={claim} />
                <div className="section-heading">
                  <h2>The ownership trail</h2>
                  <Status tone="blue">Epoch {claim.epoch}</Status>
                </div>
                <div className="ownership-trail">
                  {claim.history.map((event, i) => (
                    <div className="history-event" key={i}>
                      <span className="history-point" />
                      <div>
                        <strong>{event.label}</strong>
                        <p>{event.detail}</p>
                        {event.txUrl && (
                          <a
                            href={event.txUrl}
                            target="_blank"
                            rel="noreferrer"
                          >
                            View transaction ↗
                          </a>
                        )}
                      </div>
                      {event.amount && (
                        <strong className="number">
                          {money(event.amount)}
                        </strong>
                      )}
                    </div>
                  ))}
                </div>
                <div className="source-risk">
                  <h2>Know what changes hands</h2>
                  <p>{claim.sourceRisk}</p>
                  <div className="rights-grid">
                    <div>
                      <strong>Included</strong>
                      <p>
                        Pending and claimable entitlement, recognized cash still
                        in the claim account, and supported later recoveries.
                      </p>
                    </div>
                    <div>
                      <strong>Already removed</strong>
                      <p>
                        {money(claim.withdrawn)} test USDC has been withdrawn.
                        It is outside any new sale.
                      </p>
                    </div>
                  </div>
                  <p>{claim.recovery}</p>
                </div>
              </section>
              <aside className="claim-dossier">
                <span className="section-kicker">Claim dossier</span>
                <h2>Remaining entitlement</h2>
                <dl>
                  <div>
                    <dt>Pending proceeds</dt>
                    <dd>{money(claim.pending)}</dd>
                  </div>
                  <div>
                    <dt>Claimable proceeds</dt>
                    <dd>{money(claim.claimable)}</dd>
                  </div>
                  <div>
                    <dt>Recognized collected cash</dt>
                    <dd>{money(claim.collected)}</dd>
                  </div>
                  <div>
                    <dt>Cash withdrawn</dt>
                    <dd>{money(claim.withdrawn)}</dd>
                  </div>
                  <div>
                    <dt>Ownership epoch</dt>
                    <dd>{claim.epoch}</dd>
                  </div>
                  <div>
                    <dt>Value depletion counter</dt>
                    <dd>{claim.depletion}</dd>
                  </div>
                  <div>
                    <dt>Current owner</dt>
                    <dd className="address">{claim.owner}</dd>
                  </div>
                </dl>
                <p className="fine-print">
                  Ownership and depletion bind offers to these rights. Removing
                  value invalidates older offers. Harmless time progression does
                  not.
                </p>
                {claim.explorerUrl && (
                  <a
                    className="button secondary"
                    href={claim.explorerUrl}
                    target="_blank"
                    rel="noreferrer"
                  >
                    View claim on explorer <Arrow direction="up" />
                  </a>
                )}
                <div className="dossier-actions">
                  <button
                    className="button primary full"
                    disabled={
                      !canTransact ||
                      !claim.isOwner ||
                      !!busy ||
                      Number(claim.claimable) <= 0
                    }
                    onClick={() =>
                      run("Collect proceeds", () => actions.collect(claim.id))
                    }
                  >
                    Collect {money(claim.claimable)} USDC
                  </button>
                  <button
                    className="button secondary full"
                    disabled={
                      !canTransact ||
                      !claim.isOwner ||
                      !!busy ||
                      Number(claim.collected) <= 0
                    }
                    onClick={() =>
                      run("Withdraw cash", () => actions.withdraw(claim.id))
                    }
                  >
                    Withdraw recognized cash
                  </button>
                </div>
              </aside>
            </div>
          </>
        )}
      </main>
      <footer>
        <div>
          <span className="footer-logo">EXIT↗</span>
          <span>Let the buyer wait.</span>
        </div>
        <div className="service-status">
          {data.services.map((s) => (
            <span key={s.name} title={s.detail}>
              <i className={`service-dot ${s.status}`} />
              {s.name}
              <small>
                {s.status === "connected"
                  ? "Connected"
                  : s.status === "preview"
                    ? "Preview"
                    : "Unavailable"}
              </small>
            </span>
          ))}
        </div>
        <span>Test assets. Real ownership rules.</span>
      </footer>
      {busy && (
        <div className="pending-toast" role="status">
          <span className="spinner" />
          {busy}… Check your wallet if prompted. Do not resubmit while pending.
        </div>
      )}
      {review && reviewTerms && (
        <SaleReview
          terms={reviewTerms}
          busy={busy}
          now={now}
          networkLabel={networkLabel}
          mode={mode}
          close={() => setReview(false)}
          submit={() =>
            run("Settle sale", () => actions.acceptOffer(reviewTerms.offer.id))
          }
        />
      )}

      {makeBid && claim && (
        <Modal title="Make a purchase offer" close={() => setMakeBid(false)}>
          <p>
            Offer to purchase the complete remaining rights to claim #{claim.id}
            . Expected proceeds: {money(claim.expected)} test USDC.
          </p>
          <div className="segmented bid-mode">
            <button
              aria-pressed={bidMode === "public"}
              onClick={() => setBidMode("public")}
            >
              Public offer
            </button>
            <button
              aria-pressed={bidMode === "private"}
              onClick={() => setBidMode("private")}
            >
              <Lock /> Private offer
            </button>
          </div>
          <p>
            {bidMode === "private"
              ? "Encrypt this custom price for the seller’s authenticated request key. Submitted settlement terms become public."
              : "The offer amount and signed terms will be publicly readable."}
          </p>
          <label className="bid-input">
            Exact seller net payment
            <input
              inputMode="decimal"
              type="text"
              placeholder="0.00"
              value={bid}
              onChange={(e) => setBid(e.target.value)}
            />
            <span>test USDC · fee displayed by settlement</span>
          </label>
          <p>
            Your signature authorizes your capital. An offer does not reserve
            funds or guarantee the source payout.
          </p>
          <label className="checkbox">
            <input
              type="checkbox"
              checked={riskAccepted}
              onChange={(e) => setRiskAccepted(e.target.checked)}
            />
            <span>
              I accept the source, timing, currency and loss risks.{" "}
              {claim.sourceRisk}
            </span>
          </label>
          <button
            className="button primary full"
            disabled={
              !riskAccepted ||
              !!busy ||
              !/^\d+(\.\d{1,6})?$/.test(bid) ||
              Number(bid) <= 0
            }
            onClick={() =>
              run("Sign purchase offer", () =>
                actions.makeOffer(claim.id, bid, bidMode),
              )
            }
          >
            Sign purchase offer
          </button>
        </Modal>
      )}
    </div>
  );
}
function Modal({
  title,
  children,
  close,
}: {
  title: string;
  children: React.ReactNode;
  close: () => void;
}) {
  useEffect(() => {
    const previous = document.activeElement as HTMLElement;
    const dialog = document.querySelector<HTMLDialogElement>("dialog");
    dialog?.showModal();
    const onCancel = (e: Event) => {
      e.preventDefault();
      close();
    };
    dialog?.addEventListener("cancel", onCancel);
    return () => {
      dialog?.removeEventListener("cancel", onCancel);
      previous?.focus();
    };
  }, []);
  return (
    <dialog className="modal">
      <div className="modal-heading">
        <h2>{title}</h2>
        <button aria-label="Close dialog" onClick={close}>
          ×
        </button>
      </div>
      {children}
    </dialog>
  );
}

function SaleReview({
  terms,
  busy,
  now,
  networkLabel,
  mode,
  close,
  submit,
}: {
  terms: { claim: Claim; offer: Offer };
  busy: string;
  now: number;
  networkLabel: string;
  mode: OfferMode;
  close: () => void;
  submit: () => void;
}) {
  const [accepted, setAccepted] = useState(false);
  const { claim, offer } = terms;
  return (
    <Modal title="Review your sale" close={close}>
      <p>
        Sell all remaining rights to claim #{claim.id} to {offer.maker}.
      </p>
      <div className="review-net">
        <span>Your exact net payment</span>
        <Amount value={offer.net} />
      </div>
      <dl className="review-details">
        <div>
          <dt>Buyer gross debit</dt>
          <dd>{money(offer.gross)} USDC</dd>
        </div>
        <div>
          <dt>Protocol fee</dt>
          <dd>{money(offer.fee)} USDC</dd>
        </div>
        <div>
          <dt>Remaining expected proceeds</dt>
          <dd>{money(claim.expected)} USDC</dd>
        </div>
        <div>
          <dt>Network</dt>
          <dd>{networkLabel}</dd>
        </div>
        <div>
          <dt>Source</dt>
          <dd>{claim.source}</dd>
        </div>
      </dl>
      <p className="fine-print">
        Gas is separate. Settlement rechecks maker funds, ownership, depleted
        value, deadline and signature.{" "}
        {mode === "private"
          ? "Submitted private offer terms become public."
          : ""}
      </p>
      <label className="checkbox">
        <input
          type="checkbox"
          checked={accepted}
          onChange={(e) => setAccepted(e.target.checked)}
        />
        <span>
          I sell the remaining claim and supported recovery rights. I cannot
          collect or redirect them after this sale.
        </span>
      </label>
      <button
        className="button primary full"
        disabled={!accepted || !!busy || offer.deadline <= now}
        onClick={submit}
      >
        {offer.deadline <= now
          ? "Offer expired · request fresh offers"
          : busy
            ? "Waiting for confirmation…"
            : `Sell for ${money(offer.net)} USDC`}
      </button>
    </Modal>
  );
}
