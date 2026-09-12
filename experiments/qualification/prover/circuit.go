// SPDX-License-Identifier: MIT
package main

import (
	"math/big"

	ted "github.com/consensys/gnark-crypto/ecc/twistededwards"
	"github.com/consensys/gnark/frontend"
	"github.com/consensys/gnark/std/algebra/native/twistededwards"
	"github.com/consensys/gnark/std/hash/mimc"
	"github.com/consensys/gnark/std/signature/eddsa"
)

const Depth = 16
const Version = "qualification-v1-test"
const (
	dHolder       = "QUAL_V1_HOLDER"
	dCredential   = "QUAL_V1_CREDENTIAL"
	dLeaf         = "QUAL_V1_STATUS"
	dNode         = "QUAL_V1_NODE"
	dNullifier    = "QUAL_V1_NULLIFIER"
	dPresentation = "QUAL_V1_PRESENTATION"
)

// Declaration order is the public-input ABI; never reorder without integration review.
type Circuit struct {
	IssuerX          frontend.Variable `gnark:",public"`
	IssuerY          frontend.Variable `gnark:",public"`
	Root             frontend.Variable `gnark:",public"`
	Class            frontend.Variable `gnark:",public"`
	Deadline         frontend.Variable `gnark:",public"`
	Context          frontend.Variable `gnark:",public"`
	Recipient        frontend.Variable `gnark:",public"`
	Nullifier        frontend.Variable `gnark:",public"`
	Tag              frontend.Variable `gnark:",public"`
	Secret           frontend.Variable
	HolderCommitment frontend.Variable
	Index            frontend.Variable
	CredentialClass  frontend.Variable
	Expiry           frontend.Variable
	Signature        eddsa.Signature
	Path             [Depth]frontend.Variable
}

func domain(s string) *big.Int { return new(big.Int).SetBytes([]byte(s)) }
func circuitHash(api frontend.API, label string, values ...frontend.Variable) frontend.Variable {
	h, err := mimc.NewMiMC(api)
	if err != nil {
		panic(err)
	}
	h.Write(domain(label))
	h.Write(values...)
	return h.Sum()
}

func (c *Circuit) Define(api frontend.API) error {
	// All comparison operands are explicitly unsigned and bounded below field modulus.
	api.ToBinary(c.Secret, 248)
	api.AssertIsDifferent(c.Secret, 0)
	indexBits := api.ToBinary(c.Index, Depth)
	api.ToBinary(c.CredentialClass, 32)
	api.ToBinary(c.Class, 32)
	api.ToBinary(c.Expiry, 64)
	api.ToBinary(c.Deadline, 64)
	api.ToBinary(c.Recipient, 160)
	api.AssertIsDifferent(c.Recipient, 0)
	api.AssertIsEqual(c.CredentialClass, c.Class)
	api.AssertIsLessOrEqual(c.Deadline, c.Expiry)
	api.AssertIsEqual(c.HolderCommitment, circuitHash(api, dHolder, c.Secret))
	message := circuitHash(api, dCredential, c.HolderCommitment, c.Index, c.CredentialClass, c.Expiry)
	curve, err := twistededwards.NewEdCurve(api, ted.BN254)
	if err != nil {
		return err
	}
	pub := eddsa.PublicKey{A: twistededwards.Point{X: c.IssuerX, Y: c.IssuerY}}
	curve.AssertIsOnCurve(pub.A)
	curve.AssertIsOnCurve(c.Signature.R)
	api.AssertIsDifferent(pub.A.X, 0) // excludes identity and order-two point
	// Generic ScalarMul assumes subgroup input and its half-GCD hint cannot take
	// the subgroup order. Explicit constant multiplication avoids that circular
	// assumption while actually checking membership.
	primeCheck := twistededwards.Point{X: 0, Y: 1}
	order := curve.Params().Order
	for bit := order.BitLen() - 1; bit >= 0; bit-- {
		primeCheck = curve.Double(primeCheck)
		if order.Bit(bit) == 1 {
			primeCheck = curve.Add(primeCheck, pub.A)
		}
	}
	api.AssertIsEqual(primeCheck.X, 0)
	api.AssertIsEqual(primeCheck.Y, 1)
	signatureHash, err := mimc.NewMiMC(api)
	if err != nil {
		return err
	}
	if err = eddsa.Verify(curve, c.Signature, message, pub, &signatureHash); err != nil {
		return err
	}
	// The admitted leaf is a literal non-revoked status. Branch bits are the SAME
	// index used above in the issuer-signed message; there is no second path index.
	node := circuitHash(api, dLeaf, 0)
	for level := 0; level < Depth; level++ {
		left := api.Select(indexBits[level], c.Path[level], node)
		right := api.Select(indexBits[level], node, c.Path[level])
		node = circuitHash(api, dNode, left, right)
	}
	api.AssertIsEqual(node, c.Root)
	api.AssertIsEqual(c.Nullifier, circuitHash(api, dNullifier, c.Secret, c.Context))
	api.AssertIsEqual(c.Tag, circuitHash(api, dPresentation, c.Secret, c.Context, c.Recipient, c.Deadline))
	return nil
}
