// SPDX-License-Identifier: MIT
package main

import (
	"bytes"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"flag"
	"fmt"
	"github.com/consensys/gnark-crypto/ecc/bn254/twistededwards"
	"io"
	"math/big"
	"os"
)

// Errors never echo document contents or private fields accidentally supplied.
func readPublicDocument(path string, limit int64, output any) ([]byte, error) {
	f, e := os.Open(path)
	if e != nil {
		return nil, fmt.Errorf("public metadata file is unavailable")
	}
	defer f.Close()
	raw, e := io.ReadAll(io.LimitReader(f, limit+1))
	if e != nil || int64(len(raw)) > limit {
		return nil, fmt.Errorf("public metadata exceeds size limit")
	}
	d := json.NewDecoder(bytes.NewReader(raw))
	tok, e := d.Token()
	if e != nil || tok != json.Delim('{') {
		return nil, fmt.Errorf("public metadata must be a JSON object")
	}
	seen := map[string]bool{}
	allowed := map[string]bool{}
	switch output.(type) {
	case *registryPublicKey:
		for _, key := range []string{"version", "testOnly", "issuerX", "issuerY"} {
			allowed[key] = true
		}
	case *Snapshot:
		for _, key := range []string{"version", "depth", "root", "revokedIndices"} {
			allowed[key] = true
		}
	default:
		return nil, fmt.Errorf("unsupported public document type")
	}
	for d.More() {
		tok, e = d.Token()
		key, ok := tok.(string)
		if e != nil || !ok || seen[key] || !allowed[key] {
			return nil, fmt.Errorf("duplicate or invalid public metadata field")
		}
		seen[key] = true
		var value json.RawMessage
		if d.Decode(&value) != nil {
			return nil, fmt.Errorf("invalid public metadata JSON")
		}
	}
	if _, e = d.Token(); e != nil {
		return nil, fmt.Errorf("invalid public metadata JSON")
	}
	var trailing any
	if d.Decode(&trailing) != io.EOF {
		return nil, fmt.Errorf("trailing public metadata JSON")
	}
	d = json.NewDecoder(bytes.NewReader(raw))
	d.DisallowUnknownFields()
	if d.Decode(output) != nil {
		return nil, fmt.Errorf("unsupported public metadata fields or encoding")
	}
	return raw, nil
}
func canonicalPublicField(value string) (*big.Int, error) {
	if len(value) == 0 || len(value) > 77 || (len(value) > 1 && value[0] == '0') {
		return nil, fmt.Errorf("noncanonical public field")
	}
	for _, c := range value {
		if c < '0' || c > '9' {
			return nil, fmt.Errorf("noncanonical public field")
		}
	}
	return field(value)
}
func validatePublicMetadata(issuer registryPublicKey, snapshot Snapshot) error {
	if issuer.Version != registryVersion || !issuer.TestOnly {
		return fmt.Errorf("unsupported public issuer schema")
	}
	x, e := canonicalPublicField(issuer.IssuerX)
	if e != nil {
		return e
	}
	y, e := canonicalPublicField(issuer.IssuerY)
	if e != nil {
		return e
	}
	var point twistededwards.PointAffine
	point.X.SetBigInt(x)
	point.Y.SetBigInt(y)
	if !point.IsOnCurve() || point.IsZero() {
		return fmt.Errorf("issuer key must be a nonidentity curve point")
	}
	params := twistededwards.GetEdwardsCurve()
	var multiplied twistededwards.PointAffine
	multiplied.ScalarMultiplication(&point, &params.Order)
	if !multiplied.IsZero() {
		return fmt.Errorf("issuer key is outside the prime-order subgroup")
	}
	if snapshot.Version != Version || snapshot.Depth != Depth || snapshot.Revoked == nil || len(snapshot.Revoked) > registryCapacity {
		return fmt.Errorf("unsupported public snapshot schema")
	}
	root, e := canonicalPublicField(snapshot.Root)
	if e != nil || root.Sign() == 0 {
		return fmt.Errorf("invalid public snapshot root")
	}
	for i, index := range snapshot.Revoked {
		if index >= registryCapacity || (i > 0 && index <= snapshot.Revoked[i-1]) {
			return fmt.Errorf("revoked indices must be unique, ordered and in range")
		}
	}
	rebuilt, e := buildState(0, snapshot.Revoked)
	if e != nil {
		return fmt.Errorf("snapshot reconstruction failed")
	}
	if rebuilt.Root != snapshot.Root {
		return fmt.Errorf("snapshot root does not match revoked indices")
	}
	return nil
}
func validatePublic(args []string, out io.Writer) error {
	flags := flag.NewFlagSet("validate-public", flag.ContinueOnError)
	flags.SetOutput(io.Discard)
	ip := flags.String("issuer-public", "", "public issuer JSON")
	sp := flags.String("snapshot", "", "whole public snapshot JSON")
	if flags.Parse(args) != nil || flags.NArg() != 0 || *ip == "" || *sp == "" {
		return fmt.Errorf("validate-public requires --issuer-public and --snapshot")
	}
	var issuer registryPublicKey
	a, e := readPublicDocument(*ip, 4096, &issuer)
	if e != nil {
		return e
	}
	var snapshot Snapshot
	b, e := readPublicDocument(*sp, 1024*1024, &snapshot)
	if e != nil {
		return e
	}
	if e = validatePublicMetadata(issuer, snapshot); e != nil {
		return e
	}
	ah, bh := sha256.Sum256(a), sha256.Sum256(b)
	return json.NewEncoder(out).Encode(struct {
		Status         string `json:"status"`
		Version        string `json:"version"`
		TestOnly       bool   `json:"testOnly"`
		IssuerX        string `json:"issuerX"`
		IssuerY        string `json:"issuerY"`
		Root           string `json:"root"`
		Depth          int    `json:"depth"`
		RevokedCount   int    `json:"revokedCount"`
		IssuerSHA256   string `json:"issuerPublicSha256"`
		SnapshotSHA256 string `json:"snapshotSha256"`
		Trust          string `json:"trust"`
	}{"VALID_PUBLIC_METADATA", Version, true, issuer.IssuerX, issuer.IssuerY, snapshot.Root, snapshot.Depth, len(snapshot.Revoked), hex.EncodeToString(ah[:]), hex.EncodeToString(bh[:]), "Valid key and reconstructible snapshot; not proof of issuer key possession, snapshot authorship or freshness"})
}
