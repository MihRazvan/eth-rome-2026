// SPDX-License-Identifier: MIT
package main

import (
	"bytes"
	"encoding/json"
	"github.com/consensys/gnark-crypto/ecc"
	"math/big"
	"os"
	"path/filepath"
	"strings"
	"testing"
)

func publicFixture(t *testing.T) (registryPublicKey, Snapshot) {
	t.Helper()
	c, e := testCredential(7, 7, 2000000000, true)
	if e != nil {
		t.Fatal(e)
	}
	revoked := []uint32{2, 8, 65535}
	state, e := buildState(0, revoked)
	if e != nil {
		t.Fatal(e)
	}
	return registryPublicKey{Version: registryVersion, TestOnly: true, IssuerX: c.IssuerX, IssuerY: c.IssuerY}, Snapshot{Version: Version, Depth: Depth, Root: state.Root, Revoked: revoked}
}
func TestValidatePublicAcceptsNativeIssuerAndTree(t *testing.T) {
	k, s := publicFixture(t)
	if e := validatePublicMetadata(k, s); e != nil {
		t.Fatal(e)
	}
	state, e := buildState(0, []uint32{})
	if e != nil {
		t.Fatal(e)
	}
	s.Root = state.Root
	s.Revoked = []uint32{}
	if e := validatePublicMetadata(k, s); e != nil {
		t.Fatal(e)
	}
}
func TestValidatePublicRejectsUnusablePoints(t *testing.T) {
	k, s := publicFixture(t)
	bad := [][2]string{{"1", "1"}, {"0", "1"}, {"0", new(big.Int).Sub(ecc.BN254.ScalarField(), big.NewInt(1)).String()}, {"01", k.IssuerY}, {"-1", k.IssuerY}, {"0x01", k.IssuerY}, {ecc.BN254.ScalarField().String(), k.IssuerY}}
	for _, xy := range bad {
		copy := k
		copy.IssuerX = xy[0]
		copy.IssuerY = xy[1]
		if validatePublicMetadata(copy, s) == nil {
			t.Fatalf("accepted invalid point %v", xy)
		}
	}
}
func TestValidatePublicRejectsBadSnapshots(t *testing.T) {
	k, s := publicFixture(t)
	changes := []func(*Snapshot){func(s *Snapshot) { s.Root = "1" }, func(s *Snapshot) { s.Depth = 15 }, func(s *Snapshot) { s.Version = "other" }, func(s *Snapshot) { s.Revoked = nil }, func(s *Snapshot) { s.Revoked = []uint32{65536} }, func(s *Snapshot) { s.Revoked = []uint32{2, 2, 8, 65535} }, func(s *Snapshot) { s.Revoked = []uint32{8, 2, 65535} }, func(s *Snapshot) { s.Root = "0" }}
	for i, change := range changes {
		copy := s
		change(&copy)
		if validatePublicMetadata(k, copy) == nil {
			t.Fatalf("accepted mutation %d", i)
		}
	}
	for _, change := range []func(*registryPublicKey){func(k *registryPublicKey) { k.TestOnly = false }, func(k *registryPublicKey) { k.Version = "other" }} {
		copy := k
		change(&copy)
		if validatePublicMetadata(copy, s) == nil {
			t.Fatal("accepted issuer schema mismatch")
		}
	}
}
func TestValidatePublicCLIIsPublicOnlyAndReadOnly(t *testing.T) {
	k, s := publicFixture(t)
	dir := t.TempDir()
	ip, sp := filepath.Join(dir, "issuer.json"), filepath.Join(dir, "snapshot.json")
	a, _ := json.Marshal(k)
	b, _ := json.Marshal(s)
	os.WriteFile(ip, a, 0600)
	os.WriteFile(sp, b, 0600)
	var out bytes.Buffer
	if e := validatePublic([]string{"--issuer-public", ip, "--snapshot", sp}, &out); e != nil {
		t.Fatal(e)
	}
	var summary map[string]any
	if json.Unmarshal(out.Bytes(), &summary) != nil || summary["status"] != "VALID_PUBLIC_METADATA" || summary["revokedCount"] != float64(3) {
		t.Fatal(out.String())
	}
	for _, forbidden := range []string{"privateKey", "holderSecret", "privateWitness", "revokedIndices", dir} {
		if strings.Contains(out.String(), forbidden) {
			t.Fatal("non-summary data leaked")
		}
	}
	before, _ := os.ReadFile(ip)
	if !bytes.Equal(a, before) {
		t.Fatal("mutated input")
	}
	for _, body := range []string{strings.TrimSuffix(string(a), "}") + `,"privateKey":"SENSITIVE_VALUE"}`, strings.TrimSuffix(string(a), "}") + `,"issuerX":"1"}`, strings.TrimSuffix(string(a), "}") + `,"IssuerX":"1"}`, string(a) + ` {}`, strings.Repeat(" ", 4097)} {
		os.WriteFile(ip, []byte(body), 0600)
		out.Reset()
		e := validatePublic([]string{"--issuer-public", ip, "--snapshot", sp}, &out)
		if e == nil || out.Len() != 0 || strings.Contains(e.Error(), "SENSITIVE_VALUE") {
			t.Fatal("unsafe invalid document handling")
		}
	}
}
