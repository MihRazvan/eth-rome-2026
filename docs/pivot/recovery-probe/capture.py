#!/usr/bin/env python3
"""Capture isolated Forge verification. No RPC or externally supplied credentials."""
import datetime
import json
from pathlib import Path
import subprocess

ROOT = Path(__file__).resolve().parent
SEED = "0x52455052495345"
command = ["forge", "test", "--root", str(ROOT), "--fuzz-seed", SEED, "-vv"]
version = subprocess.run(["forge", "--version"], capture_output=True, text=True, check=True)
result = subprocess.run(command, capture_output=True, text=True)
output = result.stdout + result.stderr
(ROOT / "forge-output.txt").write_text(output)
(ROOT / "evidence.json").write_text(json.dumps({
    "observed_at_utc": datetime.datetime.now(datetime.timezone.utc).isoformat(),
    "scope": "Isolated local EVM feasibility probe; no RPC, Anvil, public deployment or sponsor integration",
    "forge_version": version.stdout.strip(),
    "solc_version": "0.8.30",
    "command": "forge test --root docs/pivot/recovery-probe --fuzz-seed " + SEED + " -vv",
    "fuzz_seed": SEED,
    "exit_code": result.returncode,
    "output_file": "forge-output.txt",
    "crash_model": "A pays, then omits receipt publication; no operating-system process killed",
    "time_model": "Foundry vm.warp to lease deadline",
    "token_model": "Local exact-transfer ERC-20 with actual balance and allowance state changes"
}, indent=2) + "\n")
print(output)
raise SystemExit(result.returncode)
