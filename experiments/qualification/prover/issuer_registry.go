// SPDX-License-Identifier: MIT
package main

import (
	"crypto/hmac"
	"crypto/rand"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"errors"
	"flag"
	"fmt"
	"io"
	"os"
	"path/filepath"
	"sort"
	"strconv"
	"time"

	native "github.com/consensys/gnark-crypto/ecc/bn254/twistededwards/eddsa"
	"golang.org/x/sys/unix"
)

const registryVersion = "qualification-pilot-registry-v1"
const registryCapacity = 1 << Depth
const registryKeyName = "issuer-key.json"
const registryStateName = "registry-state.json"
const registryLockName = ".registry.lock"

type registryPublicKey struct {
	Version  string `json:"version"`
	TestOnly bool   `json:"testOnly"`
	IssuerX  string `json:"issuerX"`
	IssuerY  string `json:"issuerY"`
}
type registryRecord struct {
	Index      uint32 `json:"index"`
	Commitment string `json:"holderCommitment"`
	Class      uint32 `json:"class"`
	Expiry     uint64 `json:"expiry"`
	Signature  string `json:"signature,omitempty"` // empty means a durable reserved gap
}
type registryState struct {
	Version   string           `json:"version"`
	IssuerX   string           `json:"issuerX"`
	IssuerY   string           `json:"issuerY"`
	NextIndex uint32           `json:"nextIndex"`
	Records   []registryRecord `json:"records"`
	Revoked   []uint32         `json:"revokedIndices"`
}
type registryEnvelope struct {
	State registryState `json:"state"`
	MAC   string        `json:"stateMAC"`
}
type lockedRegistry struct {
	dir   string
	key   *native.PrivateKey
	state registryState
}

func registrySyncDir(dir string) error {
	f, err := os.Open(dir)
	if err != nil {
		return err
	}
	defer f.Close()
	return f.Sync()
}

