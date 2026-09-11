import {
  createPublicClient,
  http,
  isAddress,
  zeroAddress,
  type Address,
  type Hex,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { createPublicClient as arkivClient } from "@arkiv-network/sdk";
import { tiramisu } from "@arkiv-network/sdk/chains";
import { eq } from "@arkiv-network/sdk/query";

export type Check = {
  id: string;
  status: "passed" | "blocked" | "unverified";
  detail: string;
  address?: Address;
  balanceWei?: string;
};
export type Environment = Readonly<Record<string, string | undefined>>;
export interface ReadProbes {
  chainId(url: string): Promise<number>;
  balance(url: string, address: Address): Promise<bigint>;
  code(url: string, address: Address): Promise<Hex | undefined>;
  arkivRead(url: string): Promise<void>;
  health(url: string): Promise<boolean>;
}
const roles = ["deployer", "maker1", "maker2", "maker3", "arkiv"] as const;
const keyNames = [
  "EXIT_DEPLOYER_KEY",
  "EXIT_MAKER_1_KEY",
  "EXIT_MAKER_2_KEY",
  "EXIT_MAKER_3_KEY",
  "ARKIV_PRIVATE_KEY",
] as const;
const contractFields = ["market", "source", "token", "keyRegistry"] as const;
const addressOK = (x: unknown): x is Address =>
  typeof x === "string" && isAddress(x) && x.toLowerCase() !== zeroAddress;
function urlOK(value: string): boolean {
  try {
    const u = new URL(value);
    return ["http:", "https:"].includes(u.protocol) && !u.hash;
  } catch {
    return false;
  }
}
function inspect(env: Environment, manifest?: unknown) {
  const checks: Check[] = [];
  const accounts: Partial<Record<(typeof roles)[number], Address>> = {};
  roles.forEach((role, i) => {
    const key = env[keyNames[i]];
    if (!key)
      checks.push({
        id: `key.${role}`,
        status: "blocked",
        detail: `Configure ${keyNames[i]} with a project-only testnet signer.`,
      });
    else {
      try {
        if (!/^0x[0-9a-fA-F]{64}$/.test(key)) throw new Error();
        accounts[role] = privateKeyToAccount(key as Hex).address;
        checks.push({
          id: `key.${role}`,
          status: "passed",
          detail: "Valid signing scalar; key is never reported.",
          address: accounts[role],
        });
      } catch {
        checks.push({
          id: `key.${role}`,
          status: "blocked",
          detail: "Invalid private-key syntax or scalar.",
        });
      }
    }
  });
  const trading = roles
    .slice(0, 4)
    .map((r) => accounts[r])
    .filter(Boolean);
  checks.push({
    id: "identities",
    status:
      trading.length === 4 &&
      new Set(trading.map((a) => a!.toLowerCase())).size === 4
        ? "passed"
        : "blocked",
    detail:
      "Deployer and three makers must be four distinct identities; addresses alone do not prove independent control.",
  });
  const urls = {
    fuji: env.EXIT_RPC_URL || "https://api.avax-test.network/ext/bc/C/rpc",
    arkiv: env.ARKIV_RPC_URL || tiramisu.rpcUrls.default.http[0],
    swarmRetrieval:
      env.SWARM_RETRIEVAL_URL || "https://api.gateway.ethswarm.org",
    swarmUpload: env.SWARM_UPLOAD_URL || "",
  };
  for (const [name, url] of Object.entries(urls))
    checks.push({
      id: `url.${name}`,
      status: urlOK(url) ? "passed" : "blocked",
      detail: urlOK(url)
        ? "HTTP endpoint configured; URL withheld."
        : "Missing or invalid HTTP endpoint.",
    });
  const batchOK = /^[a-f0-9]{64}$/i.test(env.SWARM_POSTAGE_BATCH_ID ?? "");
  checks.push({
    id: "swarm.postage",
    status: batchOK ? "passed" : "blocked",
    detail: batchOK
      ? "Batch identifier syntax valid; ownership, usability and remaining capacity unverified."
      : "Configure a 64-hex-character postage batch identifier without 0x.",
  });
  const contracts: { field: string; address: Address }[] = [];
  const m =
    manifest && typeof manifest === "object" && !Array.isArray(manifest)
      ? (manifest as Record<string, unknown>)
      : undefined;
  if (!m)
    checks.push({
      id: "manifest",
      status: "blocked",
      detail:
        "Fuji deployment manifest unavailable or malformed; deploy before lifecycle verification.",
    });
  else {
    checks.push({
      id: "manifest.chain",
      status:
        m.environment === "fuji" && m.chainId === 43113 ? "passed" : "blocked",
      detail: "Live-test manifest must identify Fuji chain 43113.",
    });
    let publicUrl = false;
    try {
      const u = new URL(String(m.rpcUrl));
      publicUrl = urlOK(u.href) && !u.username && !u.password && !u.search;
    } catch {
      /* Never include parser input or errors. */
    }
    checks.push({
      id: "manifest.rpc",
      status: publicUrl ? "passed" : "blocked",
      detail:
        "Browser manifest RPC must be HTTP and contain no userinfo or query credentials; no URL is reported.",
    });
    for (const field of contractFields) {
      const valid = addressOK(m[field]);
      checks.push({
        id: `manifest.${field}`,
        status: valid ? "passed" : "blocked",
        detail: valid
          ? "Nonzero contract address configured."
          : "Missing or invalid nonzero contract address.",
      });
      if (valid && m.environment === "fuji" && m.chainId === 43113)
        contracts.push({ field, address: m[field] as Address });
    }
    checks.push({
      id: "manifest.contractsDistinct",
      status:
        contracts.length === 4 &&
        new Set(contracts.map((c) => c.address.toLowerCase())).size === 4
          ? "passed"
          : "blocked",
      detail:
        "Market, source, token and key registry require distinct deployments.",
    });
    const expected = [accounts.maker1, accounts.maker2, accounts.maker3];
    const match =
      Array.isArray(m.makers) &&
      m.makers.length === 3 &&
      m.makers.every(
        (a, i) =>
          addressOK(a) && expected[i]?.toLowerCase() === a.toLowerCase(),
      );
    checks.push({
      id: "manifest.makers",
      status: match ? "passed" : "blocked",
      detail:
        "Manifest makers must match the three configured maker identities in order.",
    });
  }
  return { checks, accounts, urls, contracts };
}
/** Pure configuration validation. Only safe fixed messages and public addresses escape. */
export function validateConfiguration(
  env: Environment,
  manifest?: unknown,
): Check[] {
  return inspect(env, manifest).checks;
}

/** All injected capabilities are reads. No signer, raw error, URL, or key reaches the report. */
export async function runPreflight(
  env: Environment,
  manifest: unknown,
  probes: ReadProbes = defaultReadProbes,
) {
  const { checks, accounts, urls, contracts } = inspect(env, manifest);
  async function chain(
    name: "fuji" | "arkiv",
    expected: number,
  ): Promise<boolean> {
    if (!urlOK(urls[name])) return false;
    try {
      const actual = await probes.chainId(urls[name]);
      checks.push({
        id: `${name}.chain`,
        status: actual === expected ? "passed" : "blocked",
        detail:
          actual === expected
            ? `Observed expected chain ${expected}.`
            : "RPC returned a different chain; dependent balance and code checks skipped.",
      });
      return actual === expected;
    } catch {
      checks.push({
        id: `${name}.chain`,
        status: "blocked",
        detail: "Chain read failed; provider detail withheld.",
      });
      return false;
    }
  }
  async function balance(role: (typeof roles)[number], url: string) {
    const address = accounts[role];
    if (!address) return;
    try {
      const value = await probes.balance(url, address);
      if (value < 0n) throw new Error();
      checks.push({
        id: `balance.${role}`,
        status: value > 0n ? "passed" : "blocked",
        address,
        balanceWei: value.toString(),
        detail:
          value > 0n
            ? "Native balance observed. Nonzero is not proof of sufficient gas for deployment or lifecycle."
            : "No native testnet gas observed.",
      });
    } catch {
      checks.push({
        id: `balance.${role}`,
        status: "blocked",
        detail: "Native balance read failed; provider detail withheld.",
      });
    }
  }
  if (await chain("fuji", 43113)) {
    await Promise.all(
      roles.slice(0, 4).map((role) => balance(role, urls.fuji)),
    );
    await Promise.all(
      contracts.map(async ({ field, address }) => {
        try {
          const code = await probes.code(urls.fuji, address);
          const present =
            typeof code === "string" &&
            /^0x[0-9a-fA-F]+$/.test(code) &&
            code.length > 2;
          checks.push({
            id: `code.${field}`,
            status: present ? "passed" : "blocked",
            address,
            detail: present
              ? "Runtime bytecode exists; ABI, implementation identity and configuration are not proven by this check."
              : "No runtime bytecode at configured address.",
          });
        } catch {
          checks.push({
            id: `code.${field}`,
            status: "blocked",
            detail: "Bytecode read failed; provider detail withheld.",
          });
        }
      }),
    );
  }
  if (await chain("arkiv", tiramisu.id)) {
    await balance("arkiv", urls.arkiv);
    try {
      await probes.arkivRead(urls.arkiv);
      checks.push({
        id: "arkiv.read",
        status: "passed",
        detail:
          "Offer-index first-page query succeeded; publication and native expiry unverified.",
      });
    } catch {
      checks.push({
        id: "arkiv.read",
        status: "blocked",
        detail: "Offer-index query failed; provider detail withheld.",
      });
    }
  }
  for (const name of ["swarmRetrieval", "swarmUpload"] as const)
    if (urlOK(urls[name])) {
      try {
        const reachable = await probes.health(urls[name]);
        checks.push({
          id: `${name}.health`,
          status: reachable ? "passed" : "unverified",
          detail: reachable
            ? "Health endpoint reachable; ordinary-byte retrieval and upload authorization remain unverified."
            : "Health response inconclusive; no upload or retrieval attempted.",
        });
      } catch {
        checks.push({
          id: `${name}.health`,
          status: "unverified",
          detail:
            "Health read failed; provider detail withheld. Upload capability not inferred.",
        });
      }
    }
  checks.push({
    id: "writes",
    status: "unverified",
    detail:
      "Read-only run: Fuji lifecycle, Arkiv create/native expiry, Swarm upload/retrieve integrity and postage usability were not executed.",
  });
  return {
    observedAt: new Date().toISOString(),
    mode: "read-only-live-preflight",
    status: checks.some((c) => c.status === "blocked")
      ? "blocked"
      : "unverified",
    checks: checks.sort((a, b) => a.id.localeCompare(b.id)),
  };
}
const client = (url: string) =>
  createPublicClient({
    transport: http(url, { timeout: 12000, retryCount: 0 }),
  });
export const defaultReadProbes: ReadProbes = {
  chainId: (url) => client(url).getChainId(),
  balance: (url, address) => client(url).getBalance({ address }),
  code: (url, address) => client(url).getCode({ address }),
  async arkivRead(url) {
    await arkivClient({
      chain: tiramisu,
      transport: http(url, { timeout: 12000, retryCount: 0 }),
    })
      .select({ key: true })
      .where(eq("app", "exit"), eq("kind", "offer"))
      .limit(1)
      .fetch();
  },
  async health(url) {
    const target = new URL(url);
    target.pathname = target.pathname.replace(/\/$/, "") + "/health";
    return (
      await fetch(target, {
        method: "GET",
        signal: AbortSignal.timeout(12000),
        redirect: "error",
      })
    ).ok;
  },
};
