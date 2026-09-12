// SPDX-License-Identifier: MIT
import { createPublicClient, http, sha256, bytesToHex } from "viem";
import { createSwarmStorage, type StorageRef } from "../swarm-id";
import { encodeTerms, matchTerms } from "../terms";

export type PublicReadConfig = Record<string, unknown> & {
  status: "pending" | "active";
  chainId: number;
  rpcUrl?: string;
  gatewayUrl?: string;
  storageMode?: string;
  escrow?: string;
  token?: string;
  snapshot?: StorageRef;
  abi?: { QualificationEscrow: readonly unknown[] };
};
type Block = { number: bigint | null; hash: string | null };
export type ReadDependencies = {
  chain?: {
    getChainId(): Promise<number>;
    getBlock(
      args: { blockTag: "finalized" } | { blockNumber: bigint },
    ): Promise<Block>;
    readContract(args: Record<string, unknown>): Promise<unknown>;
  };
  download?: (ref: StorageRef) => Promise<Uint8Array>;
  timeoutMs?: number;
};
export type APIResult = { status: number; body: unknown };
// Leave room for JSON metadata beneath Vercel’s 4.5 MB function response limit.
const MAX_HOSTED_BYTES = 4 * 1024 * 1024;
const ZERO = `0x${"0".repeat(64)}`;
const publicKeys = [
  "version",
  "status",
  "reason",
  "browserProver",
  "publication",
  "environment",
  "testOnly",
  "chainId",
  "rpcUrl",
  "escrow",
  "keyRegistry",
  "token",
  "verifier",
  "issuer",
  "arbitrator",
  "snapshot",
  "storageMode",
  "gatewayUrl",
  "deploymentBlock",
  "arkiv",
  "abi",
];
class APIError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
  }
}
const fail = (status: number, message: string): never => {
  throw new APIError(status, message);
};
function httpsEndpoint(input: unknown) {
  const value = new URL(String(input));
  if (
    value.protocol !== "https:" ||
    value.username ||
    value.password ||
    value.search ||
    value.hash
  )
    throw Error("Public API requires credential-free HTTPS endpoints");
}
function reference(value: unknown, digest: unknown): StorageRef {
  if (
    typeof value !== "string" ||
    !/^0x[a-f0-9]{64}$/i.test(value) ||
    value === ZERO ||
    typeof digest !== "string" ||
    !/^0x[a-f0-9]{64}$/i.test(digest) ||
    digest === ZERO
  )
    fail(
      404,
      "No authenticated public document is committed for this assignment.",
    );
  return {
    reference: (value as string).slice(2),
    sha256: digest as `0x${string}`,
  };
}

/** Read-only public serverless API. The caller supplies a reviewed public config;
 * no runtime environment or deployment manifest is read by this module. */
