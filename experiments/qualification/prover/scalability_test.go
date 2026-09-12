// SPDX-License-Identifier: MIT
package main

import (
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"math/big"
	"os"
	"runtime"
	"testing"
	"time"
)

// Opt-in measurement of the EXISTING buildState implementation; no network or circuit changes.
// Example: PROVER_SCALABILITY_EVIDENCE=evidence/snapshot-scalability.json go test -run '^TestSnapshotScalability$' -count=1 -v
func TestSnapshotScalability(t *testing.T) {
	output := os.Getenv("PROVER_SCALABILITY_EVIDENCE")
	if output == "" {
		t.Skip("set PROVER_SCALABILITY_EVIDENCE for explicit local scalability measurement")
	}
	type sample struct {
		ReconstructMS  float64 `json:"reconstructMs"`
		DecodeMS       float64 `json:"jsonDecodeMs"`
		AllocatedBytes uint64  `json:"goTotalAllocDeltaBytes"`
		HeapAfterBytes uint64  `json:"goHeapAllocAfterBytes"`
	}
	type result struct {
		Revoked       int      `json:"revokedCount"`
		SnapshotBytes int      `json:"snapshotBytesIndentedIncludingNewline"`
		Root          string   `json:"root"`
		Samples       []sample `json:"samples"`
	}
	report := struct {
		Observed               string   `json:"observedAtUTC"`
		Scope                  string   `json:"scope"`
		SourceCommit           string   `json:"sourceCommit"`
		CredentialSourceSHA256 string   `json:"credentialSourceSHA256"`
		GoVersion              string   `json:"goVersion"`
		OS                     string   `json:"os"`
		Architecture           string   `json:"architecture"`
		Depth                  int      `json:"depth"`
		HolderIndex            int      `json:"publicTestHolderIndex"`
		Distribution           string   `json:"revocationDistribution"`
		Results                []result `json:"results"`
	}{Observed: time.Now().UTC().Format(time.RFC3339), Scope: "Local Go JSON decode + existing MiMC buildState reconstruction only; not browser, fetch, proving, or onchain performance. Three sequential samples per count; GC before each. Allocations are cumulative Go allocations during reconstruction, not peak RSS.", SourceCommit: "5fabede97c79910ad2f9494afd06ed853003d353", GoVersion: runtime.Version(), OS: runtime.GOOS, Architecture: runtime.GOARCH, Depth: Depth, HolderIndex: 42, Distribution: "Distinct, dispersed uint16 indices from (i*40503+17) mod 65536, excluding holder index 42. Odd multiplier permutes all slots. No full snapshots committed."}
	source, err := os.ReadFile("credential.go")
	if err != nil {
		t.Fatal(err)
	}
	hash := sha256.Sum256(source)
	report.CredentialSourceSHA256 = hex.EncodeToString(hash[:])
	for _, count := range []int{0, 100, 1000, 10000} {
		t.Run(fmt.Sprintf("revoked_%d", count), func(t *testing.T) {
			revoked := make([]uint32, 0, count)
			for i := uint32(0); len(revoked) < count; i++ {
				index := (i*40503 + 17) & 65535
				if index != 42 {
					revoked = append(revoked, index)
				}
			}
			measured := result{Revoked: count}
			for iteration := 0; iteration < 3; iteration++ {
				runtime.GC()
				var before, after runtime.MemStats
				runtime.ReadMemStats(&before)
				start := time.Now()
				state, err := buildState(42, revoked)
				elapsed := time.Since(start)
				runtime.ReadMemStats(&after)
				if err != nil {
					t.Fatal(err)
				}
				encoded, err := json.MarshalIndent(Snapshot{Version: Version, Depth: Depth, Root: state.Root, Revoked: revoked}, "", "  ")
				if err != nil {
					t.Fatal(err)
				}
				encoded = append(encoded, '\n')
				var decoded Snapshot
				start = time.Now()
				err = json.Unmarshal(encoded, &decoded)
				decodeTime := time.Since(start)
				if err != nil {
					t.Fatal(err)
				}
				if decoded.Root != state.Root || len(decoded.Revoked) != count {
					t.Fatal("snapshot roundtrip mismatch")
				}
				// Independently fold the private path for literal status zero; signed-index
				// and signature constraints are covered by the separate circuit tests.
				node := nativeHash(dLeaf, big.NewInt(0))
				for level := 0; level < Depth; level++ {
					sibling, e := field(state.Path[level])
					if e != nil {
						t.Fatal(e)
					}
					if (42>>level)&1 == 0 {
						node = nativeHash(dNode, node, sibling)
					} else {
						node = nativeHash(dNode, sibling, node)
					}
				}
				if node.String() != state.Root {
					t.Fatal("non-revoked holder path failed reconstruction")
				}
				measured.SnapshotBytes = len(encoded)
				measured.Root = state.Root
				observation := sample{ReconstructMS: float64(elapsed.Microseconds()) / 1000, DecodeMS: float64(decodeTime.Microseconds()) / 1000, AllocatedBytes: after.TotalAlloc - before.TotalAlloc, HeapAfterBytes: after.HeapAlloc}
				measured.Samples = append(measured.Samples, observation)
				t.Logf("count=%d sample=%d bytes=%d reconstructMs=%.3f decodeMs=%.3f allocatedBytes=%d", count, iteration+1, len(encoded), observation.ReconstructMS, observation.DecodeMS, observation.AllocatedBytes)
			}
			report.Results = append(report.Results, measured)
		})
	}
	if err = writeJSON(output, report, 0644); err != nil {
		t.Fatal(err)
	}
}
