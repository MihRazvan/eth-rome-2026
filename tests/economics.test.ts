import { describe, expect, it } from "vitest";
import {
  buyerOutcome,
  formatUsdc,
  parseUsdc,
  saleDifference,
} from "../apps/web/src/economics";

describe("seller sale versus expected wait proceeds", () => {
  it("compares seller net against the entire remaining entitlement", () => {
    expect(saleDifference("10000", "9960")).toEqual({
      kind: "discount",
      difference: "40",
      percentage: "0.40%",
    });
    expect(saleDifference("10000", "10040")).toEqual({
      kind: "premium",
      difference: "40",
      percentage: "0.40%",
    });
    expect(saleDifference("10000", "10000")).toEqual({
      kind: "equal",
      difference: "0",
      percentage: "0.00%",
    });
  });
  it("has no percentage denominator for a zero expected payout", () => {
    expect(saleDifference("0", "1")).toEqual({
      kind: "premium",
      difference: "1",
      percentage: null,
    });
    expect(saleDifference("0", "0")).toEqual({
      kind: "equal",
      difference: "0",
      percentage: null,
    });
  });
  it("preserves micro-USDC differences and identifies rounded percentages", () => {
    expect(saleDifference("1", "0.999999")).toEqual({
      kind: "discount",
      difference: "0.000001",
      percentage: "<0.01%",
    });
    expect(saleDifference("3", "2")).toEqual({
      kind: "discount",
      difference: "1",
      percentage: "≈33.33%",
    });
  });
  it("does not lose precision above Number.MAX_SAFE_INTEGER", () => {
    expect(
      saleDifference("9007199254740993.000001", "9007199254740993"),
    ).toMatchObject({ difference: "0.000001", kind: "discount" });
  });
});

describe("buyer hypothetical payout", () => {
  it("shows residual purchase upside, downside and break-even", () => {
    expect(buyerOutcome({ net: "5985", fee: "0" }, "6000")).toEqual({
      cost: "5985",
      breakEven: "5985",
      result: "15",
      kind: "gain",
    });
    expect(buyerOutcome({ net: "5985" }, "5700")).toMatchObject({
      result: "-285",
      kind: "loss",
    });
    expect(buyerOutcome({ net: "5985" }, "5985")).toMatchObject({
      result: "0",
      kind: "break-even",
    });
    expect(buyerOutcome({ net: "5985" }, "0")).toMatchObject({
      result: "-5985",
      kind: "loss",
    });
  });
  it("counts the fee once, including when canonical gross is supplied", () => {
    for (const offer of [
      { net: "5985", fee: "10" },
      { net: "5985", fee: "10", gross: "5995" },
      { net: "5985", gross: "5995" },
    ]) {
      expect(buyerOutcome(offer, "6000")).toMatchObject({
        cost: "5995",
        breakEven: "5995",
        result: "5",
      });
    }
    expect(
      buyerOutcome({ net: "5985", fee: "10", gross: "5985" }, "6000"),
    ).toBeNull();
    expect(buyerOutcome({ net: "5985", gross: "5984" }, "6000")).toBeNull();
  });
  it("keeps exact signed six-decimal outcomes for very large purchases", () => {
    expect(
      buyerOutcome({ net: "9007199254740993.000001" }, "9007199254740993"),
    ).toMatchObject({ result: "-0.000001", kind: "loss" });
    expect(formatUsdc(parseUsdc("000012.340001")!)).toBe("12.340001");
    expect(formatUsdc(0n)).toBe("0");
  });
  it.each([
    "",
    " ",
    "1.0000001",
    "-1",
    "1e6",
    "1,000",
    "NaN",
    "Infinity",
    "1.",
  ])("rejects invalid input %j instead of silently rounding", (value) => {
    expect(parseUsdc(value)).toBeNull();
    expect(saleDifference("10", value)).toBeNull();
    expect(buyerOutcome({ net: value }, "10")).toBeNull();
    expect(buyerOutcome({ net: "10" }, value)).toBeNull();
  });
});
