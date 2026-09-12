#!/bin/sh
set -eu
review_dir=$(CDPATH='' cd -- "$(dirname -- "$0")" && pwd)
prover_dir="$review_dir/../prover"
overlay_file=$(mktemp)
trap 'rm -f "$overlay_file"' EXIT
python3 - "$prover_dir" "$review_dir" "$overlay_file" <<'PY'
import json,os,sys
prover,review,overlay=map(os.path.abspath,sys.argv[1:])
with open(overlay,'w') as f: json.dump({'Replace':{prover+'/review_extra_test.go':review+'/extra_test.go'}},f)
PY
cd "$prover_dir"
go test -overlay "$overlay_file" -count=1 -run TestIndependentBoundaryProbes -v .
