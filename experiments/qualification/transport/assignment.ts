import { createPublicClient, createWalletClient } from "@arkiv-network/sdk";
import { tiramisu } from "@arkiv-network/sdk/chains";
import { u64 } from "@arkiv-network/sdk/attr";
import { eq, gt } from "@arkiv-network/sdk/query";
import { ExpirationTime } from "@arkiv-network/sdk/utils";
import { http, type Account, type Hex } from "viem";
import type { ContentRef } from "./bytes";

export const taskClasses = [
  "document-review",
  "technical-review",
  "translation-review",
] as const;
export type Assignment = {
  taskClass: (typeof taskClasses)[number];
  qualificationClass: string;
  reward: string;
  paymentToken: Hex;
  acceptBefore: number;
  settlementChain: number;
  escrow: Hex;
  jobId: string;
  encryptedBrief: ContentRef;
};
export type AssignmentFilter = Pick<
  Assignment,
  "taskClass" | "qualificationClass" | "settlementChain" | "escrow"
>;
const uint = (v: unknown): v is string =>
  typeof v === "string" &&
  /^(0|[1-9][0-9]{0,77})$/.test(v) &&
  BigInt(v) < 2n ** 256n;
const classId = (v: unknown): v is string => uint(v) && BigInt(v) < 2n ** 32n;
const address = (v: unknown): v is Hex =>
  typeof v === "string" && /^0x[0-9a-f]{40}$/i.test(v) && !/^0x0{40}$/i.test(v);
const clock = (v: number) =>
  Number.isSafeInteger(v) && v > 0 && v <= 8640000000000;
/** Explicit projection, including nested references. Never spread caller objects into public payloads. */
export function publicAssignment(value: Assignment): Assignment {
  if (
    !value ||
    !taskClasses.includes(value.taskClass) ||
    !classId(value.qualificationClass) ||
    !uint(value.reward) ||
    BigInt(value.reward) === 0n ||
    !uint(value.jobId) ||
    !address(value.paymentToken) ||
    !address(value.escrow) ||
    !clock(value.acceptBefore) ||
    !Number.isSafeInteger(value.settlementChain) ||
    value.settlementChain <= 0 ||
    !/^[0-9a-f]{64}$/i.test(value.encryptedBrief?.reference) ||
    !/^0x[0-9a-f]{64}$/i.test(value.encryptedBrief?.sha256)
  )
    throw Error("Invalid public assignment");
  return {
    taskClass: value.taskClass,
    qualificationClass: value.qualificationClass,
    reward: value.reward,
    paymentToken: value.paymentToken.toLowerCase() as Hex,
    acceptBefore: value.acceptBefore,
    settlementChain: value.settlementChain,
    escrow: value.escrow.toLowerCase() as Hex,
    jobId: value.jobId,
    encryptedBrief: {
      reference: value.encryptedBrief.reference.toLowerCase(),
      sha256: value.encryptedBrief.sha256.toLowerCase() as Hex,
    },
  };
}
export function assignmentAttributes(value: Assignment) {
  const a = publicAssignment(value);
  return {
    application: "review-pass",
    kind: "assignment",
    schema: 1,
    taskClass: a.taskClass,
    qualificationClass: a.qualificationClass,
    settlementChain: a.settlementChain,
    escrow: a.escrow,
    jobId: a.jobId,
    acceptBefore: u64(BigInt(a.acceptBefore)),
  };
}
export function assignmentQuery(filter: AssignmentFilter, now: number) {
  if (
    !taskClasses.includes(filter.taskClass) ||
    !classId(filter.qualificationClass) ||
    !address(filter.escrow) ||
    !Number.isSafeInteger(filter.settlementChain) ||
    filter.settlementChain <= 0 ||
    !clock(now)
  )
    throw Error("Invalid assignment query");
  return [
    eq("application", "review-pass"),
    eq("kind", "assignment"),
    eq("schema", 1),
    eq("taskClass", filter.taskClass),
    eq("qualificationClass", filter.qualificationClass),
    eq("settlementChain", filter.settlementChain),
    eq("escrow", filter.escrow.toLowerCase()),
    gt("acceptBefore", u64(BigInt(now))),
  ];
}
export type AssignmentPage = {
  entities: readonly { key: Hex; payload?: Uint8Array }[];
  hasNextPage(): boolean;
  next(): Promise<AssignmentPage>;
};
export type AssignmentDriver = {
  environment: "public-arkiv" | "local-test";
  query(filter: AssignmentFilter, now: number): Promise<AssignmentPage>;
  publish(value: Assignment): Promise<{ entityKey: Hex }>;
};
/** Must read the configured settlement chain and escrow: job Open, funded reward/token/class/deadline match,
 * encrypted brief is authenticated by contract terms, and block.timestamp < acceptBefore.
 * A true return is a point-in-time observation, never a reservation or substitute for contract acceptance. */
