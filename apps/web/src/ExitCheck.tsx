import { useRef, useState } from "react";
import { formatUnits, parseUnits } from "viem";
import {
  inspectClaim,
  SOURCES,
  CLAIM_REVIEW_BLOCK,
  type ClaimObservation,
  type ClaimSource,
} from "../../../packages/viability/claims";
import { purchaseCeiling } from "../../../packages/viability/economics";
import "./exit-check.css";

const eth = (wei: string | bigint) => formatUnits(BigInt(wei), 18);
const displayTime = (value: string) =>
  new Date(value).toLocaleString(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "UTC",
  }) + " UTC";
const statuses = {
  pending: "Still waiting",
  finalized: "Finalized — check collection",
  claimed: "Already claimed",
  closed: "Request closed",
  invalid: "Request invalid",
};

function decimal(value: string, places: number): bigint | null {
  const pattern = places ? new RegExp(`^\\d+(\\.\\d{1,${places}})?$`) : /^\d+$/;
  return pattern.test(value) ? parseUnits(value, places) : null;
}

function BuyerCeiling({ observation }: { observation: ClaimObservation }) {
  const [currency, setCurrency] = useState("ETH");
  const [inputs, setInputs] = useState({
    recovery: "",
    days: "",
    hurdle: "",
    haircut: "",
    upfront: "",
    collection: "",
    reserve: "",
    fee: "",
    sellerGas: "",
  });
  const change = (key: keyof typeof inputs, value: string) =>
    setInputs((old) => ({ ...old, [key]: value }));
  const fields: {
    key: keyof typeof inputs;
    label: string;
    unit: string;
    precision: number;
  }[] = [
    {
      key: "recovery",
      label: "Assumed eventual proceeds",
      unit: `${currency} · your recovery assumption`,
      precision: 18,
    },
    {
      key: "days",
      label: "Remaining wait from now",
      unit: "days · your assumption",
      precision: 6,
    },
    {
      key: "hurdle",
      label: "Required annual return",
      unit: "% · simple capital hurdle",
      precision: 2,
    },
    {
      key: "haircut",
      label: "Additional recovery haircut",
      unit: "% of assumed proceeds",
      precision: 2,
    },
    {
      key: "upfront",
      label: "Buyer upfront costs",
      unit: `${currency} · gas and execution`,
      precision: 18,
    },
    {
      key: "collection",
      label: "Buyer collection costs",
      unit: `${currency} · future servicing`,
      precision: 18,
    },
    {
      key: "reserve",
      label: "Additional risk reserve",
      unit: `${currency} · capital buffer`,
      precision: 18,
    },
    {
      key: "fee",
      label: "Assumed protocol fee",
      unit: "basis points · 100 bps = 1%",
      precision: 0,
    },
    {
      key: "sellerGas",
      label: "Seller transaction costs",
      unit: `${currency} · gas and execution`,
      precision: 18,
    },
  ];
  const values = Object.fromEntries(
    fields.map((field) => [
      field.key,
      decimal(inputs[field.key], field.precision),
    ]),
  ) as Record<keyof typeof inputs, bigint | null>;
  const complete = Object.values(values).every((value) => value !== null);
  let result: ReturnType<typeof purchaseCeiling> | null = null;
  let error = "";
  if (complete) {
    try {
      result = purchaseCeiling({
        expectedRecovery: values.recovery!,
        remainingSeconds: (values.days! * 86_400n + 999_999n) / 1_000_000n,
        annualHurdleBps: values.hurdle!,
        recoveryHaircutBps: values.haircut!,
        buyerUpfrontCosts: values.upfront!,
        buyerCollectionCosts: values.collection!,
        riskReserve: values.reserve!,
        protocolFeeBps: values.fee!,
        sellerTransactionCosts: values.sellerGas!,
      });
    } catch {
      error = "Haircut and protocol fee must each be between 0% and 100%.";
    }
  }
  return (
    <details className="ec-calculator">
      <summary>
        <span>Estimate a buyer ceiling</span>
        <small>Your assumptions, kept in this tab</small>
      </summary>
      <div className="ec-calculator-body">
        <p>
          This estimates what a hypothetical buyer could pay under your
          assumptions. It is not an offer, market valuation or yield prediction.
          No funded EXIT buyer is confirmed.
        </p>
        <label className="ec-field ec-currency">
          Calculation currency
          <select
            aria-label="Calculation currency"
            value={currency}
            onChange={(event) => setCurrency(event.target.value)}
          >
            <option>ETH</option>
            <option>WETH</option>
          </select>
        </label>
        <p className="ec-caption">
          ETH and WETH use equivalent economic units here. Include wrapping
          costs where relevant. No USD conversion. Request face is{" "}
          {eth(observation.requestedWei)} ETH; eventual recovery may differ.
        </p>
        <div className="ec-input-grid">
          {fields.map((field) => (
            <label className="ec-field" key={field.key}>
              {field.label}
              <input
                aria-label={field.label}
                type="text"
                inputMode="decimal"
                maxLength={96}
                value={inputs[field.key]}
                onChange={(event) => change(field.key, event.target.value)}
                aria-describedby={`ec-help-${field.key}`}
              />
              <small id={`ec-help-${field.key}`}>{field.unit}</small>
            </label>
          ))}
        </div>
        {error ? (
          <p className="ec-error" role="alert">
            {error}
          </p>
        ) : result ? (
          <section className="ec-ceiling" aria-label="Assumed buyer ceiling">
            <span>Assumed seller payment ceiling</span>
            <strong>
              {eth(result.sellerPayment)} <small>{currency}</small>
            </strong>
            <dl>
              <div>
                <dt>After seller transaction costs</dt>
                <dd>
                  {eth(result.sellerEffectiveProceeds)} {currency}
                </dd>
              </div>
              <div>
                <dt>Assumed protocol fee</dt>
                <dd>
                  {eth(result.protocolFee)} {currency}
                </dd>
              </div>
              <div>
                <dt>Purchase and upfront costs · excludes reserve</dt>
                <dd>
                  {eth(result.buyerCapitalRequired)} {currency}
                </dd>
              </div>
              <div>
                <dt>Recovery after haircut</dt>
                <dd>
                  {eth(result.stressedRecovery)} {currency}
                </dd>
              </div>
            </dl>
            <p>
              No seller acceptance price is known. A positive ceiling does not
              establish a trade, available capital or transferable rights. No
              maximum source wait is promised.
            </p>
          </section>
        ) : (
          <p className="ec-caption">
            Enter every assumption to calculate; enter 0 explicitly where
            appropriate. Monetary inputs accept up to 18 decimals, percentages
            2, days 6, and basis points whole numbers.
          </p>
        )}
        <p className="ec-local-note">
          These assumptions are not sent, saved, signed or put in the URL.
          Changing the claim or reloading clears them.
        </p>
      </div>
    </details>
  );
}

