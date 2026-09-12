// Read-only public query. The synthetic routing address proves query support, not a deployed job.
import { createPublicClient } from "@arkiv-network/sdk";
import { tiramisu } from "@arkiv-network/sdk/chains";
import { http } from "viem";
import {
  arkivAssignmentDriver,
  assignmentQuery,
  type AssignmentFilter,
} from "./assignment";
const start = Date.now();
const filter: AssignmentFilter = {
  taskClass: "document-review",
  qualificationClass: "1",
  settlementChain: 43113,
  escrow: `0x${"22".repeat(20)}`,
};
const now = Math.floor(start / 1000);
const report: Record<string, unknown> = {
  observedAt: new Date(start).toISOString(),
  environment: "public-arkiv",
  sdk: "0.8.1",
  syntheticRoutingAddress: true,
  filter,
  query: assignmentQuery(filter, now).map(String).join(" AND "),
  writesAttempted: 0,
  nativeExpiryObserved: false,
  availableAssignmentsVerified: 0,
};
try {
  const read = createPublicClient({
    chain: tiramisu,
    transport: http(undefined, { timeout: 12000, retryCount: 0 }),
  });
  report.chainId = await read.getChainId();
  report.block = (await read.getBlockNumber()).toString();
  let page = await arkivAssignmentDriver({}).query(filter, now),
    pages = 0,
    entities = 0;
  for (;;) {
    pages++;
    entities += page.entities.length;
    if (!page.hasNextPage()) break;
    page = await page.next();
  }
  report.queryStatus = "passed";
  report.pages = pages;
  report.entities = entities;
} catch {
  report.queryStatus = "failed";
  report.error = "Public assignment query failed; provider details withheld";
  process.exitCode = 1;
}
report.elapsedMs = Date.now() - start;
console.log(JSON.stringify(report, null, 2));
