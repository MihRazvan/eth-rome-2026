// SPDX-License-Identifier: MIT
package main

import (
	"crypto/rand"
	"encoding/hex"
	"encoding/json"
	"flag"
	"fmt"
	"io"
	"math/big"
	"os"
	"path/filepath"
	"runtime"
	"strconv"
	"strings"
	"time"

	"github.com/consensys/gnark-crypto/ecc"
	"github.com/consensys/gnark-crypto/ecc/bn254/fr"
	native "github.com/consensys/gnark-crypto/ecc/bn254/twistededwards/eddsa"
	"github.com/consensys/gnark/backend/groth16"
	grothbn "github.com/consensys/gnark/backend/groth16/bn254"
	"github.com/consensys/gnark/constraint"
	"github.com/consensys/gnark/frontend"
	"github.com/consensys/gnark/frontend/cs/r1cs"
	"github.com/consensys/gnark/logger"
)

type Holder struct {
	Version    string `json:"version"`
	TestOnly   bool   `json:"testOnly"`
	Secret     string `json:"holderSecret"`
	Commitment string `json:"holderCommitment"`
}
type IssuerKey struct {
	TestOnly   bool   `json:"testOnly"`
	PrivateKey string `json:"privateKey"`
	X          string `json:"issuerX"`
	Y          string `json:"issuerY"`
}
type ProofOutput struct {
	Version          string   `json:"version"`
	TestSetup        bool     `json:"testSetup"`
	Proof            string   `json:"proof"`
	PublicInputs     []string `json:"publicInputs"`
	PublicInputNames []string `json:"publicInputNames"`
	ProofBytes       int      `json:"proofBytes"`
	Constraints      int      `json:"constraints"`
	ProveMS          float64  `json:"proveMs"`
	VerifyMS         float64  `json:"verifyMs"`
	GoHeapAllocBytes uint64   `json:"goHeapAllocBytes"`
	GoSysBytes       uint64   `json:"goSysBytes"`
}

var inputNames = []string{"issuerX", "issuerY", "root", "class", "deadline", "context", "recipient", "nullifier", "presentationTag"}

