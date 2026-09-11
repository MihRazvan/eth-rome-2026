import { mkdir, readFile, writeFile } from "node:fs/promises";
import { bytesToHex, sha256, type Hex } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import {
  createArkivIndex,
  SwarmBytes,
  type OfferServices,
  type OfferRecord,
} from "../transport";
import type { Deployment } from "./chain";
export async function createServices(d: Deployment): Promise<OfferServices> {
  if (d.environment === "fuji")
    return {
      storage: new SwarmBytes({
        uploadUrl: process.env.SWARM_UPLOAD_URL ?? "",
        retrievalUrl:
          process.env.SWARM_RETRIEVAL_URL ?? "https://api.gateway.ethswarm.org",
        postageBatchId: process.env.SWARM_POSTAGE_BATCH_ID,
      }),
      index: createArkivIndex({
        rpcUrl: process.env.ARKIV_RPC_URL,
        account: process.env.ARKIV_PRIVATE_KEY
          ? privateKeyToAccount(process.env.ARKIV_PRIVATE_KEY as Hex)
          : undefined,
      }),
    };
  // This local adapter is selected only by the manifest. There is no failed-live fallback.
  const dir = `${process.env.EXIT_DATA_DIR ?? ".runtime/local"}/local-records`;
  await mkdir(dir, { recursive: true });
  const indexPath = `${dir}/index.json`;
  let writes = Promise.resolve();
  async function rows(): Promise<{ record: OfferRecord; expires: number }[]> {
    try {
      return JSON.parse(await readFile(indexPath, "utf8"));
    } catch (e) {
      if ((e as NodeJS.ErrnoException).code === "ENOENT") return [];
      throw e;
    }
  }
  return {
    storage: {
      environment: "explicit-local-test",
      async upload(bytes) {
        const hash = sha256(bytesToHex(bytes));
        await writeFile(`${dir}/${hash.slice(2)}`, bytes);
        return { reference: hash.slice(2), sha256: hash };
      },
      async retrieve(r) {
        if (!/^[a-f0-9]{64}$/.test(r.reference))
          throw new Error("Invalid record reference");
        const bytes = new Uint8Array(await readFile(`${dir}/${r.reference}`));
        if (sha256(bytesToHex(bytes)) !== r.sha256)
          throw new Error("Record integrity mismatch");
        return bytes;
      },
    },
    index: {
      environment: "explicit-local-test",
      async publish(record, lifetime) {
        const save = writes.then(async () => {
          const all = await rows();
          all.push({ record, expires: Date.now() + lifetime * 1000 });
          await writeFile(indexPath, JSON.stringify(all));
        });
        writes = save.catch(() => {});
        await save;
        return {
          entityKey: record.reference,
          txHash: "local-index-no-transaction",
          expiresAt: BigInt(Math.ceil(Date.now() / 1000) + lifetime),
        };
      },
      async discover(c, mode) {
        return (await rows())
          .filter(
            (x) =>
              x.expires > Date.now() &&
              x.record.chainId === c.chainId &&
              x.record.market.toLowerCase() === c.market.toLowerCase() &&
              x.record.seller.toLowerCase() === c.seller.toLowerCase() &&
              x.record.requestId === c.requestId &&
              x.record.mode === mode,
          )
          .map((x) => x.record);
      },
    },
  };
}
