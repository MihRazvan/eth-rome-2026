#!/usr/bin/env python3
"""Capture real local prover measurements, keeping ephemeral secrets out of output."""
import hashlib
import json
from pathlib import Path
import platform
import re
import subprocess
import sys
import time

ROOT = Path(__file__).resolve().parent
EVIDENCE = ROOT / "evidence"
EVIDENCE.mkdir(exist_ok=True)

def call(label, command):
    start = time.monotonic()
    result = subprocess.run(command, cwd=ROOT, capture_output=True, text=True)
    elapsed = time.monotonic() - start
    (EVIDENCE / (label + ".txt")).write_text(result.stdout + result.stderr)
    summary = {"command": command, "exitCode": result.returncode, "wallMs": round(elapsed * 1000, 3)}
    # macOS /usr/bin/time -l reports maximum resident set size in BYTES.
    match = re.search(r"(\d+)\s+maximum resident set size", result.stderr)
    if match:
        summary["peakRSSBytes"] = int(match.group(1))
    if result.returncode:
        raise RuntimeError(label + " failed; see captured output")
    return summary

results = {}
results["goVersion"] = call("go-version", ["go", "version"])
results["tests"] = call("go-test", ["go", "test", "-count=1", "-v", "./..."])
results["build"] = call("go-build", ["go", "build", "-o", "qualification-prover", "."])
# Reuse the setup matching committed verifier. Do not change it during evidence capture.
command = ["./qualification-prover", "prove", "--setup", ".local/setup", "--credential", "fixtures/credential.json", "--holder", "fixtures/public-test-holder.json", "--state", "fixtures/private-test-state.json", "--context", "12345", "--recipient", "0x000000000000000000000000000000000000cafe", "--deadline", "1900000000", "--class", "7", "--out", ".local/measured-proof.json"]
if platform.system() != "Darwin":
    raise RuntimeError("This RSS capture uses macOS time units; adapt explicitly on another OS")
results["proveIncludingSetupLoad"] = call("prove-time", ["/usr/bin/time", "-l"] + command)
results["proofStatistics"] = json.loads((ROOT / ".local/measured-proof.json").read_text())
results["proofStatistics"].pop("proof")
results["fixtureVerifierSHA256"] = hashlib.sha256((ROOT / "artifacts/QualificationVerifier.sol").read_bytes()).hexdigest()
results["fixtureProofSHA256"] = hashlib.sha256((ROOT / "fixtures/valid-proof.json").read_bytes()).hexdigest()
results["scope"] = "Actual local Go proof/test run. No browser proving, network integration or Solidity execution measured here. RSS includes setup loading and proof generation; internal proveMs excludes setup loading."
results["observedAtUTC"] = time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())
results["platform"] = {"system": platform.system(), "machine": platform.machine()}
(EVIDENCE / "measurements.json").write_text(json.dumps(results, indent=2) + "\n")
print(json.dumps({"testExitCode": results["tests"]["exitCode"], "proofBytes":results["proofStatistics"]["proofBytes"], "internalProveMs":results["proofStatistics"]["proveMs"], "internalVerifyMs":results["proofStatistics"]["verifyMs"], "process":results["proveIncludingSetupLoad"]}, indent=2))
