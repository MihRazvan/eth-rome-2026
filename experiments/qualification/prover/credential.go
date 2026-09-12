// SPDX-License-Identifier: MIT
package main

import (
	"bytes"
	"crypto/rand"
	"crypto/sha256"
	"encoding/hex"
	"fmt"
	"io"
	"math/big"

	"github.com/consensys/gnark-crypto/ecc"
	"github.com/consensys/gnark-crypto/ecc/bn254/fr/mimc"
	native "github.com/consensys/gnark-crypto/ecc/bn254/twistededwards/eddsa"
	ted "github.com/consensys/gnark-crypto/ecc/twistededwards"
)

type Credential struct {
	Version          string `json:"version"`
	TestOnly         bool   `json:"testOnly"`
	HolderSecret     string `json:"-"`
	HolderCommitment string `json:"holderCommitment"`
	Index            uint32 `json:"index"`
	Class            uint32 `json:"class"`
	Expiry           uint64 `json:"expiry"`
	IssuerX          string `json:"issuerX"`
	IssuerY          string `json:"issuerY"`
	Signature        string `json:"signature"`
}

// Snapshot is issuer-wide public data; never add holder index/path fields here.
type Snapshot struct {
	Version string   `json:"version"`
	Depth   int      `json:"depth"`
	Root    string   `json:"root"`
	Revoked []uint32 `json:"revokedIndices"`
}
type State struct {
	Version string        `json:"version"`
	Depth   int           `json:"depth"`
	Index   uint32        `json:"privateWitnessIndex"`
	Root    string        `json:"root"`
	Path    [Depth]string `json:"privateWitnessPath"`
	Revoked []uint32      `json:"revokedIndices"`
}

func field(s string) (*big.Int, error) {
	base := 10
	if len(s) > 2 && (s[:2] == "0x" || s[:2] == "0X") {
		base = 16
		s = s[2:]
	}
	n, ok := new(big.Int).SetString(s, base)
	if !ok || n.Sign() < 0 || n.Cmp(ecc.BN254.ScalarField()) >= 0 {
		return nil, fmt.Errorf("invalid canonical BN254 scalar")
	}
	return n, nil
}
func uintField(n uint64) *big.Int { return new(big.Int).SetUint64(n) }
func nativeHash(label string, values ...*big.Int) *big.Int {
	h := mimc.NewMiMC()
	for _, v := range append([]*big.Int{domain(label)}, values...) {
		if _, err := h.Write(v.FillBytes(make([]byte, 32))); err != nil {
			panic(err)
		}
	}
	return new(big.Int).SetBytes(h.Sum(nil))
}
func signCredential(c *Credential, key *native.PrivateKey) error {
	commitment, err := field(c.HolderCommitment)
	if err != nil {
		return err
	}
	message := nativeHash(dCredential, commitment, uintField(uint64(c.Index)), uintField(uint64(c.Class)), uintField(c.Expiry))
	sig, err := key.Sign(message.FillBytes(make([]byte, 32)), mimc.NewMiMC())
	if err != nil {
		return err
	}
	verified, err := key.PublicKey.Verify(sig, message.FillBytes(make([]byte, 32)), mimc.NewMiMC())
	if err != nil || !verified {
		return fmt.Errorf("native signature self-check failed")
	}
	c.Signature = hex.EncodeToString(sig)
	c.IssuerX = key.PublicKey.A.X.String()
	c.IssuerY = key.PublicKey.A.Y.String()
	return nil
}
func testCredential(index, class uint32, expiry uint64, deterministic bool) (*Credential, error) {
	if index >= 1<<Depth {
		return nil, fmt.Errorf("index outside depth-16 registry")
	}
	var reader io.Reader = rand.Reader
	if deterministic {
		seed := sha256.Sum256([]byte("PUBLIC TEST ISSUER SEED qualification-v1; NEVER USE FOR REAL CREDENTIALS"))
		reader = bytes.NewReader(seed[:])
	}
	key, err := native.GenerateKey(reader)
	if err != nil {
		return nil, err
	}
	secretBytes := make([]byte, 31)
	if deterministic {
		seed := sha256.Sum256([]byte("PUBLIC TEST HOLDER SECRET qualification-v1; NOT PRIVATE"))
		copy(secretBytes, seed[:31])
	} else {
		if _, err = io.ReadFull(rand.Reader, secretBytes); err != nil {
			return nil, err
		}
	}
	secret := new(big.Int).SetBytes(secretBytes)
	if secret.Sign() == 0 {
		secret.SetInt64(1)
	}
	c := &Credential{Version: Version, TestOnly: true, HolderSecret: secret.String(), HolderCommitment: nativeHash(dHolder, secret).String(), Index: index, Class: class, Expiry: expiry}
	return c, signCredential(c, key)
}

