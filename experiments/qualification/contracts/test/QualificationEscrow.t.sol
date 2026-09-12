// SPDX-License-Identifier: MIT
pragma solidity 0.8.30;
import {QualificationEscrow, IQualificationVerifier} from "../src/QualificationEscrow.sol";
import {DemoUSD} from "../src/DemoUSD.sol";

interface Vm {
    function prank(address) external;
    function warp(uint256) external;
    function expectRevert() external;
}

/// Unit-test double ONLY. Actual cryptographic acceptance is a separate integration check.
contract StateMachineVerifierDouble is IQualificationVerifier {
    function verifyProof(bytes calldata proof, uint256[9] calldata) external pure {
        require(keccak256(proof) == keccak256(hex"1234"), "unit-test verifier rejected");
    }
}

contract QualificationEscrowTest {
    Vm constant vm = Vm(address(uint160(uint256(keccak256("hevm cheat code")))));
    QualificationEscrow escrow;
    DemoUSD token;
    address constant CLIENT = address(101);
    address constant WORKER = address(102);
    address constant ATTACKER = address(103);
    address constant ARBITRATOR = address(104);

    function setUp() public {
        vm.warp(1000);
        token = new DemoUSD();
        escrow = new QualificationEscrow(token, new StateMachineVerifierDouble(), 1, 2, 3, ARBITRATOR);
        token.mint(CLIENT, 1000);
        vm.prank(CLIENT);
        token.approve(address(escrow), type(uint256).max);
    }
    function create() internal returns (uint256) {
        vm.prank(CLIENT);
        return escrow.createJob(100, 7, 1100, 1200, 1300, keccak256("terms"));
    }
    function statement(uint256 id) internal view returns (uint256[9] memory) {
        return [uint256(1), 2, escrow.revocationRoot(), 7, 1099, escrow.contextFor(id), uint256(uint160(WORKER)), id, 9];
    }
    function accepted() internal returns (uint256 id) {
        id = create();
        escrow.accept(id, hex"1234", statement(id));
    }
    function submitted() internal returns (uint256 id) {
        id = accepted();
        vm.prank(WORKER);
        escrow.submit(id, keccak256("encrypted deliverable"));
    }
    function testRevocationDoesNotClawBackSubmittedPay() public {
        uint256 id = submitted();
        escrow.setRoot(44);
        vm.prank(CLIENT);
        escrow.approveAndPay(id);
        require(token.balanceOf(WORKER) == 100 && token.balanceOf(address(escrow)) == 0);
        vm.expectRevert(); vm.prank(CLIENT); escrow.approveAndPay(id);
        vm.expectRevert(); vm.prank(CLIENT); escrow.refund(id);
    }
    function testStaleRootRejectedBeforeAcceptance() public {
        uint256 id = create(); uint256[9] memory inputs = statement(id);
        escrow.setRoot(44);
        vm.expectRevert(); escrow.accept(id, hex"1234", inputs);
    }
    function testEachAuthoritativeStatementFieldChecked() public {
        uint256 id = create();
        for (uint256 i; i < 6; i++) {
            uint256[9] memory inputs = statement(id);
            inputs[i] = i == 4 ? 1101 : inputs[i] + 1;
            vm.expectRevert(); escrow.accept(id, hex"1234", inputs);
        }
        uint256[9] memory zeroRecipient = statement(id); zeroRecipient[6] = 0;
        vm.expectRevert(); escrow.accept(id, hex"1234", zeroRecipient);
    }
    function testInvalidProofAndReplayRejected() public {
        uint256 id = create();
        uint256[9] memory inputs = statement(id);
        vm.expectRevert(); escrow.accept(id, hex"bad0", inputs);
        escrow.accept(id, hex"1234", inputs);
        vm.expectRevert(); escrow.accept(id, hex"1234", inputs);
    }
    function testRelayerCannotTakeRecipientPayment() public {
        uint256 id = create();
        vm.prank(ATTACKER); escrow.accept(id, hex"1234", statement(id));
        vm.expectRevert(); vm.prank(ATTACKER); escrow.submit(id, keccak256("x"));
        vm.prank(WORKER); escrow.submit(id, keccak256("x"));
        vm.prank(CLIENT); escrow.approveAndPay(id);
        require(token.balanceOf(ATTACKER) == 0 && token.balanceOf(WORKER) == 100);
    }
    function testOpenJobRefundAndAcceptedNonSubmissionRefund() public {
        uint256 first = create(); uint256 second = accepted();
        vm.warp(1100); vm.prank(CLIENT); escrow.refund(first);
        vm.expectRevert(); vm.prank(CLIENT); escrow.refund(second);
        vm.warp(1201); vm.prank(CLIENT); escrow.refund(second);
        require(token.balanceOf(CLIENT) == 1000);
    }
    function testSubmittedCannotRefundAndTimeoutPays() public {
        uint256 id = submitted();
        vm.warp(1201);
        vm.expectRevert(); vm.prank(CLIENT); escrow.refund(id);
        vm.expectRevert(); vm.prank(WORKER); escrow.claimAfterReview(id);
        vm.warp(1301); vm.prank(WORKER); escrow.claimAfterReview(id);
        require(token.balanceOf(WORKER) == 100);
    }
    function testFuzzDisputeConservesEscrow(uint8 split) public {
        uint256 amount = uint256(split) % 101;
        uint256 id = submitted();
        vm.prank(CLIENT); escrow.dispute(id);
        vm.warp(1301);
        vm.expectRevert(); vm.prank(WORKER); escrow.claimAfterReview(id);
        vm.expectRevert(); vm.prank(ATTACKER); escrow.resolveDispute(id, amount);
        vm.prank(ARBITRATOR); escrow.resolveDispute(id, amount);
        require(token.balanceOf(WORKER) == amount);
        require(token.balanceOf(CLIENT) + token.balanceOf(WORKER) == 1000);
        require(token.balanceOf(address(escrow)) == 0);
    }
    function testOnlyIssuerUpdatesRoot() public {
        vm.expectRevert(); vm.prank(ATTACKER); escrow.setRoot(4);
        require(escrow.revocationRoot() == 3);
    }
    function testDocumentLocatorAndDigestRequireAssignedWorker() public {
        uint256 id = accepted();
        bytes32 ref = keccak256("swarm locator"); bytes32 digest = sha256("ciphertext");
        vm.expectRevert(); vm.prank(ATTACKER); escrow.submitDocument(id, ref, digest);
        vm.prank(WORKER); escrow.submitDocument(id, ref, digest);
        require(escrow.documentDigests(id) == digest);
        bytes32 replacement = sha256("replacement");
        vm.expectRevert(); vm.prank(WORKER); escrow.submitDocument(id, ref, replacement);
    }
    function testUnprovableClassCannotLockClientFunds() public {
        vm.expectRevert(); vm.prank(CLIENT);
        escrow.createJob(100, uint256(type(uint32).max) + 1, 1100, 1200, 1300, keccak256("terms"));
        require(token.balanceOf(CLIENT) == 1000);
    }
}