export function createPublicReadAPI(
  config: PublicReadConfig,
  dependencies: ReadDependencies = {},
) {
  // A copy stops a request consumer from mutating authority between awaits.
  const publicConfig = JSON.parse(
    JSON.stringify(
      Object.fromEntries(
        publicKeys
          .filter((key) => key in config)
          .map((key) => [key, config[key]]),
      ),
    ),
  ) as PublicReadConfig;
  if (
    !["pending", "active"].includes(publicConfig.status) ||
    publicConfig.chainId !== 43113
  )
    throw Error(
      "Hosted Review Pass requires an explicit Fuji deployment status",
    );
  if (publicConfig.status === "active") {
    if (
      publicConfig.storageMode !== "swarm-id" ||
      publicConfig.token?.toLowerCase() !==
        "0x5425890298aed601595a70ab815c96711a31bc65" ||
      !/^0x[a-f0-9]{40}$/i.test(publicConfig.escrow ?? "") ||
      !publicConfig.abi?.QualificationEscrow ||
      !publicConfig.snapshot
    )
      throw Error(
        "Active hosted configuration requires Fuji USDC, escrow, ABI and public snapshot",
      );
    httpsEndpoint(publicConfig.rpcUrl);
    httpsEndpoint(publicConfig.gatewayUrl);
    reference(
      `0x${publicConfig.snapshot.reference}`,
      publicConfig.snapshot.sha256,
    );
  }
  const timeoutMs = dependencies.timeoutMs ?? 40_000;
  if (!Number.isSafeInteger(timeoutMs) || timeoutMs < 1 || timeoutMs > 45_000)
    throw Error("Invalid public read timeout");
  const chain =
    dependencies.chain ??
    (publicConfig.status === "active"
      ? (createPublicClient({
          transport: http(publicConfig.rpcUrl, {
            timeout: 10_000,
            retryCount: 0,
          }),
        }) as unknown as ReadDependencies["chain"])
      : undefined);

  return async function request(
    path: string,
    method = "GET",
  ): Promise<APIResult> {
    let timer: ReturnType<typeof setTimeout> | undefined;
    let closed = false;
    let storage: ReturnType<typeof createSwarmStorage> | undefined;
    const alive = () => {
      if (closed) fail(504, "Public data retrieval timed out. Please retry.");
    };
    try {
      if (method !== "GET")
        return {
          status: 405,
          body: { error: "This public API supports GET only." },
        };
      if (
        path.length > 256 ||
        !path.startsWith("/api/") ||
        path.startsWith("//")
      )
        return { status: 400, body: { error: "Invalid public API request." } };
      const url = new URL(path, "https://review-pass.invalid");
      if (
        ![
          "/api/config",
          "/api/snapshot",
          "/api/terms",
          "/api/document",
        ].includes(url.pathname)
      )
        return { status: 404, body: { error: "Public API route not found." } };
      const jobRoute = ["/api/terms", "/api/document"].includes(url.pathname);
      const id = url.searchParams.get("job");
      if (
        url.hash ||
        (jobRoute
          ? url.searchParams.size !== 1 || !/^[1-9][0-9]{0,18}$/.test(id ?? "")
          : url.searchParams.size !== 0)
      )
        return {
          status: 400,
          body: { error: "Invalid assignment or query parameters." },
        };
      if (url.pathname === "/api/config")
        return { status: 200, body: structuredClone(publicConfig) };
      if (publicConfig.status === "pending")
        return {
          status: 503,
          body: {
            error:
              "Public deployment is being prepared. Live assignments and qualification data are not available yet.",
            status: "pending",
          },
        };

      const work = async (): Promise<APIResult> => {
        if ((await chain!.getChainId()) !== 43113)
          fail(503, "Settlement network could not be verified.");
        alive();
        const block = await chain!.getBlock({ blockTag: "finalized" });
        if (block.number === null || !block.hash)
          fail(503, "A finalized settlement block is unavailable.");
        alive();
        const read = (functionName: string, args?: unknown[]) =>
          chain!.readContract({
            address: publicConfig.escrow,
            abi: publicConfig.abi!.QualificationEscrow,
            functionName,
            ...(args ? { args } : {}),
            blockNumber: block.number,
          });
        const download = async (ref: StorageRef, limit: number) => {
          alive();
          storage ??= dependencies.download
            ? undefined
            : createSwarmStorage({ gatewayUrl: publicConfig.gatewayUrl });
          const bytes = await (dependencies.download
            ? dependencies.download(ref)
            : storage!.download(ref));
          alive();
          // Recheck even injected transports: HTTP success is not authenticity.
          if (
            !(bytes instanceof Uint8Array) ||
            bytes.length === 0 ||
            bytes.length > limit ||
            sha256(bytesToHex(bytes)).toLowerCase() !== ref.sha256.toLowerCase()
          )
            fail(502, "Public document failed its size or authenticity check.");
          try {
            return JSON.parse(
              new TextDecoder("utf-8", { fatal: true }).decode(bytes),
            );
          } catch {
            return fail(502, "Public document has an invalid format.");
          }
        };
        let body: unknown;
        if (url.pathname === "/api/snapshot") {
          const [current, snapshot] = await Promise.all([
            read("revocationRoot"),
            download(publicConfig.snapshot!, MAX_HOSTED_BYTES),
          ]);
          alive();
          if (
            !snapshot ||
            typeof snapshot !== "object" ||
            !/^[0-9]+$/.test(String(snapshot.root))
          )
            fail(502, "Public snapshot has an invalid format.");
          if (String(snapshot.root) !== String(current))
            fail(
              409,
              "Issuer snapshot publication is stale. The issuer must publish the current whole snapshot.",
            );
          body = snapshot;
        } else {
          const [jobValue, locator] = await Promise.all([
            read("jobs", [BigInt(id!)]),
            read(
              url.pathname === "/api/terms"
                ? "termsReferences"
                : "documentDigests",
              [BigInt(id!)],
            ),
          ]);
          alive();
          if (
            !Array.isArray(jobValue) ||
            jobValue.length < 10 ||
            !/^0x[a-f0-9]{40}$/i.test(String(jobValue[0])) ||
            BigInt(String(jobValue[0])) === 0n
          )
            fail(404, "Assignment not found.");
          const job = jobValue as unknown[];
          if (url.pathname === "/api/terms") {
            const ref = reference(locator, job[8]);
            const raw = await download(ref, 20_000);
            let encoded: ReturnType<typeof encodeTerms>;
            try {
              encoded = encodeTerms(raw);
            } catch {
              return fail(502, "Public scope has an invalid format.");
            }
            if (
              encoded.digest.toLowerCase() !== String(job[8]).toLowerCase() ||
              !matchTerms(
                encoded.terms,
                publicConfig.chainId,
                publicConfig.escrow!,
                publicConfig.token!,
                job,
              )
            )
              fail(502, "Public scope does not match the funded assignment.");
            body = { terms: encoded.terms, reference: locator, digest: job[8] };
          } else {
            const ref = reference(job[9], locator);
            body = {
              envelope: await download(ref, MAX_HOSTED_BYTES),
              digest: locator,
              reference: job[9],
            };
          }
        }
        alive();
        const canonical = await chain!.getBlock({ blockNumber: block.number! });
        alive();
        if (canonical.hash !== block.hash || canonical.number !== block.number)
          fail(503, "Settlement finality changed. Please retry.");
        return { status: 200, body };
      };
      return await Promise.race([
        work(),
        new Promise<never>((_, reject) => {
          timer = setTimeout(() => {
            closed = true;
            storage?.destroy();
            reject(
              new APIError(
                504,
                "Public data retrieval timed out. Please retry.",
              ),
            );
          }, timeoutMs);
        }),
      ]);
    } catch (error) {
      return {
        status: error instanceof APIError ? error.status : 502,
        body: {
          error:
            error instanceof APIError
              ? error.message
              : "Public data could not be verified or retrieved. Please retry.",
        },
      };
    } finally {
      closed = true;
      if (timer) clearTimeout(timer);
      storage?.destroy();
    }
  };
}
