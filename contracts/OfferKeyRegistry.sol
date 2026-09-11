// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;

/// @notice Authoritative seller-controlled offer key versions. Does not conceal settlement or cancel quotes.
contract OfferKeyRegistry {
    struct Key {
        bytes32 keyHash;
        uint256 version;
        uint256 validUntil;
    }
    mapping(address => mapping(bytes32 => Key)) public keys;
    event Registered(
        address indexed seller, bytes32 indexed requestId, bytes32 keyHash, uint256 version, uint256 validUntil
    );
    event Revoked(address indexed seller, bytes32 indexed requestId, uint256 version);
    error InvalidKey();

    function register(bytes32 requestId, bytes32 keyHash, uint256 version, uint256 validUntil) external {
        if (keyHash == bytes32(0) || version <= keys[msg.sender][requestId].version || validUntil <= block.timestamp) {
            revert InvalidKey();
        }
        keys[msg.sender][requestId] = Key(keyHash, version, validUntil);
        emit Registered(msg.sender, requestId, keyHash, version, validUntil);
    }

    function revoke(bytes32 requestId) external {
        Key storage key = keys[msg.sender][requestId];
        key.keyHash = bytes32(0);
        key.version++;
        key.validUntil = 0;
        emit Revoked(msg.sender, requestId, key.version);
    }
}
