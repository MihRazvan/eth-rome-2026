// SPDX-License-Identifier: MIT
pragma solidity 0.8.30;
import {Verifier} from "qualification-prover/artifacts/QualificationVerifier.sol";

interface ProofVm {
    function readFile(string calldata) external view returns (string memory);
    function parseJsonBytes(string calldata, string calldata) external pure returns (bytes memory);
    function parseJsonString(string calldata, string calldata) external pure returns (string memory);
    function parseUint(string calldata) external pure returns (uint256);
    function toString(uint256) external pure returns (string memory);
    function expectRevert() external;
}

/// Actual gnark-generated proofs against their matching exported verifier, without a verifier double.
contract RealQualificationProofTest {
    ProofVm constant vm = ProofVm(address(uint160(uint256(keccak256("hevm cheat code")))));
    Verifier verifier;
    function setUp() public { verifier = new Verifier(); }
    function fixture(string memory name) internal view returns (bytes memory proof, uint256[9] memory input) {
        string memory data = vm.readFile(string.concat("../prover/fixtures/", name, ".json"));
        proof = vm.parseJsonBytes(data, ".proof");
        for (uint256 i; i < 9; i++) input[i] = vm.parseUint(vm.parseJsonString(data, string.concat(".publicInputs[", vm.toString(i), "]")));
    }
    function testRealProofVerifies() public view {
        (bytes memory proof, uint256[9] memory input) = fixture("valid-proof");
        require(proof.length == 256);
        verifier.verifyProof(proof, input);
    }
    function testEveryChangedPublicInputRejected() public {
        (bytes memory proof, uint256[9] memory input) = fixture("valid-proof");
        for (uint256 i; i < 9; i++) {
            input[i]++;
            vm.expectRevert(); verifier.verifyProof(proof, input);
            input[i]--;
        }
    }
    function testSecondRecipientKeepsScopedNullifier() public view {
        (bytes memory proof, uint256[9] memory input) = fixture("valid-proof");
        (bytes memory second, uint256[9] memory changed) = fixture("valid-second-recipient-proof");
        verifier.verifyProof(proof, input);
        verifier.verifyProof(second, changed);
        require(input[6] != changed[6] && input[7] == changed[7]);
    }
    function testMalformedProofRejected() public {
        (, uint256[9] memory input) = fixture("valid-proof");
        vm.expectRevert(); verifier.verifyProof(hex"1234", input);
    }
}
