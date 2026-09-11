// SPDX-License-Identifier: MIT
pragma solidity 0.8.30;

interface NativeAdmissionVm {
    function createSelectFork(string calldata, uint256) external returns (uint256);
    function envOr(string calldata, string calldata) external returns (string memory);
    function prank(address) external;
    function expectRevert(bytes calldata) external;
    function load(address, bytes32) external view returns (bytes32);
}
interface NativeClaim721 {
    function ownerOf(uint256) external view returns (address);
    function transferFrom(address, address, uint256) external;
}
interface NativeLidoQueue is NativeClaim721 {
    struct Status { uint256 amount; uint256 shares; address owner; uint256 timestamp; bool finalized; bool claimed; }
    function getWithdrawalStatus(uint256[] calldata) external view returns (Status[] memory);
    // Official WithdrawalQueue.sol finds its checkpoint internally for this single-argument method.
    function claimWithdrawal(uint256) external;
    function getLastCheckpointIndex() external view returns (uint256);
    function findCheckpointHints(uint256[] calldata, uint256, uint256) external view returns (uint256[] memory);
    function getClaimableEther(uint256[] calldata, uint256[] calldata) external view returns (uint256[] memory);
    function getLockedEtherAmount() external view returns (uint256);
    error RequestNotFoundOrNotFinalized(uint256 requestId);
    error RequestAlreadyClaimed(uint256 requestId);
    error NotOwner(address sender, address owner);
    error NotOwnerOrApproved(address sender);
}
interface NativeEtherfiQueue is NativeClaim721 {
    struct Request { uint96 amount; uint96 shares; bool valid; uint32 feeGwei; }
    function getRequest(uint256) external view returns (Request memory);
    function isFinalized(uint256) external view returns (bool);
    function claimWithdraw(uint256) external;
    function getClaimableAmount(uint256) external view returns (uint256);
    error RequestNotFinalized();
}