// A synced temporary file is either renamed over an atomic state or linked into
// a previously absent output. No reader sees a partially written JSON document.
func registryAtomicJSON(path string, value any, replace bool) error {
	encoded, err := json.MarshalIndent(value, "", "  ")
	if err != nil {
		return err
	}
	encoded = append(encoded, '\n')
	parent := filepath.Dir(path)
	temp, err := os.CreateTemp(parent, ".registry-write-*")
	if err != nil {
		return err
	}
	temporary := temp.Name()
	defer os.Remove(temporary)
	if _, err = temp.Write(encoded); err == nil {
		err = temp.Sync()
	}
	closeErr := temp.Close()
	if err == nil {
		err = closeErr
	}
	if err != nil {
		return err
	}
	if replace {
		err = os.Rename(temporary, path)
	} else {
		err = os.Link(temporary, path)
	}
	if err != nil {
		return err
	}
	return registrySyncDir(parent)
}
func registryReadJSON(path string, out any, limit int64) error {
	info, err := os.Lstat(path)
	if err != nil {
		return err
	}
	if !info.Mode().IsRegular() || info.Mode().Perm()&0077 != 0 {
		return fmt.Errorf("registry private file must be a regular owner-only file")
	}
	if info.Size() > limit {
		return fmt.Errorf("registry file exceeds bounded size")
	}
	f, err := os.Open(path)
	if err != nil {
		return err
	}
	defer f.Close()
	decoder := json.NewDecoder(io.LimitReader(f, limit+1))
	decoder.DisallowUnknownFields()
	if err = decoder.Decode(out); err != nil {
		return fmt.Errorf("invalid registry JSON; refusing mutation")
	}
	var extra any
	if decoder.Decode(&extra) != io.EOF {
		return fmt.Errorf("trailing registry JSON; refusing mutation")
	}
	return nil
}
func registryMAC(key *native.PrivateKey, state registryState) ([]byte, error) {
	encoded, err := json.Marshal(state)
	if err != nil {
		return nil, err
	}
	derived := sha256.New()
	derived.Write([]byte("QUAL_PILOT_REGISTRY_STATE_MAC_V1\x00"))
	derived.Write(key.Bytes())
	mac := hmac.New(sha256.New, derived.Sum(nil))
	mac.Write(encoded)
	return mac.Sum(nil), nil
}
func (r *lockedRegistry) save() error {
	mac, err := registryMAC(r.key, r.state)
	if err != nil {
		return err
	}
	return registryAtomicJSON(filepath.Join(r.dir, registryStateName), registryEnvelope{State: r.state, MAC: hex.EncodeToString(mac)}, true)
}
func (r *lockedRegistry) load() error {
	var encoded IssuerKey
	if err := registryReadJSON(filepath.Join(r.dir, registryKeyName), &encoded, 4096); err != nil {
		return fmt.Errorf("cannot load issuer key: %w", err)
	}
	raw, err := hex.DecodeString(encoded.PrivateKey)
	if err != nil || len(raw) != 96 {
		return fmt.Errorf("invalid issuer key encoding")
	}
	var key native.PrivateKey
	if _, err = key.SetBytes(raw); err != nil {
		return fmt.Errorf("invalid issuer key")
	}
	if !encoded.TestOnly || encoded.X != key.PublicKey.A.X.String() || encoded.Y != key.PublicKey.A.Y.String() {
		return fmt.Errorf("issuer key metadata mismatch")
	}
	var envelope registryEnvelope
	if err = registryReadJSON(filepath.Join(r.dir, registryStateName), &envelope, 64<<20); err != nil {
		return fmt.Errorf("cannot load registry state: %w", err)
	}
	mac, err := registryMAC(&key, envelope.State)
	if err != nil {
		return err
	}
	given, err := hex.DecodeString(envelope.MAC)
	if err != nil || !hmac.Equal(mac, given) {
		return fmt.Errorf("registry authentication failed; refusing mutation")
	}
	state := envelope.State
	if state.Version != registryVersion || state.IssuerX != encoded.X || state.IssuerY != encoded.Y || state.NextIndex > registryCapacity || uint32(len(state.Records)) != state.NextIndex {
		return fmt.Errorf("invalid registry header or key association")
	}
	for index, record := range state.Records {
		commitment, e := field(record.Commitment)
		if e != nil || commitment.Sign() == 0 || commitment.String() != record.Commitment || record.Index != uint32(index) || record.Expiry == 0 {
			return fmt.Errorf("invalid allocation record")
		}
		if record.Signature != "" {
			sig, e := hex.DecodeString(record.Signature)
			if e != nil || len(sig) != 64 {
				return fmt.Errorf("invalid stored signature encoding")
			}
		}
	}
	for i, index := range state.Revoked {
		if index >= state.NextIndex || (i > 0 && state.Revoked[i-1] >= index) {
			return fmt.Errorf("invalid revocation ordering or unallocated index")
		}
	}
	var public registryPublicKey
	if err = registryReadJSON(filepath.Join(r.dir, "issuer-public.json"), &public, 4096); err != nil {
		return fmt.Errorf("cannot validate public issuer metadata: %w", err)
	}
	if public.Version != registryVersion || !public.TestOnly || public.IssuerX != encoded.X || public.IssuerY != encoded.Y {
		return fmt.Errorf("public issuer metadata differs from authenticated registry key")
	}
	r.key = &key
	r.state = state
	return nil
}

