import test from "node:test";
import assert from "node:assert/strict";
import { nextStep, deadlineEligibility } from "./journey";

test("a fresh client is led through independently required setup without treating login as postage", () => {
  const ready = { owner: "client", key: true, gas: 10n, balance: 250n };
  assert.equal(nextStep("client", false, ready, true, 250n, false).target, "connect");
  assert.equal(nextStep("client", true, { ...ready, gas: null }, true, 250n, false).target, "refresh");
  assert.equal(nextStep("client", true, { ...ready, gas: 0n }, true, 250n, false).target, "funding-help");
  assert.equal(nextStep("client", true, { ...ready, key: false }, true, 250n, false).target, "register");
  assert.equal(nextStep("client", true, ready, false, 250n, false).target, "connect-storage");
  assert.equal(nextStep("client", true, ready, true, 251n, false).target, "funding-help");
  assert.equal(nextStep("client", true, ready, true, 251n, true).target, "mint");
  assert.equal(nextStep("client", true, ready, true, 250n, false).target, "commission");
});
test("reviewers need gas and delivery keys but do not have to prefund the client's reward", () => {
  const step = nextStep("reviewer", true, {key:true,gas:1n,balance:0n}, true, 250n, false);
  assert.equal(step.target, "opportunity-section");
  assert.match(step.text, /qualification/);
});
test("deadline boundaries match escrow policy including asymmetric refund and claim cutoffs", () => {
  const at = (status:string,t:number) => deadlineEligibility(status,t,100n,200n,300n);
  assert.equal(at("Open",99).accept,true);
  assert.equal(at("Open",100).accept,false);
  assert.equal(at("Open",100).refund,true);
  assert.equal(at("Accepted",200).submit,true);
  assert.equal(at("Accepted",200).refund,false);
  assert.equal(at("Accepted",201).refund,true);
  assert.equal(at("Submitted",300).dispute,true);
  assert.equal(at("Submitted",300).claim,false);
  assert.equal(at("Submitted",301).dispute,false);
  assert.equal(at("Submitted",301).claim,true);
  for (const status of ["Paid","Refunded","Disputed","Resolved"])
    assert.deepEqual(Object.values(at(status,500)),[false,false,false,false,false]);
});