/// @notice Eligibility and whole-collection controls for existing production NFTs on a pinned local fork.
/// No source balance/rate/time overrides, payment adapter, production transaction, or audit claim.
contract NativeClaimAdmissionTest {
    NativeAdmissionVm constant vm = NativeAdmissionVm(address(uint160(uint256(keccak256("hevm cheat code")))));
    NativeLidoQueue constant lido = NativeLidoQueue(0x889edC2eDab5f40e902b864aD4d7AdE8E412F9B1);
    NativeEtherfiQueue constant etherfi = NativeEtherfiQueue(0x7d5706f6ef3F89B3951E23e557CDFBC3239D4E2c);
    bytes32 constant IMPLEMENTATION_SLOT = 0x360894a13ba1a3210667c828492db98dca3e2076cc3735a920a3ca505d382bbc;
    address constant buyer = address(0xB0B);
    address constant nextBuyer = address(0xCAFE);
    event NativeCollectionProof(address indexed source, uint256 indexed id, uint256 paidWei);
    function setUp() public {
        vm.createSelectFork(vm.envOr("EXIT_NATIVE_FORK_RPC", string("https://eth.drpc.org")), 25956536);
        require(address(uint160(uint256(vm.load(address(lido), IMPLEMENTATION_SLOT)))) == 0xE42C659Dc09109566720EA8b2De186c2Be7D94D9, "Lido implementation mismatch");
        require(address(uint160(uint256(vm.load(address(etherfi), IMPLEMENTATION_SLOT)))) == 0x41617D01362770ebAAC10311aB899FBc8a4E4A7E, "ether.fi implementation mismatch");
    }

    function testCurrentPendingLidoTransfersPreservingOriginalRequestAndRejectingOldOwner() public {
        uint256[] memory ids = new uint256[](1); ids[0] = 135118;
        NativeLidoQueue.Status memory before_ = lido.getWithdrawalStatus(ids)[0];
        require(!before_.finalized && !before_.claimed && before_.amount == 1000 ether, "wrong starting state");
        require(before_.timestamp == 1788805247, "original request timestamp mismatch");
        vm.prank(before_.owner); lido.transferFrom(before_.owner, buyer, ids[0]);
        NativeLidoQueue.Status memory after_ = lido.getWithdrawalStatus(ids)[0];
        require(after_.owner == buyer && after_.amount == before_.amount && after_.shares == before_.shares && after_.timestamp == before_.timestamp, "economic request altered");
        vm.expectRevert(abi.encodeWithSelector(NativeLidoQueue.NotOwnerOrApproved.selector, before_.owner)); vm.prank(before_.owner); lido.transferFrom(buyer, before_.owner, ids[0]);
        // Exact pending error rules out a passing negative test caused by a wrong selector or hint.
        vm.expectRevert(abi.encodeWithSelector(NativeLidoQueue.RequestNotFoundOrNotFinalized.selector, ids[0]));
        vm.prank(buyer); lido.claimWithdrawal(ids[0]);
        vm.prank(buyer); lido.transferFrom(buyer, nextBuyer, ids[0]);
        require(lido.ownerOf(ids[0]) == nextBuyer, "resale transfer failed");
    }
    function testCurrentPendingEtherfiTransfersPreservingOriginalRequestAndRejectingOldOwner() public {
        uint256 id = 82521; address seller = etherfi.ownerOf(id);
        NativeEtherfiQueue.Request memory before_ = etherfi.getRequest(id);
        require(before_.valid && !etherfi.isFinalized(id) && before_.amount > 100 ether, "wrong starting state");
        vm.prank(seller); etherfi.transferFrom(seller, buyer, id);
        NativeEtherfiQueue.Request memory after_ = etherfi.getRequest(id);
        require(etherfi.ownerOf(id) == buyer && keccak256(abi.encode(after_)) == keccak256(abi.encode(before_)), "economic request altered");
        vm.expectRevert(abi.encodeWithSignature("Error(string)", "ERC721: caller is not token owner or approved")); vm.prank(seller); etherfi.transferFrom(buyer, seller, id);
        vm.expectRevert(abi.encodeWithSelector(NativeEtherfiQueue.RequestNotFinalized.selector)); vm.prank(buyer); etherfi.claimWithdraw(id);
        vm.prank(buyer); etherfi.transferFrom(buyer, nextBuyer, id);
        require(etherfi.ownerOf(id) == nextBuyer, "resale transfer failed");
        // Timestamp is in creation logs, not request storage; transfer keeps the original token ID.
    }
    function testAlreadyFinalizedLidoCollectsActualETHToBuyerAndBurnsWholeNFT() public {
        uint256[] memory ids = new uint256[](1); ids[0] = 135117;
        NativeLidoQueue.Status memory before_ = lido.getWithdrawalStatus(ids)[0];
        require(before_.finalized && !before_.claimed && before_.amount == 1000 ether, "not existing finalized claim");
        uint256[] memory hints = lido.findCheckpointHints(ids, 1, lido.getLastCheckpointIndex());
        uint256 expected = lido.getClaimableEther(ids, hints)[0];
        require(expected > 0 && expected <= before_.amount, "not positive claimable ETH");
        vm.prank(before_.owner); lido.transferFrom(before_.owner, buyer, ids[0]);
        vm.expectRevert(abi.encodeWithSelector(NativeLidoQueue.NotOwner.selector, before_.owner, buyer));
        vm.prank(before_.owner); lido.claimWithdrawal(ids[0]);
        uint256 buyerBefore = buyer.balance;
        uint256 sellerBefore = before_.owner.balance;
        uint256 lockedBefore = lido.getLockedEtherAmount();
        vm.prank(buyer); lido.claimWithdrawal(ids[0]);
        require(buyer.balance - buyerBefore == expected && before_.owner.balance == sellerBefore, "wrong recipient or payout");
        require(lockedBefore - lido.getLockedEtherAmount() == expected, "wrong locked ETH depletion");
        NativeLidoQueue.Status memory after_ = lido.getWithdrawalStatus(ids)[0];
        require(after_.claimed && after_.finalized && after_.timestamp == before_.timestamp, "request not consumed");
        require(lido.getClaimableEther(ids, hints)[0] == 0, "claimable value remains");
        vm.expectRevert(abi.encodeWithSelector(NativeLidoQueue.RequestAlreadyClaimed.selector, ids[0]));
        lido.ownerOf(ids[0]);
        vm.expectRevert(abi.encodeWithSelector(NativeLidoQueue.RequestAlreadyClaimed.selector, ids[0]));
        vm.prank(buyer); lido.claimWithdrawal(ids[0]);
        emit NativeCollectionProof(address(lido), ids[0], expected);
    }
    function testAlreadyFinalizedEtherfiServicingPaysBuyerAndBurnsWholeNFT() public {
        uint256 id = 82510; address seller = etherfi.ownerOf(id);
        NativeEtherfiQueue.Request memory before_ = etherfi.getRequest(id);
        require(before_.valid && etherfi.isFinalized(id), "not existing finalized claim");
        uint256 expected = etherfi.getClaimableAmount(id);
        require(expected == 369547734083722800740, "pinned claimable amount mismatch");
        vm.prank(seller); etherfi.transferFrom(seller, buyer, id);
        uint256 buyerBefore = buyer.balance;
        uint256 sellerBefore = seller.balance;
        // Servicing is permissionless: even the previous owner may trigger collection,
        // but the source must pay the current owner, never the caller.
        vm.prank(seller); etherfi.claimWithdraw(id);
        require(buyer.balance - buyerBefore == expected && seller.balance == sellerBefore, "wrong recipient or payout");
        NativeEtherfiQueue.Request memory after_ = etherfi.getRequest(id);
        require(after_.amount == 0 && after_.shares == 0 && !after_.valid, "source request not deleted");
        require(etherfi.getClaimableAmount(id) == 0, "claimable value remains");
        bytes memory burnedError = abi.encodeWithSignature("Error(string)", "ERC721: invalid token ID");
        vm.expectRevert(burnedError); etherfi.ownerOf(id);
        vm.expectRevert(burnedError); vm.prank(buyer); etherfi.claimWithdraw(id);
        emit NativeCollectionProof(address(etherfi), id, expected);
    }

}