function Observation({ value }: { value: ClaimObservation }) {
  const active = value.status === "pending" || value.status === "finalized";
  const config = SOURCES[value.source];
  const ageDays = value.requestTimestamp
    ? Math.max(
        0,
        Math.floor(
          (Date.parse(value.blockTimestamp) -
            Date.parse(value.requestTimestamp)) /
            86_400_000,
        ),
      )
    : null;
  return (
    <section className="ec-observation" aria-label="Withdrawal observation">
      <div className="ec-result-top">
        <div>
          <span className="ec-eyebrow">{value.sourceName}</span>
          <h2>Withdrawal #{value.id}</h2>
        </div>
        <span className={`ec-state ${value.status}`}>
          {statuses[value.status]}
        </span>
      </div>
      {!value.implementationMatchesReview && (
        <div className="ec-alert" role="alert">
          <strong>Source implementation changed</strong>
          <p>
            The source differs from the implementation reviewed at block{" "}
            {CLAIM_REVIEW_BLOCK}. These reads do not establish acquisition
            eligibility. The buyer calculator is unavailable until the new
            implementation is reviewed.
          </p>
        </div>
      )}
      <div className="ec-receipt">
        <div className="ec-value">
          <span>
            {value.status === "finalized"
              ? "Source-reported finalized amount"
              : "Request face · ETH units"}
          </span>
          <strong>
            {value.status === "finalized" && value.claimableWei !== null
              ? eth(value.claimableWei)
              : eth(value.requestedWei)}{" "}
            <small>ETH</small>
          </strong>
          <p>
            {value.status === "finalized"
              ? "Exact source-reported amount at this block. Collection execution has not been simulated; network gas is separate."
              : active
                ? "Historical request amount, not a promise of eventual payment."
                : "Historical or deleted request record; this is not a remaining payout valuation."}
          </p>
        </div>
        <dl className="ec-facts">
          {value.status === "finalized" && (
            <div>
              <dt>Original request face</dt>
              <dd>{eth(value.requestedWei)} ETH</dd>
            </div>
          )}
          <div>
            <dt>Current NFT owner</dt>
            <dd>
              {value.owner ? (
                <a
                  href={`https://etherscan.io/address/${value.owner}`}
                  target="_blank"
                  rel="noreferrer"
                >
                  {value.owner}
                </a>
              ) : (
                "No current owner reported"
              )}
            </dd>
          </div>
          <div>
            <dt>Request age at observed block</dt>
            <dd>
              {ageDays === null
                ? "Not available from this source read"
                : `${ageDays} completed day${ageDays === 1 ? "" : "s"}`}
            </dd>
          </div>
          {value.requestTimestamp && (
            <div>
              <dt>Requested</dt>
              <dd>
                <time dateTime={value.requestTimestamp}>
                  {displayTime(value.requestTimestamp)}
                </time>
              </dd>
            </div>
          )}
        </dl>
        <div className="ec-perforation" />
        <div className="ec-stamp">
          <span>Ethereum mainnet · read only</span>
          <a
            href={`https://etherscan.io/block/${value.blockNumber}`}
            target="_blank"
            rel="noreferrer"
          >
            Block {value.blockNumber} ↗
          </a>
          <time dateTime={value.blockTimestamp}>
            {displayTime(value.blockTimestamp)}
          </time>
          <small>Checked {displayTime(value.observedAt)}</small>
        </div>
      </div>
      <div className="ec-next">
        {value.status === "finalized" ? (
          <>
            <h3>Direct collection comes first</h3>
            <p>
              The source marks this request finalized. Collection execution has
              not been simulated: account restrictions and execution conditions
              may still prevent collection. The entitled owner can review the
              official application. EXIT does not submit a transaction here.
            </p>
            <a
              className="ec-button"
              href={config.app}
              target="_blank"
              rel="noreferrer"
            >
              Review collection at{" "}
              {value.source === "lido" ? "Lido" : "ether.fi"} ↗
            </a>
          </>
        ) : value.status === "pending" ? (
          <>
            <h3>The wait remains with this claim</h3>
            <p>
              Request age is not an estimate of time left. No remaining ETA is
              inferred here. A DEX sale or cancellation is not offered for this
              existing NFT.
            </p>
            <p>
              <strong>No funded EXIT buyer is confirmed.</strong> This check
              does not establish a sale price or promise that a buyer can
              acquire the claim.
            </p>
          </>
        ) : (
          <>
            <h3>No purchase estimate for this record</h3>
            <p>
              {value.status === "claimed"
                ? "The source marks this request as claimed. It is not an open withdrawal for sale."
                : value.status === "closed"
                  ? "The request record has been deleted. This alone does not prove a payout amount or recipient."
                  : "The source marks this request invalid. Resolve its status with the source; a discount does not repair invalid rights."}
            </p>
          </>
        )}
      </div>
      {value.status === "pending" && value.implementationMatchesReview && (
        <BuyerCeiling observation={value} />
      )}
      <details className="ec-source-details">
        <summary>Source and verification details</summary>
        <dl className="ec-facts">
          <div>
            <dt>Withdrawal contract</dt>
            <dd>
              <a
                href={`https://etherscan.io/address/${value.contract}`}
                target="_blank"
                rel="noreferrer"
              >
                {value.contract}
              </a>
            </dd>
          </div>
          <div>
            <dt>Observed implementation</dt>
            <dd>{value.implementation}</dd>
          </div>
          <div>
            <dt>Reviewed implementation</dt>
            <dd>
              {value.implementationMatchesReview
                ? "Matches the reviewed address; not an audit or eligibility guarantee"
                : "Does not match"}
            </dd>
          </div>
        </dl>
        <a href={config.docs} target="_blank" rel="noreferrer">
          Read source documentation ↗
        </a>
      </details>
    </section>
  );
}

