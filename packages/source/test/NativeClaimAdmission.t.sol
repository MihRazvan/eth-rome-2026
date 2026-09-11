// SPDX-License-Identifier: MIT
pragma solidity 0.8.30;

interface NativeAdmissionVm {
    function createSelectFork(string calldata, uint256) external returns (uint256);
    function prank(address) external;
    function expectRevert() external;
    function load(address, bytes32) external view returns (bytes32);
}
interface NativeClaim721 {
    function ownerOf(uint256) external view returns (address);
    function transferFrom(address, address, uint256) external;
}
interface NativeLidoQueue is NativeClaim721 {
    struct Status { uint256 amount; uint256 shares; address owner; uint256 timestamp; bool finalized; bool claimed; }
    function getWithdrawalStatus(uint256[] calldata) external view returns (Status[] memory);
    function claimWithdrawal(uint256) external;
}
interface NativeEtherfiQueue is NativeClaim721 {
    struct Request { uint96 amount; uint96 shares; bool valid; uint32 feeGwei; }
    function getRequest(uint256) external view returns (Request memory);
    function isFinalized(uint256) external view returns (bool);
    function claimWithdraw(uint256) external;
}

/// @notice Eligibility probe only: current production pending NFTs on a pinned local fork.
/// No source balance/rate/time overrides, payment adapter, production transaction, or audit claim.
contract NativeClaimAdmissionTest {
    NativeAdmissionVm constant vm = NativeAdmissionVm(address(uint160(uint256(keccak256("hevm cheat code")))));
    NativeLidoQueue constant lido = NativeLidoQueue(0x889edC2eDab5f40e902b864aD4d7AdE8E412F9B1);
    NativeEtherfiQueue constant etherfi = NativeEtherfiQueue(0x7d5706f6ef3F89B3951E23e557CDFBC3239D4E2c);
    bytes32 constant IMPLEMENTATION_SLOT = 0x360894a13ba1a3210667c828492db98dca3e2076cc3735a920a3ca505d382bbc;
    address constant buyer = address(0xB0B);
    address constant nextBuyer = address(0xCAFE);
    function setUp() public { vm.createSelectFork("https://ethereum-rpc.publicnode.com", 25956536); }

    function testCurrentPendingLidoTransfersPreservingOriginalRequestAndRejectingOldOwner() public {
        require(address(uint160(uint256(vm.load(address(lido), IMPLEMENTATION_SLOT)))) == 0xE42C659Dc09109566720EA8b2De186c2Be7D94D9, "implementation mismatch");
        uint256[] memory ids = new uint256[](1); ids[0] = 135118;
        NativeLidoQueue.Status memory before_ = lido.getWithdrawalStatus(ids)[0];
        require(!before_.finalized && !before_.claimed && before_.amount == 1000 ether, "wrong starting state");
        require(before_.timestamp == 1788805247, "original request timestamp mismatch");
        vm.prank(before_.owner); lido.transferFrom(before_.owner, buyer, ids[0]);
        NativeLidoQueue.Status memory after_ = lido.getWithdrawalStatus(ids)[0];
        require(after_.owner == buyer && after_.amount == before_.amount && after_.shares == before_.shares && after_.timestamp == before_.timestamp, "economic request altered");
        vm.expectRevert(); vm.prank(before_.owner); lido.transferFrom(buyer, before_.owner, ids[0]);
        // Pending means neither current nor former owner can prematurely claim.
        vm.expectRevert(); vm.prank(buyer); lido.claimWithdrawal(ids[0]);
        vm.prank(buyer); lido.transferFrom(buyer, nextBuyer, ids[0]);
        require(lido.ownerOf(ids[0]) == nextBuyer, "resale transfer failed");
    }
    function testCurrentPendingEtherfiTransfersPreservingOriginalRequestAndRejectingOldOwner() public {
        require(address(uint160(uint256(vm.load(address(etherfi), IMPLEMENTATION_SLOT)))) == 0x41617D01362770ebAAC10311aB899FBc8a4E4A7E, "implementation mismatch");
        uint256 id = 82521; address seller = etherfi.ownerOf(id);
        NativeEtherfiQueue.Request memory before_ = etherfi.getRequest(id);
        require(before_.valid && !etherfi.isFinalized(id) && before_.amount > 100 ether, "wrong starting state");
        vm.prank(seller); etherfi.transferFrom(seller, buyer, id);
        NativeEtherfiQueue.Request memory after_ = etherfi.getRequest(id);
        require(etherfi.ownerOf(id) == buyer && keccak256(abi.encode(after_)) == keccak256(abi.encode(before_)), "economic request altered");
        vm.expectRevert(); vm.prank(seller); etherfi.transferFrom(buyer, seller, id);
        vm.expectRevert(); vm.prank(buyer); etherfi.claimWithdraw(id);
        vm.prank(buyer); etherfi.transferFrom(buyer, nextBuyer, id);
        require(etherfi.ownerOf(id) == nextBuyer, "resale transfer failed");
        // Timestamp is in creation logs, not request storage; transfer keeps the original token ID.
    }
}