export type VerifyAssignment = (advertisement: Assignment) => Promise<boolean>;
export function assignmentIndex(
  driver: AssignmentDriver,
  verify: VerifyAssignment,
  now = () => Math.floor(Date.now() / 1000),
) {
  return {
    environment: driver.environment,
    async publish(value: Assignment) {
      const a = publicAssignment(value);
      if (a.acceptBefore <= now())
        throw Error("Assignment acceptance deadline passed");
      try {
        if (!(await verify(a)) || a.acceptBefore <= now()) throw Error();
        return await driver.publish(a);
      } catch {
        throw Error("Assignment publication blocked or failed; no fallback");
      }
    },
    async discover(
      filter: AssignmentFilter,
    ): Promise<{ entityKey: Hex; assignment: Assignment }[]> {
      assignmentQuery(filter, now());
      try {
        let page = await driver.query(filter, now());
        const result: { entityKey: Hex; assignment: Assignment }[] = [];
        const seen = new Set<string>();
        for (;;) {
          for (const entity of page.entities) {
            let a: Assignment;
            try {
              if (!entity.payload || entity.payload.length > 4096) continue;
              a = publicAssignment(
                JSON.parse(
                  new TextDecoder("utf-8", { fatal: true }).decode(
                    entity.payload,
                  ),
                ),
              );
            } catch {
              continue;
            }
            if (
              a.taskClass !== filter.taskClass ||
              a.qualificationClass !== filter.qualificationClass ||
              a.settlementChain !== filter.settlementChain ||
              a.escrow !== filter.escrow.toLowerCase() ||
              a.acceptBefore <= now()
            )
              continue;
            const id = `${a.settlementChain}:${a.escrow}:${a.jobId}`;
            if (seen.has(id) || !(await verify(a)) || a.acceptBefore <= now())
              continue;
            seen.add(id);
            result.push({ entityKey: entity.key, assignment: a });
          }
          if (!page.hasNextPage()) return result;
          page = await page.next();
        }
      } catch {
        throw Error(
          "Assignment discovery or authoritative verification failed; no fallback",
        );
      }
    },
  };
}
export function arkivAssignmentDriver(config: {
  rpcUrl?: string;
  account?: Account;
}): AssignmentDriver {
  const read = createPublicClient({
    chain: tiramisu,
    transport: http(config.rpcUrl, { timeout: 12000, retryCount: 0 }),
  });
  async function network() {
    if ((await read.getChainId()) !== tiramisu.id)
      throw Error("Wrong Arkiv chain");
  }
  return {
    environment: "public-arkiv",
    async query(filter, now) {
      try {
        await network();
        return await read
          .select({ key: true, payload: true })
          .where(...assignmentQuery(filter, now))
          .limit(100)
          .fetch();
      } catch {
        throw Error("Arkiv assignment query failed");
      }
    },
    async publish(value) {
      if (!config.account) throw Error("Funded Arkiv account required");
      const a = publicAssignment(value);
      try {
        await network();
        const wallet = createWalletClient({
          chain: tiramisu,
          account: config.account,
          transport: http(config.rpcUrl, { timeout: 12000, retryCount: 0 }),
        });
        return await wallet.createEntity({
          payload: new TextEncoder().encode(JSON.stringify(a)),
          contentType: "application/json",
          attributes: assignmentAttributes(a),
          expires: ExpirationTime.atDate(new Date(a.acceptBefore * 1000)),
          flags: { readonly: true },
        });
      } catch {
        throw Error("Arkiv assignment publication failed");
      }
    },
  };
}
