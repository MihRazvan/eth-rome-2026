// SPDX-License-Identifier: MIT
package main

import (
	"bytes"
	"crypto/sha256"
	"encoding/json"
	"math/big"
	"testing"

	"github.com/consensys/gnark-crypto/ecc"
	native "github.com/consensys/gnark-crypto/ecc/bn254/twistededwards/eddsa"
	"github.com/consensys/gnark/backend/groth16"
	"github.com/consensys/gnark/frontend"
	"github.com/consensys/gnark/logger"
)

func baseline(t *testing.T) (*Credential, *State, *Circuit) {
	t.Helper()
	c, err := testCredential(42, 7, 2000000000, true)
	if err != nil {
		t.Fatal(err)
	}
	s, err := buildState(c.Index, []uint32{1, 99, 65535})
	if err != nil {
		t.Fatal(err)
	}
	a, err := assignment(c, s, big.NewInt(12345), big.NewInt(0xCAFE), big.NewInt(1900000000), big.NewInt(7))
	if err != nil {
		t.Fatal(err)
	}
	return c, s, a
}
func TestCircuitAdversaries(t *testing.T) {
	logger.Disable()
	cs, err := compile()
	if err != nil {
		t.Fatal(err)
	}
	t.Logf("constraints=%d", cs.GetNbConstraints())
	cases := []struct {
		name   string
		mutate func(*testing.T, *Credential, *State, *Circuit)
		valid  bool
	}{
		{"valid issuer signature holder class expiry and same-index path", func(*testing.T, *Credential, *State, *Circuit) {}, true},
		{"forged signature from another signer under trusted key", func(t *testing.T, c *Credential, s *State, a *Circuit) {
			seed := sha256.Sum256([]byte("public attacker test seed"))
			key, e := native.GenerateKey(bytes.NewReader(seed[:]))
			if e != nil {
				t.Fatal(e)
			}
			oldX, oldY := c.IssuerX, c.IssuerY
			if e = signCredential(c, key); e != nil {
				t.Fatal(e)
			}
			c.IssuerX, c.IssuerY = oldX, oldY
			forged, e := assignment(c, s, big.NewInt(12345), big.NewInt(0xCAFE), big.NewInt(1900000000), big.NewInt(7))
			if e != nil {
				t.Fatal(e)
			}
			*a = *forged
		}, false},
		{"wrong holder secret with recomputed public tags", func(t *testing.T, c *Credential, s *State, a *Circuit) {
			secret, _ := field(c.HolderSecret)
			secret.Add(secret, big.NewInt(1))
			a.Secret = secret
			a.Nullifier = nativeHash(dNullifier, secret, big.NewInt(12345))
			a.Tag = nativeHash(dPresentation, secret, big.NewInt(12345), big.NewInt(0xCAFE), big.NewInt(1900000000))
		}, false},
		{"wrong required class", func(_ *testing.T, _ *Credential, _ *State, a *Circuit) { a.Class = 8 }, false},
		{"expired credential relative to proof deadline", func(_ *testing.T, c *Credential, _ *State, a *Circuit) {
			dl := big.NewInt(2000000001)
			secret, _ := field(c.HolderSecret)
			a.Deadline = dl
			a.Tag = nativeHash(dPresentation, secret, big.NewInt(12345), big.NewInt(0xCAFE), dl)
		}, false},
		{"revoked signed index", func(t *testing.T, c *Credential, _ *State, a *Circuit) {
			s, e := buildState(c.Index, []uint32{42})
			if e != nil {
				t.Fatal(e)
			}
			a.Root = s.Root
			for i := range a.Path {
				a.Path[i] = s.Path[i]
			}
		}, false},
		{"substitute valid path at different index in current revoked root", func(t *testing.T, _ *Credential, _ *State, a *Circuit) {
			s, e := buildState(43, []uint32{42})
			if e != nil {
				t.Fatal(e)
			}
			a.Root = s.Root
			for i := range a.Path {
				a.Path[i] = s.Path[i]
			}
		}, false},
		{"substitute signed index together with path", func(t *testing.T, _ *Credential, _ *State, a *Circuit) {
			s, e := buildState(43, []uint32{42})
			if e != nil {
				t.Fatal(e)
			}
			a.Index = 43
			a.Root = s.Root
			for i := range a.Path {
				a.Path[i] = s.Path[i]
			}
		}, false},
		{"signed index overflow", func(_ *testing.T, _ *Credential, _ *State, a *Circuit) { a.Index = 65536 }, false},
		{"recipient mutation without new witness tag", func(_ *testing.T, _ *Credential, _ *State, a *Circuit) { a.Recipient = 0xBEEF }, false},
		{"context mutation without new witness outputs", func(_ *testing.T, _ *Credential, _ *State, a *Circuit) { a.Context = 12346 }, false},
		{"nullifier mutation", func(_ *testing.T, _ *Credential, _ *State, a *Circuit) { a.Nullifier = 1 }, false},
		{"presentation tag mutation", func(_ *testing.T, _ *Credential, _ *State, a *Circuit) { a.Tag = 1 }, false},
		{"identity issuer public key", func(_ *testing.T, _ *Credential, _ *State, a *Circuit) { a.IssuerX = 0; a.IssuerY = 1 }, false},
		{"out of range timestamp", func(_ *testing.T, _ *Credential, _ *State, a *Circuit) {
			a.Deadline = new(big.Int).Lsh(big.NewInt(1), 64)
		}, false},
		{"out of range recipient", func(_ *testing.T, _ *Credential, _ *State, a *Circuit) {
			a.Recipient = new(big.Int).Lsh(big.NewInt(1), 160)
		}, false},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			c, s, a := baseline(t)
			tc.mutate(t, c, s, a)
			w, e := frontend.NewWitness(a, ecc.BN254.ScalarField())
			if e != nil {
				t.Fatal(e)
			}
			e = cs.IsSolved(w)
			if tc.valid && e != nil {
				t.Fatalf("valid witness rejected: %v", e)
			}
			if !tc.valid && e == nil {
				t.Fatal("invalid witness satisfied circuit")
			}
		})
	}
}
func TestRealGroth16AndEveryPublicInputMutation(t *testing.T) {
	logger.Disable()
	cs, err := compile()
	if err != nil {
		t.Fatal(err)
	}
	pk, vk, err := groth16.Setup(cs)
	if err != nil {
		t.Fatal(err)
	}
	c, s, a := baseline(t)
	w, err := frontend.NewWitness(a, ecc.BN254.ScalarField())
	if err != nil {
		t.Fatal(err)
	}
	public, _ := w.Public()
	proof, err := groth16.Prove(cs, pk, w)
	if err != nil {
		t.Fatal(err)
	}
	if err = groth16.Verify(proof, vk, public); err != nil {
		t.Fatal(err)
	}
	// A byte-identical proof remains mathematically valid: settlement MUST consume nullifier/job.
	if err = groth16.Verify(proof, vk, public); err != nil {
		t.Fatal("same proof unexpectedly invalid on second stateless verify")
	}
	for i, name := range inputNames {
		t.Run(name, func(t *testing.T) {
			_, _, changed := baseline(t)
			fields := []*frontend.Variable{&changed.IssuerX, &changed.IssuerY, &changed.Root, &changed.Class, &changed.Deadline, &changed.Context, &changed.Recipient, &changed.Nullifier, &changed.Tag}
			*fields[i] = 1
			changedW, e := frontend.NewWitness(changed, ecc.BN254.ScalarField())
			if e != nil {
				t.Fatal(e)
			}
			changedPublic, _ := changedW.Public()
			if groth16.Verify(proof, vk, changedPublic) == nil {
				t.Fatal("public input mutation accepted")
			}
		})
	}
	first, err := generateProof(cs, pk, vk, a)
	if err != nil {
		t.Fatal(err)
	}
	other, err := assignment(c, s, big.NewInt(12345), big.NewInt(0xBEEF), big.NewInt(1900000001), big.NewInt(7))
	if err != nil {
		t.Fatal(err)
	}
	second, err := generateProof(cs, pk, vk, other)
	if err != nil {
		t.Fatal(err)
	}
	if first.PublicInputs[7] != second.PublicInputs[7] {
		t.Fatal("recipient/deadline changed job nullifier")
	}
	if first.PublicInputs[8] == second.PublicInputs[8] {
		t.Fatal("presentation not bound to recipient/deadline")
	}
	differentJob, err := assignment(c, s, big.NewInt(12346), big.NewInt(0xCAFE), big.NewInt(1900000000), big.NewInt(7))
	if err != nil {
		t.Fatal(err)
	}
	if a.Nullifier.(*big.Int).Cmp(differentJob.Nullifier.(*big.Int)) == 0 {
		t.Fatal("nullifier not job-scoped")
	}
	t.Logf("proofBytes=%d proveMs=%.3f verifyMs=%.3f heapAllocBytes=%d goSysBytes=%d", first.ProofBytes, first.ProveMS, first.VerifyMS, first.GoHeapAllocBytes, first.GoSysBytes)
}
func TestCredentialSerializationExcludesHolderSecret(t *testing.T) {
	c, _, _ := baseline(t)
	b, e := json.Marshal(c)
	if e != nil {
		t.Fatal(e)
	}
	if bytes.Contains(b, []byte(c.HolderSecret)) || bytes.Contains(b, []byte("holderSecret")) {
		t.Fatal("issuer-facing credential leaked holder secret")
	}
}

