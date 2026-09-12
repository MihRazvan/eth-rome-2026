// SPDX-License-Identifier: MIT
package main

import (
	"bufio"
	"bytes"
	"context"
	"fmt"
	"os"
	"os/exec"
	"path/filepath"
	"sort"
	"testing"
	"time"
)

func newTestRegistry(t *testing.T) (string, string) {
	t.Helper()
	dir := filepath.Join(t.TempDir(), "issuer")
	if err := registryInit(dir); err != nil {
		t.Fatal(err)
	}
	credential, err := testCredential(42, 7, 2000000000, true)
	if err != nil {
		t.Fatal(err)
	}
	return dir, credential.HolderCommitment
}
func inspectTestRegistry(t *testing.T, dir string) registryState {
	t.Helper()
	var result registryState
	if err := withIssuerRegistry(dir, false, func(r *lockedRegistry) error { result = r.state; return nil }); err != nil {
		t.Fatal(err)
	}
	return result
}
func registryChild(ctx context.Context, args ...string) *exec.Cmd {
	all := append([]string{"-test.run=^TestRegistryHelperProcess$", "--"}, args...)
	cmd := exec.CommandContext(ctx, os.Args[0], all...)
	cmd.Env = append(os.Environ(), "QUAL_ISSUER_REGISTRY_HELPER=1")
	return cmd
}
func TestRegistryHelperProcess(t *testing.T) {
	if os.Getenv("QUAL_ISSUER_REGISTRY_HELPER") != "1" {
		return
	}
	split := 0
	for i, arg := range os.Args {
		if arg == "--" {
			split = i + 1
			break
		}
	}
	args := os.Args[split:]
	var err error
	if args[0] == "crash-after-reserve" {
		err = registryIssue(args[1], args[2], 7, 2000000000, args[3], func() error {
			fmt.Println("reserved")
			// Parent sends actual SIGKILL here; no deferred unlock/cleanup can run.
			for {
				time.Sleep(time.Second)
			}
		})
	} else {
		err = issuerRegistry(args)
	}
	if err != nil {
		fmt.Fprintln(os.Stderr, err)
		os.Exit(1)
	}
	os.Exit(0)
}
func TestRegistryConcurrentProcessesAllocateDistinctSignedSlots(t *testing.T) {
	dir, commitment := newTestRegistry(t)
	ctx, cancel := context.WithTimeout(context.Background(), 20*time.Second)
	defer cancel()
	const count = 12
	commands := make([]*exec.Cmd, count)
	outputs := make([]bytes.Buffer, count)
	for i := range commands {
		commands[i] = registryChild(ctx, "issue", "--dir", dir, "--commitment", commitment, "--class", "7", "--expiry", "2000000000", "--out", filepath.Join(filepath.Dir(dir), fmt.Sprintf("credential-%d.json", i)))
		commands[i].Stdout = &outputs[i]
		commands[i].Stderr = &outputs[i]
		if err := commands[i].Start(); err != nil {
			t.Fatal(err)
		}
	}
	indices := make([]int, 0, count)
	for i, cmd := range commands {
		if err := cmd.Wait(); err != nil {
			t.Fatalf("concurrent issuer %d failed: %v %s", i, err, outputs[i].String())
		}
		var credential Credential
		if err := readJSON(filepath.Join(filepath.Dir(dir), fmt.Sprintf("credential-%d.json", i)), &credential); err != nil {
			t.Fatal(err)
		}
		if credential.Signature == "" || credential.HolderSecret != "" {
			t.Fatal("unsigned credential or secret leak")
		}
		indices = append(indices, int(credential.Index))
	}
	sort.Ints(indices)
	for i, index := range indices {
		if index != i {
			t.Fatal("duplicate or lost concurrent allocation")
		}
	}
	state := inspectTestRegistry(t, dir)
	if state.NextIndex != count {
		t.Fatal("durable allocation count mismatch")
	}
	if err := withIssuerRegistry(dir, false, func(r *lockedRegistry) error {
		for _, record := range r.state.Records {
			credential := Credential{Version: Version, TestOnly: true, HolderCommitment: record.Commitment, Index: record.Index, Class: record.Class, Expiry: record.Expiry}
			if err := signCredential(&credential, r.key); err != nil {
				return err
			}
			if credential.Signature != record.Signature {
				return fmt.Errorf("persisted signature not from registry issuer")
			}
		}
		return nil
	}); err != nil {
		t.Fatal(err)
	}
	t.Log("12 actual issuer processes returned distinct signed slots 0 through 11")
}
func TestRegistryProcessKillAfterReservationNeverReusesSlot(t *testing.T) {
	dir, commitment := newTestRegistry(t)
	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()
	lostOutput := filepath.Join(filepath.Dir(dir), "lost.json")
	cmd := registryChild(ctx, "crash-after-reserve", dir, commitment, lostOutput)
	stdout, err := cmd.StdoutPipe()
	if err != nil {
		t.Fatal(err)
	}
	if err = cmd.Start(); err != nil {
		t.Fatal(err)
	}
	line, err := bufio.NewReader(stdout).ReadString('\n')
	if err != nil || line != "reserved\n" {
		cmd.Process.Kill()
		t.Fatal("child never reached durable reservation")
	}
	if err = cmd.Process.Kill(); err != nil {
		t.Fatal(err)
	}
	if cmd.Wait() == nil {
		t.Fatal("expected killed process")
	}
	if _, err = os.Stat(lostOutput); !os.IsNotExist(err) {
		t.Fatal("crashed worker emitted credential")
	}
	state := inspectTestRegistry(t, dir)
	if state.NextIndex != 1 || state.Records[0].Signature != "" {
		t.Fatal("reservation not durable across actual process death")
	}
	recovered := filepath.Join(filepath.Dir(dir), "retry.json")
	if err = registryIssue(dir, commitment, 7, 2000000000, recovered, nil); err != nil {
		t.Fatal(err)
	}
	var credential Credential
	if err = readJSON(recovered, &credential); err != nil {
		t.Fatal(err)
	}
	if credential.Index != 1 {
		t.Fatal("retry reused reserved slot")
	}
	t.Log("SIGKILL after reservation left unsigned slot 0; new process operation issued slot 1")
}
func TestRegistryMonotonicRevocationAndReissue(t *testing.T) {
	dir, commitment := newTestRegistry(t)
	for i := 0; i < 2; i++ {
		if err := registryIssue(dir, commitment, 7, 2000000000, filepath.Join(filepath.Dir(dir), fmt.Sprintf("issue-%d.json", i)), nil); err != nil {
			t.Fatal(err)
		}
	}
	if err := registryRevoke(dir, 1); err != nil {
		t.Fatal(err)
	}
	if err := registryRevoke(dir, 0); err != nil {
		t.Fatal(err)
	}
	if err := registryRevoke(dir, 1); err != nil {
		t.Fatal(err)
	}
	if err := registryRevoke(dir, 2); err == nil {
		t.Fatal("unallocated revocation accepted")
	}
	replacement := filepath.Join(filepath.Dir(dir), "replacement.json")
	if err := registryIssue(dir, commitment, 7, 2000000001, replacement, nil); err != nil {
		t.Fatal(err)
	}
	var credential Credential
	if err := readJSON(replacement, &credential); err != nil {
		t.Fatal(err)
	}
	if credential.Index != 2 {
		t.Fatal("replacement reused old slot")
	}
	snapshotPath := filepath.Join(filepath.Dir(dir), "public.json")
	if err := issuerRegistry([]string{"snapshot", "--dir", dir, "--out", snapshotPath}); err != nil {
		t.Fatal(err)
	}
	var snapshot Snapshot
	if err := readJSON(snapshotPath, &snapshot); err != nil {
		t.Fatal(err)
	}
	if len(snapshot.Revoked) != 2 || snapshot.Revoked[0] != 0 || snapshot.Revoked[1] != 1 {
		t.Fatal("revocation lost or duplicate")
	}
	expected, err := buildState(2, []uint32{0, 1})
	if err != nil {
		t.Fatal(err)
	}
	if snapshot.Root != expected.Root {
		t.Fatal("snapshot is not canonical registry state")
	}
	var public map[string]any
	if err = readJSON(snapshotPath, &public); err != nil {
		t.Fatal(err)
	}
	if len(public) != 4 {
		t.Fatal("snapshot contains private issuer/holder state")
	}
}
func TestRegistryCorruptionAndKeySwapFailClosed(t *testing.T) {
	for _, kind := range []string{"truncated-json", "edited-next-index", "swapped-key", "missing-state", "inconsistent-header"} {
		t.Run(kind, func(t *testing.T) {
			dir, commitment := newTestRegistry(t)
			switch kind {
			case "truncated-json":
				if err := os.WriteFile(filepath.Join(dir, registryStateName), []byte("{\"state\":"), 0600); err != nil {
					t.Fatal(err)
				}
			case "edited-next-index":
				var envelope registryEnvelope
				if err := readJSON(filepath.Join(dir, registryStateName), &envelope); err != nil {
					t.Fatal(err)
				}
				envelope.State.NextIndex = 17
				if err := writeJSON(filepath.Join(dir, registryStateName), envelope, 0600); err != nil {
					t.Fatal(err)
				}
			case "swapped-key":
				other, _ := newTestRegistry(t)
				key, err := os.ReadFile(filepath.Join(other, registryKeyName))
				if err != nil {
					t.Fatal(err)
				}
				if err = os.WriteFile(filepath.Join(dir, registryKeyName), key, 0600); err != nil {
					t.Fatal(err)
				}
			case "missing-state":
				if err := os.Remove(filepath.Join(dir, registryStateName)); err != nil {
					t.Fatal(err)
				}
			case "inconsistent-header":
				if err := withIssuerRegistry(dir, false, func(r *lockedRegistry) error { r.state.NextIndex = 1; return r.save() }); err != nil {
					t.Fatal(err)
				}
			}
			stateBefore, _ := os.ReadFile(filepath.Join(dir, registryStateName))
			keyBefore, _ := os.ReadFile(filepath.Join(dir, registryKeyName))
			if registryIssue(dir, commitment, 7, 2000000000, filepath.Join(filepath.Dir(dir), "bad.json"), nil) == nil {
				t.Fatal("corrupted registry accepted")
			}
			if registryInit(dir) == nil {
				t.Fatal("corruption silently reset by init")
			}
			stateAfter, _ := os.ReadFile(filepath.Join(dir, registryStateName))
			keyAfter, _ := os.ReadFile(filepath.Join(dir, registryKeyName))
			if !bytes.Equal(stateBefore, stateAfter) || !bytes.Equal(keyBefore, keyAfter) {
				t.Fatal("failed load rewrote authoritative files")
			}
		})
	}
}
func TestRegistryOutputFailurePreservesAllocationAndProtectedFiles(t *testing.T) {
	dir, commitment := newTestRegistry(t)
	for _, name := range []string{registryStateName, registryKeyName, registryLockName, "issuer-public.json"} {
		if registryIssue(dir, commitment, 7, 2000000000, filepath.Join(dir, name), nil) == nil {
			t.Fatal("protected output path accepted")
		}
		if issuerRegistry([]string{"snapshot", "--dir", dir, "--out", filepath.Join(dir, name)}) == nil {
			t.Fatal("snapshot could overwrite protected state")
		}
	}
	output := filepath.Join(filepath.Dir(dir), "existing.json")
	// Simulate an output contender arriving after the durable reservation. The
	// final no-replace link must fail without clobbering that file or reusing slot.
	err := registryIssue(dir, commitment, 7, 2000000000, output, func() error { return os.WriteFile(output, []byte("existing"), 0600) })
	if err == nil {
		t.Fatal("existing output overwritten")
	}
	value, _ := os.ReadFile(output)
	if string(value) != "existing" {
		t.Fatal("clobbered output")
	}
	state := inspectTestRegistry(t, dir)
	if state.NextIndex != 1 {
		t.Fatal("failed output lost allocated slot")
	}
	if registryIssue(dir, commitment, 7, 2000000000, output, nil) == nil {
		t.Fatal("retry replaced existing output")
	}
	if inspectTestRegistry(t, dir).NextIndex != 1 {
		t.Fatal("existing-output preflight unnecessarily allocated")
	}
}
func TestRegistryCapacityBoundaryWithSyntheticReservedHistory(t *testing.T) {
	dir, commitment := newTestRegistry(t)
	// Synthetic authenticated reservation history avoids 65,535 fsync calls.
	if err := withIssuerRegistry(dir, false, func(r *lockedRegistry) error {
		r.state.Records = make([]registryRecord, registryCapacity-1)
		for i := range r.state.Records {
			r.state.Records[i] = registryRecord{Index: uint32(i), Commitment: commitment, Class: 7, Expiry: 2000000000}
		}
		r.state.NextIndex = registryCapacity - 1
		return r.save()
	}); err != nil {
		t.Fatal(err)
	}
	last := filepath.Join(filepath.Dir(dir), "last.json")
	if err := registryIssue(dir, commitment, 7, 2000000000, last, nil); err != nil {
		t.Fatal(err)
	}
	var credential Credential
	if err := readJSON(last, &credential); err != nil {
		t.Fatal(err)
	}
	if credential.Index != 65535 {
		t.Fatal("last slot wrong")
	}
	if registryIssue(dir, commitment, 7, 2000000000, filepath.Join(filepath.Dir(dir), "overflow.json"), nil) == nil {
		t.Fatal("capacity overflow accepted")
	}
	if inspectTestRegistry(t, dir).NextIndex != 65536 {
		t.Fatal("exhausted state altered")
	}
}
func TestRegistryPrivateStateHasNoHolderSecretAndOwnerOnlyPermissions(t *testing.T) {
	dir, commitment := newTestRegistry(t)
	dummy, err := testCredential(42, 7, 2000000000, true)
	if err != nil {
		t.Fatal(err)
	}
	if err = registryIssue(dir, commitment, 7, 2000000000, filepath.Join(filepath.Dir(dir), "credential.json"), nil); err != nil {
		t.Fatal(err)
	}
	state, err := os.ReadFile(filepath.Join(dir, registryStateName))
	if err != nil {
		t.Fatal(err)
	}
	if bytes.Contains(state, []byte("holderSecret")) || bytes.Contains(state, []byte(dummy.HolderSecret)) {
		t.Fatal("issuer persisted holder secret")
	}
	for _, name := range []string{registryKeyName, registryStateName, registryLockName} {
		info, err := os.Stat(filepath.Join(dir, name))
		if err != nil {
			t.Fatal(err)
		}
		if info.Mode().Perm() != 0600 {
			t.Fatal("private file permissions")
		}
	}
}
func TestRegistryCLIRejectsMalformedLimitsAndNoReset(t *testing.T) {
	dir, commitment := newTestRegistry(t)
	for _, args := range [][]string{
		{"issue", "--dir", dir, "--commitment", commitment, "--class", "4294967296", "--expiry", "2000000000", "--out", filepath.Join(filepath.Dir(dir), "bad.json")},
		{"issue", "--dir", dir, "--commitment", commitment, "--class", "7", "--expiry", "18446744073709551616", "--out", filepath.Join(filepath.Dir(dir), "bad.json")},
		{"revoke", "--dir", dir, "--index", "65536"}, {"reset", "--dir", dir}, {"init", "--dir", dir},
	} {
		if issuerRegistry(args) == nil {
			t.Fatal("invalid registry command accepted")
		}
	}
	if inspectTestRegistry(t, dir).NextIndex != 0 {
		t.Fatal("bad arguments changed registry")
	}
}
func TestRegistryConcurrentInitializationKeepsOneKey(t *testing.T) {
	dir := filepath.Join(t.TempDir(), "race-init")
	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()
	children := make([]*exec.Cmd, 4)
	for i := range children {
		children[i] = registryChild(ctx, "init", "--dir", dir)
		if err := children[i].Start(); err != nil {
			t.Fatal(err)
		}
	}
	successes := 0
	for _, child := range children {
		if child.Wait() == nil {
			successes++
		}
	}
	if successes != 1 {
		t.Fatalf("expected one initializer, got %d", successes)
	}
	if inspectTestRegistry(t, dir).NextIndex != 0 {
		t.Fatal("concurrent initialization altered allocations")
	}
}

func TestRegistryRejectsAliasedProtectedOutputAndAlteredPublicMetadata(t *testing.T) {
	dir, commitment := newTestRegistry(t)
	alias := filepath.Join(filepath.Dir(dir), "alias")
	if err := os.Symlink(dir, alias); err != nil {
		t.Fatal(err)
	}
	if issuerRegistry([]string{"snapshot", "--dir", dir, "--out", filepath.Join(alias, registryStateName)}) == nil {
		t.Fatal("symlink alias bypassed protected output")
	}
	publicPath := filepath.Join(dir, "issuer-public.json")
	var public registryPublicKey
	if err := readJSON(publicPath, &public); err != nil {
		t.Fatal(err)
	}
	public.IssuerX = "1"
	if err := writeJSON(publicPath, public, 0600); err != nil {
		t.Fatal(err)
	}
	if registryIssue(dir, commitment, 7, 2000000000, filepath.Join(filepath.Dir(dir), "bad-public.json"), nil) == nil {
		t.Fatal("altered public metadata accepted")
	}
}
