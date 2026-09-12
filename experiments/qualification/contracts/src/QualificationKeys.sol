// SPDX-License-Identifier: MIT
pragma solidity 0.8.30;

/// Wallet-owned public encryption directory. Historical ciphertext cannot be recalled.
contract QualificationKeys {
    struct Binding { bytes publicKey; uint64 expiresAt; uint64 version; }
    mapping(address => Binding) public keys;
    error InvalidKey();
    event KeyRegistered(address indexed owner, uint64 indexed version, bytes publicKey, uint64 expiresAt);
    event KeyRevoked(address indexed owner, uint64 indexed version);

    function register(bytes calldata publicKey, uint64 expiresAt) external {
        // Clients additionally validate P-256 curve membership through WebCrypto import.
        if (publicKey.length != 65 || publicKey[0] != 0x04 || expiresAt <= block.timestamp
            || expiresAt > block.timestamp + 90 days) revert InvalidKey();
        Binding storage b = keys[msg.sender];
        b.version++;
        b.publicKey = publicKey;
        b.expiresAt = expiresAt;
        emit KeyRegistered(msg.sender, b.version, publicKey, expiresAt);
    }
    function revoke() external {
        Binding storage b = keys[msg.sender];
        b.version++;
        delete b.publicKey;
        b.expiresAt = 0;
        emit KeyRevoked(msg.sender, b.version);
    }
}
