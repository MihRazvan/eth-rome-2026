// SPDX-License-Identifier: MIT
// Independent reviewer probes. Run with security/run-probes.sh; source remains untouched.
package main

import (
	"github.com/consensys/gnark-crypto/ecc"
	te "github.com/consensys/gnark-crypto/ecc/bn254/twistededwards"
	"github.com/consensys/gnark/frontend"
	"math/big"
	"testing"
)

func TestIndependentBoundaryProbes(t *testing.T) {
	cs, err := compile()
	if err != nil {
		t.Fatal(err)
	}
	fieldModulus := ecc.BN254.ScalarField()
	sqrtMinusOne := new(big.Int).ModSqrt(new(big.Int).Sub(fieldModulus, big.NewInt(1)), fieldModulus)
	if sqrtMinusOne == nil {
		t.Fatal("order-four fixture unavailable")
	}
	cases := []struct {
		name   string
		mutate func(*Circuit)
	}{
		{"order-two issuer", func(a *Circuit) {
			a.IssuerX = 0
			a.IssuerY = new(big.Int).Sub(fieldModulus, big.NewInt(1))
			a.Signature.R.X = 0
			a.Signature.R.Y = 1
			a.Signature.S = 0
		}},
		{"order-four issuer", func(a *Circuit) {
			a.IssuerX = sqrtMinusOne
			a.IssuerY = 0
			a.Signature.R.X = 0
			a.Signature.R.Y = 1
			a.Signature.S = 0
		}},
		{"off-curve issuer", func(a *Circuit) { a.IssuerX = 1; a.IssuerY = 1 }},
		{"zero secret", func(a *Circuit) { a.Secret = 0 }},
		{"249-bit secret", func(a *Circuit) { a.Secret = new(big.Int).Lsh(big.NewInt(1), 248) }},
		{"negative index field alias", func(a *Circuit) { a.Index = new(big.Int).Sub(fieldModulus, big.NewInt(1)) }},
		{"33-bit signed class", func(a *Circuit) { a.CredentialClass = new(big.Int).Lsh(big.NewInt(1), 32) }},
		{"65-bit signed expiry", func(a *Circuit) { a.Expiry = new(big.Int).Lsh(big.NewInt(1), 64) }},
		{"zero recipient", func(a *Circuit) { a.Recipient = 0 }},
		{"off-curve signature point", func(a *Circuit) { a.Signature.R.X = 1; a.Signature.R.Y = 1 }},
		{"noncanonical signature scalar", func(a *Circuit) { order := te.GetEdwardsCurve().Order; a.Signature.S = &order }},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			_, _, a := baseline(t)
			tc.mutate(a)
			w, e := frontend.NewWitness(a, fieldModulus)
			if e != nil {
				t.Fatal(e)
			}
			if cs.IsSolved(w) == nil {
				t.Fatal("invalid witness satisfied circuit")
			}
		})
	}
}
