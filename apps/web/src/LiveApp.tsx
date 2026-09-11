import { useEffect, useRef, useState } from "react";
import App from "./App";
import {
  ExitController,
  unavailable,
} from "../../../packages/client/controller";
import type { AppData } from "./model";
export default function LiveApp() {
  const [data, setData] = useState<AppData>(unavailable),
    [error, setError] = useState(""),
    [keyClaim, setKeyClaim] = useState("");
  const ref = useRef<ExitController | null>(null);
  if (!ref.current) ref.current = new ExitController(setData);
  const controller = ref.current;
  useEffect(() => {
    void controller.start();
    const timer = setInterval(() => {
      if (!controller.data.loading) void controller.refresh().catch(() => {});
    }, 10000);
    return () => {
      clearInterval(timer);
      controller.dispose();
    };
  }, [controller]);
  const invoke = async (fn: () => Promise<unknown>) => {
    setError("");
    try {
      await fn();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Action unavailable");
    }
  };
  const owned = data.claims.filter((c) => c.isOwner);
  const id = keyClaim || owned[0]?.id;
  return (
    <>
      {data.environment === "local" && (
        <div className="local-controls">
          <strong>Local test wallets</strong>
          <span>Actual transactions · isolated chain</span>
          <select
            aria-label="Local demo wallet"
            value={
              data.wallet
                ? String(
                    [
                      "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266",
                      "0x70997970C51812dc3A010C7d01b50e0d17dc79C8",
                      "0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC",
                      "0x90F79bf6EB2c4f870365E785982E1f101E93b906",
                    ].findIndex(
                      (x) => x.toLowerCase() === data.wallet?.toLowerCase(),
                    ),
                  )
                : "visitor"
            }
            onChange={(e) =>
              void invoke(() =>
                controller.selectLocalWallet(Number(e.target.value)),
              )
            }
          >
            <option value="visitor" disabled>
              Browse without connecting
            </option>
            <option value="0">Seller</option>
            <option value="1">Maker A</option>
            <option value="2">Maker B</option>
            <option value="3">Maker C</option>
          </select>
        </div>
      )}
      {error && (
        <div role="alert" className="local-controls">
          {error}
        </div>
      )}
      {data.environment === "unavailable" && !data.loading && (
        <div className="local-controls">
          <a href="?preview=1">Open labelled visual preview</a>
          <a href="https://github.com/MihRazvan/eth-rome-2026#run-the-real-local-product">
            Run the local onchain demo
          </a>
        </div>
      )}
      <App data={data} actions={controller.actions} />
      {data.wallet && controller.authoredOrders.length > 0 && (
        <section className="device-keys" aria-label="Your signed offers">
          <h2>Your signed offers</h2>
          <p>
            These are offers you authored on this browser. Cancellation is
            onchain and separate from key revocation.
          </p>
          {controller.authoredOrders.map((o) => (
            <div className="authored-order" key={o.nonce}>
              <span>
                Claim #{o.claimId} · {o.net} test USDC ·{" "}
                {o.closed
                  ? "Cancelled or consumed"
                  : o.deadline < Date.now()
                    ? "Expired"
                    : "Signature active"}
              </span>
              <button
                disabled={o.closed}
                onClick={() =>
                  void invoke(() => controller.cancelAuthored(o.nonce))
                }
              >
                Cancel offer for claim {o.claimId}
              </button>
            </div>
          ))}
        </section>
      )}

      {data.wallet && owned.length > 0 && (
        <details className="device-keys">
          <summary>Private offer device keys</summary>
          <p>
            Keys stay in this browser. Wallet reconnection cannot recover a lost
            key. Rotation and revocation stop new encryption; they do not erase
            old offers or cancel signed quotes.
          </p>
          <label>
            Request{" "}
            <select
              aria-label="Private key request"
              value={id}
              onChange={(e) => setKeyClaim(e.target.value)}
            >
              {owned.map((c) => (
                <option key={c.id} value={c.id}>
                  Claim #{c.id}
                </option>
              ))}
            </select>
          </label>
          <button onClick={() => void invoke(() => controller.rotateKey(id))}>
            Rotate device key
          </button>
          <button onClick={() => void invoke(() => controller.revokeKey(id))}>
            Revoke for new offers
          </button>
        </details>
      )}
    </>
  );
}