// Sparse status tree; a leaf means status=0 or status=1, not credential content.
func buildState(index uint32, revoked []uint32) (*State, error) {
	if index >= 1<<Depth {
		return nil, fmt.Errorf("index outside registry")
	}
	var defaults [Depth + 1]*big.Int
	defaults[0] = nativeHash(dLeaf, big.NewInt(0))
	for i := 1; i <= Depth; i++ {
		defaults[i] = nativeHash(dNode, defaults[i-1], defaults[i-1])
	}
	nodes := make(map[uint32]*big.Int)
	for _, v := range revoked {
		if v >= 1<<Depth {
			return nil, fmt.Errorf("revoked index outside registry")
		}
		nodes[v] = nativeHash(dLeaf, big.NewInt(1))
	}
	state := &State{Version: Version, Depth: Depth, Index: index, Revoked: revoked}
	position := index
	for level := 0; level < Depth; level++ {
		sibling, ok := nodes[position^1]
		if !ok {
			sibling = defaults[level]
		}
		state.Path[level] = sibling.String()
		parents := make(map[uint32]*big.Int)
		for p := range nodes {
			parent := p >> 1
			left, ok := nodes[parent*2]
			if !ok {
				left = defaults[level]
			}
			right, ok := nodes[parent*2+1]
			if !ok {
				right = defaults[level]
			}
			parents[parent] = nativeHash(dNode, left, right)
		}
		nodes = parents
		position >>= 1
	}
	root, ok := nodes[0]
	if !ok {
		root = defaults[Depth]
	}
	state.Root = root.String()
	return state, nil
}

func assignment(c *Credential, s *State, context, recipient, deadline, requiredClass *big.Int) (*Circuit, error) {
	if c.Version != Version || s.Version != Version || s.Depth != Depth || c.Index != s.Index {
		return nil, fmt.Errorf("credential/state format or signed index mismatch")
	}
	if recipient.Sign() == 0 || recipient.BitLen() > 160 || deadline.BitLen() > 64 || requiredClass.BitLen() > 32 {
		return nil, fmt.Errorf("recipient/deadline/class out of range")
	}
	secret, err := field(c.HolderSecret)
	if err != nil {
		return nil, err
	}
	commitment, err := field(c.HolderCommitment)
	if err != nil {
		return nil, err
	}
	x, err := field(c.IssuerX)
	if err != nil {
		return nil, err
	}
	y, err := field(c.IssuerY)
	if err != nil {
		return nil, err
	}
	root, err := field(s.Root)
	if err != nil {
		return nil, err
	}
	sig, err := hex.DecodeString(c.Signature)
	if err != nil || len(sig) != 64 {
		return nil, fmt.Errorf("signature must be exactly 64 hex bytes")
	}
	// Validate compressed signature before the gnark Assign helper, which panics on malformed data.
	var nativeSig native.Signature
	if _, err = nativeSig.SetBytes(sig); err != nil {
		return nil, fmt.Errorf("invalid signature encoding")
	}
	a := &Circuit{IssuerX: x, IssuerY: y, Root: root, Class: requiredClass, Deadline: deadline, Context: context, Recipient: recipient,
		Nullifier: nativeHash(dNullifier, secret, context), Tag: nativeHash(dPresentation, secret, context, recipient, deadline),
		Secret: secret, HolderCommitment: commitment, Index: c.Index, CredentialClass: c.Class, Expiry: c.Expiry}
	a.Signature.Assign(ted.BN254, sig)
	for i := range a.Path {
		a.Path[i], err = field(s.Path[i])
		if err != nil {
			return nil, err
		}
	}
	return a, nil
}