// The persistent lock inode must never be removed/replaced by these commands.
// flock is released by the OS on process death; no stale-lock deletion heuristic.
func withIssuerRegistry(dir string, initialize bool, action func(*lockedRegistry) error) error {
	if dir == "" {
		return fmt.Errorf("--dir required")
	}
	if initialize {
		if err := os.MkdirAll(dir, 0700); err != nil {
			return err
		}
		if err := registrySyncDir(filepath.Dir(dir)); err != nil {
			return err
		}
	}
	info, err := os.Lstat(dir)
	if err != nil {
		return err
	}
	if !info.IsDir() || info.Mode()&os.ModeSymlink != 0 || info.Mode().Perm()&0077 != 0 {
		return fmt.Errorf("registry directory must be a real owner-only directory (0700)")
	}
	canonical, err := filepath.EvalSymlinks(dir)
	if err != nil {
		return err
	}
	canonical, err = filepath.Abs(canonical)
	if err != nil {
		return err
	}
	fd, err := unix.Open(filepath.Join(canonical, registryLockName), unix.O_CREAT|unix.O_RDWR|unix.O_NOFOLLOW, 0600)
	if err != nil {
		return err
	}
	lock := os.NewFile(uintptr(fd), registryLockName)
	defer lock.Close()
	lockInfo, err := lock.Stat()
	if err != nil {
		return err
	}
	if !lockInfo.Mode().IsRegular() || lockInfo.Mode().Perm()&0077 != 0 {
		return fmt.Errorf("invalid registry lock file")
	}
	deadline := time.Now().Add(10 * time.Second)
	for {
		err = unix.Flock(fd, unix.LOCK_EX|unix.LOCK_NB)
		if err == nil {
			break
		}
		if !errors.Is(err, unix.EWOULDBLOCK) && !errors.Is(err, unix.EAGAIN) {
			return err
		}
		if time.Now().After(deadline) {
			return fmt.Errorf("registry is busy; retry without deleting the lock")
		}
		time.Sleep(10 * time.Millisecond)
	}
	defer unix.Flock(fd, unix.LOCK_UN)
	registry := &lockedRegistry{dir: canonical}
	if !initialize {
		if err = registry.load(); err != nil {
			return err
		}
	}
	return action(registry)
}
func registryInit(dir string) error {
	return withIssuerRegistry(dir, true, func(r *lockedRegistry) error {
		entries, err := os.ReadDir(r.dir)
		if err != nil {
			return err
		}
		for _, entry := range entries {
			if entry.Name() != registryLockName {
				return fmt.Errorf("registry directory is not empty; never reset or reinitialize an existing key")
			}
		}
		key, err := native.GenerateKey(rand.Reader)
		if err != nil {
			return err
		}
		encoded := IssuerKey{TestOnly: true, PrivateKey: hex.EncodeToString(key.Bytes()), X: key.PublicKey.A.X.String(), Y: key.PublicKey.A.Y.String()}
		// Commit key first. Any interrupted init leaves a nonempty directory which
		// init will refuse, rather than silently producing a fresh state for that key.
		if err = registryAtomicJSON(filepath.Join(r.dir, registryKeyName), encoded, false); err != nil {
			return err
		}
		r.key = key
		r.state = registryState{Version: registryVersion, IssuerX: encoded.X, IssuerY: encoded.Y, Records: []registryRecord{}, Revoked: []uint32{}}
		public := registryPublicKey{Version: registryVersion, TestOnly: true, IssuerX: encoded.X, IssuerY: encoded.Y}
		if err = registryAtomicJSON(filepath.Join(r.dir, "issuer-public.json"), public, false); err != nil {
			return err
		}
		if err = r.save(); err != nil {
			return err
		}
		return r.snapshot(filepath.Join(r.dir, "snapshot.json"))
	})
}
func (r *lockedRegistry) safeOutput(path string) (string, error) {
	if path == "" {
		return "", fmt.Errorf("--out required")
	}
	parent, err := filepath.EvalSymlinks(filepath.Dir(path))
	if err != nil {
		return "", err
	}
	destination, err := filepath.Abs(filepath.Join(parent, filepath.Base(path)))
	if err != nil {
		return "", err
	}
	if filepath.Dir(destination) == r.dir {
		switch filepath.Base(destination) {
		case registryKeyName, registryStateName, registryLockName, "issuer-public.json":
			return "", fmt.Errorf("output may not replace a protected registry file")
		}
	}
	return destination, nil
}
func (r *lockedRegistry) snapshot(path string) error {
	output, err := r.safeOutput(path)
	if err != nil {
		return err
	}
	state, err := buildState(0, r.state.Revoked)
	if err != nil {
		return err
	}
	return registryAtomicJSON(output, Snapshot{Version: Version, Depth: Depth, Root: state.Root, Revoked: append([]uint32{}, r.state.Revoked...)}, true)
}
func registryIssue(dir, commitment string, class uint32, expiry uint64, out string, afterReserve func() error) error {
	parsed, err := field(commitment)
	if err != nil || parsed.Sign() == 0 || expiry == 0 {
		return fmt.Errorf("nonzero canonical holder commitment and expiry required")
	}
	return withIssuerRegistry(dir, false, func(r *lockedRegistry) error {
		destination, err := r.safeOutput(out)
		if err != nil {
			return err
		}
		if _, err = os.Lstat(destination); !os.IsNotExist(err) {
			return fmt.Errorf("credential output must not already exist")
		}
		if r.state.NextIndex >= registryCapacity {
			return fmt.Errorf("issuer registry exhausted; rotate key and reissue, never reset slots")
		}
		index := r.state.NextIndex
		record := registryRecord{Index: index, Commitment: parsed.String(), Class: class, Expiry: expiry}
		r.state.Records = append(r.state.Records, record)
		r.state.NextIndex++
		if err = r.save(); err != nil {
			return err
		} // durable reservation BEFORE signature/output
		if afterReserve != nil {
			if err = afterReserve(); err != nil {
				return err
			}
		} // test-only injected process failure
		credential := Credential{Version: Version, TestOnly: true, HolderCommitment: record.Commitment, Index: index, Class: class, Expiry: expiry}
		if err = signCredential(&credential, r.key); err != nil {
			return err
		}
		r.state.Records[index].Signature = credential.Signature
		if err = r.save(); err != nil {
			return err
		}
		return registryAtomicJSON(destination, &credential, false)
	})
}
func registryRevoke(dir string, index uint32) error {
	return withIssuerRegistry(dir, false, func(r *lockedRegistry) error {
		if index >= r.state.NextIndex {
			return fmt.Errorf("cannot revoke an unallocated index")
		}
		position := sort.Search(len(r.state.Revoked), func(i int) bool { return r.state.Revoked[i] >= index })
		if position == len(r.state.Revoked) || r.state.Revoked[position] != index {
			r.state.Revoked = append(r.state.Revoked, index)
			sort.Slice(r.state.Revoked, func(i, j int) bool { return r.state.Revoked[i] < r.state.Revoked[j] })
			if err := r.save(); err != nil {
				return err
			}
		}
		// Retry also regenerates this derived snapshot if a prior publication failed.
		return r.snapshot(filepath.Join(r.dir, "snapshot.json"))
	})
}

