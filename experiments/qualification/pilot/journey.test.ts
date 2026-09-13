import test from "node:test";
import assert from "node:assert/strict";
import { nextStep, deadlineEligibility, documentKeySetup } from "./journey";

test("a fresh client is led through independently required setup without treating login as postage", () => {
  const ready = { owner: "client", key: true, gas: 10n, balance: 250n };
  assert.equal(nextStep("client", false, ready, true, 250n, false).target, "connect");
  assert.equal(nextStep("client", true, { ...ready, gas: null }, true, 250n, false).target, "refresh");
  assert.equal(nextStep("client", true, { ...ready, gas: 0n }, true, 250n, false).target, "funding-help");
  assert.equal(nextStep("client", true, { ...ready, key: false }, true, 250n, false).target, "commission");
  assert.equal(nextStep("client", true, ready, false, 250n, false).target, "connect-storage");
  assert.equal(nextStep("client", true, ready, true, 251n, false).target, "funding-help");
  assert.equal(nextStep("client", true, ready, true, 251n, true).target, "mint");
  assert.equal(nextStep("client", true, ready, true, 250n, false).target, "commission");
});
test("reviewers can discover work before inline encryption setup and do not prefund rewards", () => {
  const step = nextStep("reviewer", true, {key:false,gas:1n,balance:0n}, true, 250n, false);
  assert.equal(step.target, "opportunity-section");
  assert.match(step.text, /prepared as you accept/);
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

test("inline document setup preserves another browser key unless replacement is explicitly confirmed",()=>{
  assert.equal(documentKeySetup({publicKey:"0x",expiresAt:0},"0x04aa",100),"register");
  assert.equal(documentKeySetup({publicKey:"0x04AA",expiresAt:101},"0x04aa",100),"ready");
  assert.equal(documentKeySetup({publicKey:"0x04aa",expiresAt:100},"0x04aa",100),"register");
  assert.equal(documentKeySetup({publicKey:"0x04bb",expiresAt:101},"0x04aa",100),"confirm-replacement");
  assert.equal(documentKeySetup({publicKey:"0x04bb",expiresAt:99},"0x04aa",100),"confirm-replacement");
});