func readJSON(path string, out any) error {
	f, err := os.Open(path)
	if err != nil {
		return err
	}
	defer f.Close()
	decoder := json.NewDecoder(io.LimitReader(f, 1<<20))
	decoder.DisallowUnknownFields()
	if err = decoder.Decode(out); err != nil {
		return fmt.Errorf("invalid JSON input")
	}
	var extra any
	if decoder.Decode(&extra) != io.EOF {
		return fmt.Errorf("trailing JSON input")
	}
	return nil
}
func writeJSON(path string, v any, mode os.FileMode) error {
	b, err := json.MarshalIndent(v, "", "  ")
	if err != nil {
		return err
	}
	if err = os.MkdirAll(filepath.Dir(path), 0700); err != nil {
		return err
	}
	return os.WriteFile(path, append(b, '\n'), mode)
}
func writeObject(path string, obj io.WriterTo) error {
	f, err := os.OpenFile(path, os.O_CREATE|os.O_TRUNC|os.O_WRONLY, 0600)
	if err != nil {
		return err
	}
	_, err = obj.WriteTo(f)
	closeErr := f.Close()
	if err != nil {
		return err
	}
	return closeErr
}
func readObject(path string, obj io.ReaderFrom) error {
	f, err := os.Open(path)
	if err != nil {
		return err
	}
	defer f.Close()
	_, err = obj.ReadFrom(f)
	return err
}
func compile() (constraint.ConstraintSystem, error) {
	return frontend.Compile(ecc.BN254.ScalarField(), r1cs.NewBuilder, &Circuit{})
}
func setup(dir, verifierPath string) error {
	start := time.Now()
	cs, err := compile()
	if err != nil {
		return err
	}
	pk, vk, err := groth16.Setup(cs)
	if err != nil {
		return err
	}
	if err = os.MkdirAll(dir, 0700); err != nil {
		return err
	}
	for name, obj := range map[string]io.WriterTo{"circuit.r1cs": cs, "proving.key": pk, "verifying.key": vk} {
		if err = writeObject(filepath.Join(dir, name), obj); err != nil {
			return err
		}
	}
	if err = os.MkdirAll(filepath.Dir(verifierPath), 0755); err != nil {
		return err
	}
	f, err := os.Create(verifierPath)
	if err != nil {
		return err
	}
	err = vk.ExportSolidity(f)
	f.Close()
	if err != nil {
		return err
	}
	abi := []any{map[string]any{"type": "function", "name": "verifyProof", "stateMutability": "view", "inputs": []any{map[string]string{"name": "proof", "type": "bytes"}, map[string]string{"name": "input", "type": "uint256[9]"}}, "outputs": []any{}}}
	if err = writeJSON(filepath.Join(filepath.Dir(verifierPath), "verifier-abi.json"), abi, 0644); err != nil {
		return err
	}
	var mem runtime.MemStats
	runtime.ReadMemStats(&mem)
	meta := map[string]any{"version": Version, "testSetup": true, "setupTrust": "Single-process random Groth16 setup; no ceremony or production trust claim", "constraints": cs.GetNbConstraints(), "publicInputs": inputNames, "setupMs": float64(time.Since(start).Microseconds()) / 1000, "goHeapAllocBytes": mem.HeapAlloc, "goSysBytes": mem.Sys, "goVersion": runtime.Version(), "gnark": "v0.15.0", "gnarkCrypto": "v0.20.1"}
	if err = writeJSON(filepath.Join(dir, "setup.json"), meta, 0644); err != nil {
		return err
	}
	return writeJSON(filepath.Join(filepath.Dir(verifierPath), "setup-metadata.json"), meta, 0644)
}
func loadSetup(dir string) (constraint.ConstraintSystem, groth16.ProvingKey, groth16.VerifyingKey, error) {
	cs := groth16.NewCS(ecc.BN254)
	pk := groth16.NewProvingKey(ecc.BN254)
	vk := groth16.NewVerifyingKey(ecc.BN254)
	for name, obj := range map[string]io.ReaderFrom{"circuit.r1cs": cs, "proving.key": pk, "verifying.key": vk} {
		if err := readObject(filepath.Join(dir, name), obj); err != nil {
			return nil, nil, nil, err
		}
	}
	return cs, pk, vk, nil
}
func generateProof(cs constraint.ConstraintSystem, pk groth16.ProvingKey, vk groth16.VerifyingKey, a *Circuit) (*ProofOutput, error) {
	full, err := frontend.NewWitness(a, ecc.BN254.ScalarField())
	if err != nil {
		return nil, fmt.Errorf("invalid witness encoding")
	}
	public, err := full.Public()
	if err != nil {
		return nil, err
	}
	start := time.Now()
	proof, err := groth16.Prove(cs, pk, full)
	elapsed := time.Since(start)
	if err != nil {
		return nil, fmt.Errorf("credential does not satisfy qualification circuit")
	}
	start = time.Now()
	if err = groth16.Verify(proof, vk, public); err != nil {
		return nil, fmt.Errorf("generated proof failed local verification")
	}
	verifyTime := time.Since(start)
	vector := public.Vector().(fr.Vector)
	inputs := make([]string, len(vector))
	for i := range vector {
		inputs[i] = vector[i].String()
	}
	if len(inputs) != 9 {
		return nil, fmt.Errorf("public input ABI changed: got %d", len(inputs))
	}
	serialized := proof.(*grothbn.Proof).MarshalSolidity()
	if len(serialized) != 256 {
		return nil, fmt.Errorf("unexpected Solidity proof length %d", len(serialized))
	}
	var mem runtime.MemStats
	runtime.ReadMemStats(&mem)
	return &ProofOutput{Version: Version, TestSetup: true, Proof: "0x" + hex.EncodeToString(serialized), PublicInputs: inputs, PublicInputNames: inputNames, ProofBytes: len(serialized), Constraints: cs.GetNbConstraints(), ProveMS: float64(elapsed.Microseconds()) / 1000, VerifyMS: float64(verifyTime.Microseconds()) / 1000, GoHeapAllocBytes: mem.HeapAlloc, GoSysBytes: mem.Sys}, nil
}
func parseRevoked(s string) ([]uint32, error) {
	values := []uint32{}
	if s == "" {
		return values, nil
	}
	for _, part := range strings.Split(s, ",") {
		n, err := strconv.ParseUint(part, 10, 16)
		if err != nil {
			return nil, fmt.Errorf("revoked indices must be comma-separated uint16")
		}
		values = append(values, uint32(n))
	}
	return values, nil
}
func run(args []string) error {
	if len(args) == 0 {
		return fmt.Errorf("commands: setup, holder-new, issuer-new, issue, test-credential, snapshot, state, prove")
	}
	f := flag.NewFlagSet(args[0], flag.ContinueOnError)
	out := f.String("out", "", "output JSON path")
	switch args[0] {
	case "registry":
		return issuerRegistry(args[1:])
	case "setup":
		dir := f.String("dir", ".local/setup", "local setup directory")
		verifier := f.String("verifier", "artifacts/QualificationVerifier.sol", "exported verifier path")
		if err := f.Parse(args[1:]); err != nil {
			return err
		}
		return setup(*dir, *verifier)
	case "holder-new":
		if err := f.Parse(args[1:]); err != nil {
			return err
		}
		if *out == "" {
			return fmt.Errorf("--out required")
		}
		b := make([]byte, 31)
		if _, err := io.ReadFull(rand.Reader, b); err != nil {
			return err
		}
		secret := new(big.Int).SetBytes(b)
		if secret.Sign() == 0 {
			secret.SetInt64(1)
		}
		return writeJSON(*out, &Holder{Version: Version, TestOnly: true, Secret: secret.String(), Commitment: nativeHash(dHolder, secret).String()}, 0600)
	case "issuer-new":
		if err := f.Parse(args[1:]); err != nil {
			return err
		}
		if *out == "" {
			return fmt.Errorf("--out required")
		}
		key, err := native.GenerateKey(rand.Reader)
		if err != nil {
			return err
		}
		return writeJSON(*out, &IssuerKey{TestOnly: true, PrivateKey: hex.EncodeToString(key.Bytes()), X: key.PublicKey.A.X.String(), Y: key.PublicKey.A.Y.String()}, 0600)
	case "issue", "test-credential":
		index := f.Uint("index", 42, "registry index uint16")
		class := f.Uint("class", 7, "class uint32")
		expiry := f.Uint64("expiry", 2000000000, "credential expiry uint64")
		issuer := f.String("issuer-key", "", "local issuer key (issue only)")
		commitment := f.String("commitment", "", "holder commitment; never holder secret")
		holderOut := f.String("holder-out", "", "separate holder secret output (test-credential only)")
		deterministic := f.Bool("public-deterministic-test", false, "use explicitly public dummy fixture seeds")
		if err := f.Parse(args[1:]); err != nil {
			return err
		}
		if *out == "" || *index >= 1<<16 || uint64(*class) > 1<<32-1 {
			return fmt.Errorf("--out and bounded index/class required")
		}
		var c *Credential
		if args[0] == "test-credential" {
			if *holderOut == "" {
				return fmt.Errorf("--holder-out required; secret never included in credential")
			}
			var err error
			c, err = testCredential(uint32(*index), uint32(*class), *expiry, *deterministic)
			if err != nil {
				return err
			}
			if err = writeJSON(*holderOut, &Holder{Version: Version, TestOnly: true, Secret: c.HolderSecret, Commitment: c.HolderCommitment}, 0600); err != nil {
				return err
			}
		} else {
			parsed, err := field(*commitment)
			if err != nil {
				return fmt.Errorf("canonical --commitment required")
			}
			var encoded IssuerKey
			if err = readJSON(*issuer, &encoded); err != nil {
				return fmt.Errorf("cannot read issuer key")
			}
			raw, err := hex.DecodeString(encoded.PrivateKey)
			if err != nil || len(raw) != 96 {
				return fmt.Errorf("invalid issuer key encoding")
			}
			var key native.PrivateKey
			if _, err = key.SetBytes(raw); err != nil {
				return fmt.Errorf("invalid issuer key")
			}
			c = &Credential{Version: Version, TestOnly: true, HolderCommitment: parsed.String(), Index: uint32(*index), Class: uint32(*class), Expiry: *expiry}
			if err = signCredential(c, &key); err != nil {
				return err
			}
		}
		return writeJSON(*out, c, 0600)
	case "snapshot":
		revoke := f.String("revoke", "", "comma separated public revoked indices")
		if err := f.Parse(args[1:]); err != nil {
			return err
		}
		if *out == "" {
			return fmt.Errorf("--out required")
		}
		revoked, err := parseRevoked(*revoke)
		if err != nil {
			return err
		}
		s, err := buildState(0, revoked)
		if err != nil {
			return err
		}
		return writeJSON(*out, &Snapshot{Version: Version, Depth: Depth, Root: s.Root, Revoked: revoked}, 0644)
	case "state":
		credential := f.String("credential", "", "local credential for private witness index")
		revoke := f.String("revoke", "", "test-only manually supplied revoked indices")
		snapshot := f.String("snapshot", "", "public issuer snapshot to validate and reconstruct")
		if err := f.Parse(args[1:]); err != nil {
			return err
		}
		if *out == "" {
			return fmt.Errorf("--out required")
		}
		var c Credential
		if err := readJSON(*credential, &c); err != nil {
			return err
		}
		revoked, err := parseRevoked(*revoke)
		if err != nil {
			return err
		}
		var public Snapshot
		if *snapshot != "" {
			if *revoke != "" {
				return fmt.Errorf("choose --snapshot or test-only --revoke, not both")
			}
			if err = readJSON(*snapshot, &public); err != nil {
				return err
			}
			if public.Version != Version || public.Depth != Depth {
				return fmt.Errorf("unsupported public snapshot")
			}
			revoked = public.Revoked
		}
		s, err := buildState(c.Index, revoked)
		if err != nil {
			return err
		}
		if *snapshot != "" && s.Root != public.Root {
			return fmt.Errorf("snapshot root does not match revoked indices")
		}
		return writeJSON(*out, s, 0600)
	case "prove":
		dir := f.String("setup", ".local/setup", "setup directory")
		credential := f.String("credential", "", "credential JSON")
		holder := f.String("holder", "", "local holder secret JSON")
		state := f.String("state", "", "current state/path JSON")
		context := f.String("context", "", "canonical reduced field job context")
		recipient := f.String("recipient", "", "Ethereum address hex or decimal uint160")
		deadline := f.String("deadline", "", "uint64 timestamp")
		class := f.String("class", "", "required uint32 class")
		if err := f.Parse(args[1:]); err != nil {
			return err
		}
		if *out == "" {
			return fmt.Errorf("--out required")
		}
		var c Credential
		var s State
		var h Holder
		if err := readJSON(*credential, &c); err != nil {
			return err
		}
		if err := readJSON(*holder, &h); err != nil {
			return err
		}
		if err := readJSON(*state, &s); err != nil {
			return err
		}
		if h.Version != Version || h.Commitment != c.HolderCommitment {
			return fmt.Errorf("holder file does not match credential commitment")
		}
		c.HolderSecret = h.Secret
		ctx, err := field(*context)
		if err != nil {
			return fmt.Errorf("invalid --context")
		}
		rec, err := field(*recipient)
		if err != nil {
			return fmt.Errorf("invalid --recipient")
		}
		dl, err := field(*deadline)
		if err != nil {
			return fmt.Errorf("invalid --deadline")
		}
		cl, err := field(*class)
		if err != nil {
			return fmt.Errorf("invalid --class")
		}
		a, err := assignment(&c, &s, ctx, rec, dl, cl)
		if err != nil {
			return err
		}
		cs, pk, vk, err := loadSetup(*dir)
		if err != nil {
			return fmt.Errorf("cannot load local setup")
		}
		proof, err := generateProof(cs, pk, vk, a)
		if err != nil {
			return err
		}
		return writeJSON(*out, proof, 0644)
	default:
		return fmt.Errorf("unknown command")
	}
}
func main() {
	logger.Disable()
	if err := run(os.Args[1:]); err != nil {
		fmt.Fprintln(os.Stderr, err)
		os.Exit(1)
	}
}
