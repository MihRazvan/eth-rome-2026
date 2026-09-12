// SPDX-License-Identifier: MIT
pragma solidity 0.8.30;
import {QualificationKeys} from "../src/QualificationKeys.sol";
interface KeyVm { function prank(address) external; function expectRevert() external; function warp(uint256) external; }
contract QualificationKeysTest {
    KeyVm constant vm = KeyVm(address(uint160(uint256(keccak256("hevm cheat code")))));
    QualificationKeys registry;
    bytes key = hex"046b17d1f2e12c4247f8bce6e563a440f277037d812deb33a0f4a13945d898c2964fe342e2fe1a7f9b8ee7eb4a7c0f9e162bce33576b315ececbb6406837bf51f5";
    function setUp() public { vm.warp(1000); registry = new QualificationKeys(); }
    function testOwnerOnlyAndRevocationVersions() public {
        vm.prank(address(1)); registry.register(key, 2000);
        vm.prank(address(2)); registry.revoke();
        (bytes memory actual, uint64 until, uint64 version) = registry.keys(address(1));
        require(keccak256(actual) == keccak256(key) && until == 2000 && version == 1);
        vm.prank(address(1)); registry.revoke();
        (actual, until, version) = registry.keys(address(1));
        require(actual.length == 0 && until == 0 && version == 2);
        vm.prank(address(1)); registry.register(key, 3000);
        (,,version) = registry.keys(address(1)); require(version == 3);
    }
    function testBounds() public {
        vm.expectRevert(); registry.register(hex"04", 2000);
        vm.expectRevert(); registry.register(key, 1000);
        vm.expectRevert(); registry.register(key, uint64(1000 + 90 days + 1));
    }
}