// Integrator dispatch: case "registry": return issuerRegistry(args[1:]).
func issuerRegistry(args []string) error {
	if len(args) == 0 {
		return fmt.Errorf("registry commands: init, issue, revoke, snapshot")
	}
	f := flag.NewFlagSet("registry "+args[0], flag.ContinueOnError)
	f.SetOutput(io.Discard)
	dir := f.String("dir", "", "private registry directory")
	out := f.String("out", "", "credential or snapshot output path")
	commitment := f.String("commitment", "", "public holder commitment, never secret")
	classText := f.String("class", "", "uint32 qualification class")
	expiryText := f.String("expiry", "", "uint64 credential expiry")
	indexText := f.String("index", "", "allocated uint16 index to revoke")
	if err := f.Parse(args[1:]); err != nil {
		return fmt.Errorf("invalid registry arguments")
	}
	if f.NArg() != 0 {
		return fmt.Errorf("unexpected registry positional argument")
	}
	allowed := map[string]map[string]bool{
		"init":     {"dir": true},
		"issue":    {"dir": true, "commitment": true, "class": true, "expiry": true, "out": true},
		"revoke":   {"dir": true, "index": true},
		"snapshot": {"dir": true, "out": true},
	}
	invalidFlag := false
	f.Visit(func(selected *flag.Flag) {
		if !allowed[args[0]][selected.Name] {
			invalidFlag = true
		}
	})
	if invalidFlag {
		return fmt.Errorf("flag does not apply to this registry command")
	}
	switch args[0] {
	case "init":
		return registryInit(*dir)
	case "issue":
		class, err := strconv.ParseUint(*classText, 10, 32)
		if err != nil {
			return fmt.Errorf("--class must be uint32")
		}
		expiry, err := strconv.ParseUint(*expiryText, 10, 64)
		if err != nil {
			return fmt.Errorf("--expiry must be uint64")
		}
		return registryIssue(*dir, *commitment, uint32(class), expiry, *out, nil)
	case "revoke":
		index, err := strconv.ParseUint(*indexText, 10, 16)
		if err != nil {
			return fmt.Errorf("--index must be uint16")
		}
		return registryRevoke(*dir, uint32(index))
	case "snapshot":
		return withIssuerRegistry(*dir, false, func(r *lockedRegistry) error { return r.snapshot(*out) })
	default:
		return fmt.Errorf("unknown registry command")
	}
}