func TestSplitEnrollmentAndPublicSnapshotIntegrity(t *testing.T) {
	dir := t.TempDir()
	holderPath := dir + "/holder.json"
	issuerPath := dir + "/issuer.json"
	credentialPath := dir + "/credential.json"
	snapshotPath := dir + "/snapshot.json"
	statePath := dir + "/private-state.json"
	if err := run([]string{"holder-new", "--out", holderPath}); err != nil {
		t.Fatal(err)
	}
	if err := run([]string{"issuer-new", "--out", issuerPath}); err != nil {
		t.Fatal(err)
	}
	var holder Holder
	if err := readJSON(holderPath, &holder); err != nil {
		t.Fatal(err)
	}
	// Issuer command takes no secret, only this commitment.
	if err := run([]string{"issue", "--issuer-key", issuerPath, "--commitment", holder.Commitment, "--index", "42", "--class", "7", "--expiry", "2000000000", "--out", credentialPath}); err != nil {
		t.Fatal(err)
	}
	var credential Credential
	if err := readJSON(credentialPath, &credential); err != nil {
		t.Fatal(err)
	}
	if credential.HolderSecret != "" {
		t.Fatal("issuer output contains holder secret")
	}
	if err := run([]string{"snapshot", "--revoke", "1,99,65535", "--out", snapshotPath}); err != nil {
		t.Fatal(err)
	}
	var public map[string]any
	if err := readJSON(snapshotPath, &public); err != nil {
		t.Fatal(err)
	}
	if len(public) != 4 {
		t.Fatal("public snapshot unexpected fields")
	}
	for _, key := range []string{"version", "depth", "root", "revokedIndices"} {
		if _, ok := public[key]; !ok {
			t.Fatal("missing public snapshot field")
		}
	}
	if err := run([]string{"state", "--snapshot", snapshotPath, "--credential", credentialPath, "--out", statePath}); err != nil {
		t.Fatal(err)
	}
	var state State
	if err := readJSON(statePath, &state); err != nil {
		t.Fatal(err)
	}
	credential.HolderSecret = holder.Secret
	a, err := assignment(&credential, &state, big.NewInt(12345), big.NewInt(0xCAFE), big.NewInt(1900000000), big.NewInt(7))
	if err != nil {
		t.Fatal(err)
	}
	cs, err := compile()
	if err != nil {
		t.Fatal(err)
	}
	w, err := frontend.NewWitness(a, ecc.BN254.ScalarField())
	if err != nil {
		t.Fatal(err)
	}
	if err = cs.IsSolved(w); err != nil {
		t.Fatal("independent holder/issuer enrollment failed combined relation")
	}
	public["root"] = "1"
	if err = writeJSON(snapshotPath, public, 0600); err != nil {
		t.Fatal(err)
	}
	if run([]string{"state", "--snapshot", snapshotPath, "--credential", credentialPath, "--out", statePath}) == nil {
		t.Fatal("tampered snapshot root accepted")
	}
}

func TestFieldParserDoesNotReduceOrInterpretDecimalAsOctal(t *testing.T) {
	for _, input := range []string{"000123", "123", "0x7b"} {
		v, e := field(input)
		if e != nil || v.Cmp(big.NewInt(123)) != 0 {
			t.Fatal("field parsing changed numeric meaning")
		}
	}
	for _, input := range []string{"-1", ecc.BN254.ScalarField().String(), "not-a-field"} {
		if _, e := field(input); e == nil {
			t.Fatal("noncanonical field accepted")
		}
	}
}