export default function ExitCheck() {
  const params = new URLSearchParams(window.location.search);
  const [source, setSource] = useState<ClaimSource>(
    params.get("source") === "etherfi" ? "etherfi" : "lido",
  );
  const [id, setId] = useState(
    /^\d{1,78}$/.test(params.get("id") ?? "") ? params.get("id")! : "",
  );
  const [observation, setObservation] = useState<ClaimObservation | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [example, setExample] = useState(false);
  const request = useRef(0);
  const clear = () => {
    request.current += 1;
    setObservation(null);
    setError("");
    setLoading(false);
    setExample(false);
  };
  const inspect = async (
    selectedSource = source,
    selectedId = id,
    publicExample = false,
  ) => {
    const sequence = ++request.current;
    setObservation(null);
    setError("");
    setLoading(true);
    setExample(publicExample);
    try {
      const value = await inspectClaim(selectedSource, selectedId);
      if (sequence === request.current) setObservation(value);
    } catch (cause) {
      if (sequence !== request.current) return;
      const message = cause instanceof Error ? cause.message : "";
      setError(
        message === "Enter a positive withdrawal NFT ID." ||
          message === "This withdrawal NFT ID has not been issued."
          ? message
          : "Ethereum source read unavailable. The RPC may be blocked, or the source could not be read at a confirmed block. No cached example has been substituted. Try again or inspect the official source.",
      );
    } finally {
      if (sequence === request.current) setLoading(false);
    }
  };
  return (
    <div className="exit-check">
      <a className="ec-skip" href="#ec-main">
        Skip to withdrawal check
      </a>
      <header className="ec-header">
        <a
          className="ec-logo"
          href="/?check=1"
          aria-label="EXIT withdrawal check"
        >
          EXIT <span>↗</span>
        </a>
        <span className="ec-header-label">Withdrawal check</span>
        <span className="ec-readonly">
          <i />
          Read only · Ethereum
        </span>
      </header>
      <main id="ec-main">
        <div className="ec-intro">
          <span className="ec-eyebrow">Know what you can do next</span>
          <h1>
            Check a queued
            <br />
            withdrawal.
          </h1>
          <p>
            Inspect an existing withdrawal NFT, see whether the source has
            finalized it, and separate the facts from the assumptions.
          </p>
        </div>
        <div className="ec-layout">
          <aside className="ec-inspector" aria-label="Choose a withdrawal">
            <span className="ec-step">01 / The claim</span>
            <form
              onSubmit={(event) => {
                event.preventDefault();
                void inspect();
              }}
            >
              <label className="ec-field">
                Withdrawal source
                <select
                  aria-label="Withdrawal source"
                  value={source}
                  onChange={(event) => {
                    clear();
                    setSource(event.target.value as ClaimSource);
                  }}
                >
                  <option value="lido">Lido unstETH</option>
                  <option value="etherfi">ether.fi withdrawal NFT</option>
                </select>
              </label>
              <label className="ec-field">
                Withdrawal NFT ID
                <input
                  type="text"
                  inputMode="numeric"
                  maxLength={78}
                  placeholder="e.g. 135118"
                  value={id}
                  onChange={(event) => {
                    clear();
                    setId(event.target.value);
                  }}
                  required
                  aria-describedby="ec-id-help"
                />
              </label>
              <p id="ec-id-help" className="ec-caption">
                Use the token ID from your source withdrawal receipt. This is
                not a wallet address.
              </p>
              <button
                className="ec-button ec-primary"
                type="submit"
                disabled={loading}
              >
                {loading ? "Reading Ethereum…" : "Check withdrawal"}
                <span aria-hidden="true">↗</span>
              </button>
            </form>
            <p className="ec-read-note">
              No wallet connection or signature. Reads go directly to a public
              Ethereum RPC.
            </p>
            <button
              className="ec-example"
              onClick={() => {
                clear();
                setSource("lido");
                setId("135118");
                void inspect("lido", "135118", true);
              }}
            >
              Inspect a public example <span aria-hidden="true">↗</span>
            </button>
            <p className="ec-caption">
              Lido #135118 · a public record, not a claim attributed to you. Its
              current state may change.
            </p>
          </aside>
          <div className="ec-results">
            {loading && (
              <div className="ec-loading" role="status">
                <span className="ec-step">02 / Read the source</span>
                <h2>Checking this claim…</h2>
                <p>
                  Reading ownership and status at one confirmed Ethereum block.
                </p>
              </div>
            )}
            {error && (
              <div className="ec-error-panel" role="alert">
                <h2>Unable to inspect this withdrawal</h2>
                <p>{error}</p>
                <a href={SOURCES[source].app} target="_blank" rel="noreferrer">
                  Open official source ↗
                </a>
              </div>
            )}
            {observation && (
              <>
                {example && (
                  <p className="ec-example-notice">
                    Public example inspected. The owner shown below is not
                    assumed to be you.
                  </p>
                )}
                <Observation
                  key={`${observation.source}:${observation.id}:${observation.observedAt}`}
                  value={observation}
                />
              </>
            )}
            {!loading && !error && !observation && (
              <section
                className="ec-empty"
                aria-label="What this check can establish"
              >
                <span className="ec-step">02 / Facts before a decision</span>
                <div className="ec-empty-symbol" aria-hidden="true">
                  ↗
                </div>
                <h2>
                  A withdrawal is a right.
                  <br />
                  Check its current state.
                </h2>
                <ul>
                  <li>
                    <span>01</span>Who owns this NFT now?
                  </li>
                  <li>
                    <span>02</span>Has the source finalized it?
                  </li>
                  <li>
                    <span>03</span>What would a buyer need to assume?
                  </li>
                </ul>
                <p>
                  This validation tool has no purchase offers or connected
                  buyers. It does not move assets.
                </p>
              </section>
            )}
          </div>
        </div>
      </main>
      <footer className="ec-footer">
        <span>EXIT · Let the buyer wait.</span>
        <nav aria-label="Other EXIT environments">
          <a href="/">Local trading demo ↗</a>
          <a href="/?preview=1">Design preview ↗</a>
        </nav>
        <small>
          This screen reads Ethereum mainnet. The separate demo uses test
          assets.
        </small>
      </footer>
    </div>
  );
}
