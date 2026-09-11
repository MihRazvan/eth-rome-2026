import { describe, expect, it, vi } from "vitest";
import { privateKeyToAccount } from "viem/accounts";
import { tiramisu } from "@arkiv-network/sdk/chains";
import {
  runPreflight,
  validateConfiguration,
  type Environment,
  type ReadProbes,
} from "./preflight";
const key = (n: number) => `0x${n.toString(16).padStart(64, "0")}` as const;
const address = (n: number) => privateKeyToAccount(key(n)).address;
const env: Environment = {
  EXIT_DEPLOYER_KEY: key(1),
  EXIT_MAKER_1_KEY: key(2),
  EXIT_MAKER_2_KEY: key(3),
  EXIT_MAKER_3_KEY: key(4),
  ARKIV_PRIVATE_KEY: key(5),
  EXIT_RPC_URL: "https://fuji.test/private-token",
  ARKIV_RPC_URL: "https://arkiv.test/?secret=redact",
  SWARM_UPLOAD_URL: "https://upload.test/?secret=redact",
  SWARM_POSTAGE_BATCH_ID: "a".repeat(64),
};
const manifest = {
  environment: "fuji",
  chainId: 43113,
  rpcUrl: "https://public.test",
  market: address(10),
  source: address(11),
  token: address(12),
  keyRegistry: address(13),
  makers: [address(2), address(3), address(4)],
};
const probes = (): ReadProbes => ({
  chainId: vi.fn(async (url) => (url.includes("arkiv") ? tiramisu.id : 43113)),
  balance: vi.fn(async () => 1n),
  code: vi.fn(async () => "0x1234" as const),
  arkivRead: vi.fn(async () => {}),
  health: vi.fn(async () => true),
});
describe("read-only live readiness", () => {
  it("rejects duplicate capital identities and invalid scalar without leaking inputs", () => {
    const checks = validateConfiguration(
      { ...env, EXIT_MAKER_2_KEY: key(2), ARKIV_PRIVATE_KEY: key(0) },
      manifest,
    );
    expect(checks.find((c) => c.id === "identities")?.status).toBe("blocked");
    expect(checks.find((c) => c.id === "key.arkiv")?.status).toBe("blocked");
    expect(JSON.stringify(checks)).not.toContain(key(2));
  });
  it("never promotes read access or positive balances to verified live writes", async () => {
    const p = probes();
    const result = await runPreflight(env, manifest, p);
    expect(result.status).toBe("unverified");
    expect(result.checks.find((c) => c.id === "balance.maker1")).toMatchObject({
      status: "passed",
      balanceWei: "1",
    });
    expect(result.checks.find((c) => c.id === "writes")?.status).toBe(
      "unverified",
    );
    for (const secret of [
      key(1),
      "private-token",
      "secret=redact",
      env.SWARM_POSTAGE_BATCH_ID!,
    ])
      expect(JSON.stringify(result)).not.toContain(secret);
    expect(p.code).toHaveBeenCalledTimes(4);
  });
  it("gates dependent reads on actual chain identity", async () => {
    const p = probes();
    p.chainId = vi.fn(async () => 1);
    const result = await runPreflight(env, manifest, p);
    expect(result.status).toBe("blocked");
    expect(p.balance).not.toHaveBeenCalled();
    expect(p.code).not.toHaveBeenCalled();
    expect(p.arkivRead).not.toHaveBeenCalled();
  });
  it("rejects empty deployed code, unfunded signers and manifest maker mismatch", async () => {
    const p = probes();
    p.code = async () => "0x";
    p.balance = async () => 0n;
    const result = await runPreflight(
      env,
      { ...manifest, makers: [address(2), address(3), address(99)] },
      p,
    );
    expect(
      result.checks
        .filter((c) => c.id.startsWith("code."))
        .every((c) => c.status === "blocked"),
    ).toBe(true);
    expect(result.checks.find((c) => c.id === "balance.deployer")?.status).toBe(
      "blocked",
    );
    expect(result.checks.find((c) => c.id === "manifest.makers")?.status).toBe(
      "blocked",
    );
  });
  it("withholds hostile provider errors including their name", async () => {
    const p = probes();
    p.chainId = async () => {
      const e = new Error(key(1));
      e.name = env.ARKIV_RPC_URL!;
      throw e;
    };
    const result = await runPreflight(env, manifest, p);
    expect(JSON.stringify(result)).not.toContain("secret=redact");
    expect(JSON.stringify(result)).not.toContain(key(1));
    expect(result.status).toBe("blocked");
  });
  it("validates missing config, URLs, scalar boundaries and manifest shape safely", () => {
    const empty = validateConfiguration({}, null);
    expect(
      empty.some((c) => c.id === "manifest" && c.status === "blocked"),
    ).toBe(true);
    const invalid = validateConfiguration(
      {
        ...env,
        EXIT_DEPLOYER_KEY: "0x" + "f".repeat(64),
        SWARM_UPLOAD_URL: "file:///secret",
      },
      {
        ...manifest,
        rpcUrl: "https://user:secret@host",
        market: "0x" + "0".repeat(40),
      },
    );
    for (const id of [
      "key.deployer",
      "url.swarmUpload",
      "manifest.rpc",
      "manifest.market",
    ])
      expect(invalid.find((c) => c.id === id)?.status).toBe("blocked");
  });
});
