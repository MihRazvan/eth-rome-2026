// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;

import {ExitMarket} from "../contracts/ExitMarket.sol";
import {TestWithdrawalVault} from "../contracts/TestWithdrawalVault.sol";
import {TestUSDC} from "../contracts/TestUSDC.sol";
import {OfferKeyRegistry} from "../contracts/OfferKeyRegistry.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";

interface Vm {
    function addr(uint256) external returns (address);
    function sign(uint256, bytes32) external returns (uint8, bytes32, bytes32);
    function prank(address) external;
    function startPrank(address) external;
    function stopPrank() external;
    function warp(uint256) external;
    function chainId(uint256) external;
    function expectRevert() external;
    function expectRevert(bytes4) external;
}

contract Wallet1271 {
    bool public valid = true;
    bytes32 public approved;

    function set(bytes32 digest, bool validity) external {
        approved = digest;
        valid = validity;
    }

    function isValidSignature(bytes32 digest, bytes calldata) external view returns (bytes4) {
        return valid && digest == approved ? bytes4(0x1626ba7e) : bytes4(0xffffffff);
    }

    function approve(IERC20 token, address market) external {
        token.approve(market, type(uint256).max);
    }
}

contract HostileToken is ERC20 {
    bool public chargeFee;
    address public target;
    bytes public attack;
    bool public attempted;
    bool public callbackSucceeded;
    constructor() ERC20("Hostile test token", "HOSTILE") {}

    function mint(address who, uint256 amount) external {
        _mint(who, amount);
    }

    function arm(address to, bytes memory data, bool fee) external {
        target = to;
        attack = data;
        chargeFee = fee;
    }

    function _update(address from, address to, uint256 amount) internal override {
        super._update(from, to, amount);
        if (chargeFee && from != address(0) && amount > 1) super._update(to, address(0), 1);
        if (target != address(0) && !attempted) attempted = true;
        (callbackSucceeded,) = target.call(attack);
    }
}

contract ExitMarketTest {
    Vm constant vm = Vm(address(uint160(uint256(keccak256("hevm cheat code")))));
    TestUSDC token;
    TestWithdrawalVault vault;
    ExitMarket market;
    address seller = address(0x51);
    address a;
    address b;
    uint256 constant AKEY = 0xA11CE;
    uint256 constant BKEY = 0xB0B;
    uint256 constant U = 1e6;

    function setUp() public {
        a = vm.addr(AKEY);
        b = vm.addr(BKEY);
        token = new TestUSDC();
        vault = new TestWithdrawalVault(token);
        market = new ExitMarket(vault);
        fund(seller);
        fund(a);
        fund(b);
    }

    function fund(address who) internal {
        vm.startPrank(who);
        token.faucet();
        token.approve(address(market), type(uint256).max);
        vm.stopPrank();
    }

    function originate(bool adverse) internal returns (uint256 id) {
        vm.prank(seller);
        id = market.originate(10_000 * U, adverse);
    }

    function quote(uint256 id, address maker, address beneficiary, uint256 price, uint256 nonce)
        internal
        view
        returns (ExitMarket.PurchaseQuote memory q)
    {
        (address positionOwner,, uint256 epoch, uint256 depletion,,,) = market.positions(id);
        q = ExitMarket.PurchaseQuote(
            maker,
            positionOwner,
            beneficiary,
            id,
            address(vault),
            1,
            address(token),
            price,
            0,
            address(0),
            epoch,
            depletion,
            block.timestamp + 1 days,
            bytes32(nonce),
            bytes32(0)
        );
    }

    function signature(ExitMarket.PurchaseQuote memory q, uint256 key) internal returns (bytes memory) {
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(key, market.hashQuote(q));
        return abi.encodePacked(r, s, v);
    }

    function accept(ExitMarket.PurchaseQuote memory q, uint256 key) internal {
        bytes memory sig = signature(q, key);
        vm.prank(q.seller);
        market.accept(q, sig);
    }

    function owner(uint256 id) internal view returns (address who) {
        (who,,,,,,) = market.positions(id);
    }

    function cash(uint256 id) internal view returns (uint256 value) {
        (,,,, value,,) = market.positions(id);
    }

    function eq(uint256 x, uint256 y) internal pure {
        require(x == y, "not equal");
    }

    function testP1P3P7FullReferenceLifecycle() public {
        uint256 started = block.timestamp;
        uint256 id = originate(false);
        uint256 beforeSeller = token.balanceOf(seller);
        ExitMarket.PurchaseQuote memory q = quote(id, a, a, 9960 * U, 1);
        accept(q, AKEY);
        eq(token.balanceOf(seller) - beforeSeller, 9960 * U);
        require(owner(id) == a);
        ExitMarket.PurchaseQuote memory stale = quote(id, b, b, 9980 * U, 2);
        bytes memory staleSig = signature(stale, BKEY);
        vm.warp(block.timestamp + 60);
        market.collect(id);
        eq(cash(id), 4000 * U);
        vm.prank(a);
        market.withdraw(id, 4000 * U);
        vm.expectRevert(ExitMarket.StaleQuote.selector);
        vm.prank(a);
        market.accept(stale, staleSig);
        accept(quote(id, b, b, 5985 * U, 3), BKEY);
        vm.warp(started + 120);
        market.collect(id);
        vm.prank(b);
        market.withdraw(id, 6000 * U);
        eq(token.balanceOf(a), 100025 * U);
        eq(token.balanceOf(b), 100015 * U);
        eq(market.totalCash(), 0);
        eq(vault.totalLiability(), 0);
        require(owner(id) == b, "ownership must persist at zero");
        vm.startPrank(seller);
        token.approve(address(vault), 100 * U);
        vault.fundRecovery(1, 100 * U);
        vm.stopPrank();
        market.collect(id);
        vm.expectRevert(ExitMarket.Unauthorized.selector);
        vm.prank(a);
        market.withdraw(id, 100 * U);
        vm.prank(b);
        market.withdraw(id, 100 * U);
        eq(token.balanceOf(b), 100115 * U);
    }

    function testSeparateAdverseScenario() public {
        uint256 started = block.timestamp;
        uint256 id = originate(true);
        accept(quote(id, a, a, 9960 * U, 1), AKEY);
        vm.warp(block.timestamp + 60);
        market.collect(id);
        vm.prank(a);
        market.withdraw(id, 4000 * U);
        accept(quote(id, b, b, 5985 * U, 2), BKEY);
        vm.warp(started + 120);
        market.collect(id);
        vm.prank(b);
        market.withdraw(id, 5700 * U);
        eq(token.balanceOf(b), 99715 * U);
        eq(token.balanceOf(vault.LOSS_SINK()), 300 * U);
        eq(vault.totalLiability(), 0);
    }

    function testP2SellerAndOutsiderCannotWithdrawOrCollectSource() public {
        uint256 id = originate(false);
        accept(quote(id, a, a, 9960 * U, 1), AKEY);
        vm.warp(block.timestamp + 120);
        market.collect(id);
        vm.expectRevert(ExitMarket.Unauthorized.selector);
        vm.prank(seller);
        market.withdraw(id, 1);
        vm.expectRevert(TestWithdrawalVault.NotRequester.selector);
        vm.prank(seller);
        vault.collect(1);
        vm.expectRevert(ExitMarket.Unauthorized.selector);
        vm.prank(b);
        market.withdraw(id, 1);
        require(owner(id) == a);
    }

    function testP3TimeCollectAndDustDoNotStaleQuote() public {
        uint256 id = originate(false);
        ExitMarket.PurchaseQuote memory q = quote(id, a, a, 9960 * U, 1);
        vm.warp(block.timestamp + 60);
        market.collect(id);
        vm.prank(b);
        token.transfer(address(market), 1);
        accept(q, AKEY);
        eq(cash(id), 4000 * U);
        require(owner(id) == a);
    }

    function testP4OutsiderAndMakerCannotForceAcceptance() public {
        uint256 id = originate(false);
        ExitMarket.PurchaseQuote memory q = quote(id, a, a, 1, 1);
        bytes memory sig = signature(q, AKEY);
        vm.expectRevert(ExitMarket.Unauthorized.selector);
        vm.prank(b);
        market.accept(q, sig);
        vm.expectRevert(ExitMarket.Unauthorized.selector);
        vm.prank(a);
        market.accept(q, sig);
        require(owner(id) == seller);
    }

    function testP4ChangedBuyerPriceAndChainRejectSignature() public {
        uint256 id = originate(false);
        ExitMarket.PurchaseQuote memory q = quote(id, a, a, 9960 * U, 1);
        bytes memory sig = signature(q, AKEY);
        q.buyer = b;
        vm.expectRevert(ExitMarket.InvalidSignature.selector);
        vm.prank(seller);
        market.accept(q, sig);
        q.buyer = a;
        q.netPayment++;
        vm.expectRevert(ExitMarket.InvalidSignature.selector);
        vm.prank(seller);
        market.accept(q, sig);
        q.netPayment--;
        vm.chainId(block.chainid + 1);
        vm.expectRevert(ExitMarket.InvalidSignature.selector);
        vm.prank(seller);
        market.accept(q, sig);
    }

    function testP4CancellationExpiryAndReplay() public {
        uint256 id = originate(false);
        ExitMarket.PurchaseQuote memory q = quote(id, a, a, 9960 * U, 1);
        bytes memory sig = signature(q, AKEY);
        vm.prank(a);
        market.cancel(q.nonce);
        vm.expectRevert(ExitMarket.UnavailableQuote.selector);
        vm.prank(seller);
        market.accept(q, sig);
        q.nonce = bytes32(uint256(2));
        sig = signature(q, AKEY);
        vm.warp(q.deadline + 1);
        vm.expectRevert(ExitMarket.ExpiredQuote.selector);
        vm.prank(seller);
        market.accept(q, sig);
        q = quote(id, a, a, 9960 * U, 3);
        accept(q, AKEY);
        sig = signature(q, AKEY);
        vm.expectRevert(ExitMarket.Unauthorized.selector);
        vm.prank(seller);
        market.accept(q, sig);
    }

    function testP4EpochInvalidatesAwayAndBackOwnership() public {
        uint256 id = originate(false);
        ExitMarket.PurchaseQuote memory old = quote(id, b, b, 9900 * U, 1);
        bytes memory sig = signature(old, BKEY);
        accept(quote(id, a, a, 9960 * U, 2), AKEY);
        accept(quote(id, b, seller, 9960 * U, 3), BKEY);
        vm.expectRevert(ExitMarket.StaleQuote.selector);
        vm.prank(seller);
        market.accept(old, sig);
    }

    function testP4ERC1271RecheckedAtExecution() public {
        uint256 id = originate(false);
        Wallet1271 wallet = new Wallet1271();
        vm.prank(a);
        token.transfer(address(wallet), 10000 * U);
        wallet.approve(token, address(market));
        ExitMarket.PurchaseQuote memory q = quote(id, address(wallet), b, 9960 * U, 1);
        wallet.set(market.hashQuote(q), false);
        vm.expectRevert(ExitMarket.InvalidSignature.selector);
        vm.prank(seller);
        market.accept(q, hex"1234");
        wallet.set(market.hashQuote(q), true);
        vm.prank(seller);
        market.accept(q, hex"1234");
        require(owner(id) == b);
    }

    function testP5IndependentMakerAndUnreservedLiquidity() public {
        uint256 id = originate(false);
        ExitMarket.PurchaseQuote memory q = quote(id, b, b, 9960 * U, 1);
        bytes memory sig = signature(q, AKEY);
        vm.expectRevert(ExitMarket.InvalidSignature.selector);
        vm.prank(seller);
        market.accept(q, sig);
        q = quote(id, a, a, 9960 * U, 2);
        sig = signature(q, AKEY);
        uint256 makerBalance = token.balanceOf(a);
        vm.prank(a);
        token.transfer(b, makerBalance);
        vm.expectRevert();
        vm.prank(seller);
        market.accept(q, sig);
        require(owner(id) == seller);
        require(!market.unavailable(a, q.nonce));
    }

    function testP1FeesAndAtomicFailure() public {
        uint256 id = originate(false);
        ExitMarket.PurchaseQuote memory q = quote(id, a, a, 9960 * U, 1);
        q.feeAmount = 10 * U;
        q.feeRecipient = b;
        uint256 makerBefore = token.balanceOf(a);
        uint256 sellerBefore = token.balanceOf(seller);
        uint256 feeBefore = token.balanceOf(b);
        accept(q, AKEY);
        eq(makerBefore - token.balanceOf(a), 9970 * U);
        eq(token.balanceOf(seller) - sellerBefore, 9960 * U);
        eq(token.balanceOf(b) - feeBefore, 10 * U);
    }

    function testP1SellerFeeAliasRejectedAndFeeFailureAtomic() public {
        uint256 id = originate(false);
        ExitMarket.PurchaseQuote memory q = quote(id, a, a, 9960 * U, 1);
        q.feeAmount = 10 * U;
        q.feeRecipient = seller;
        bytes memory sig = signature(q, AKEY);
        vm.expectRevert(ExitMarket.InvalidQuote.selector);
        vm.prank(seller);
        market.accept(q, sig);
        q.feeRecipient = b;
        q.feeAmount = 100000 * U;
        sig = signature(q, AKEY);
        uint256 beforeSeller = token.balanceOf(seller);
        vm.expectRevert();
        vm.prank(seller);
        market.accept(q, sig);
        eq(token.balanceOf(seller), beforeSeller);
        eq(token.balanceOf(a), 100000 * U);
        require(owner(id) == seller);
        require(!market.unavailable(a, q.nonce));
    }

    function testP6CallbacksCannotRemoveAcquiredCash() public {
        HostileToken hostile = new HostileToken();
        TestWithdrawalVault hv = new TestWithdrawalVault(hostile);
        ExitMarket hm = new ExitMarket(hv);
        hostile.mint(seller, 10000 * U);
        hostile.mint(a, 10000 * U);
        vm.prank(seller);
        hostile.approve(address(hm), type(uint256).max);
        vm.prank(a);
        hostile.approve(address(hm), type(uint256).max);
        vm.prank(seller);
        uint256 id = hm.originate(10000 * U, false);
        vm.warp(block.timestamp + 120);
        hm.collect(id);
        ExitMarket.PurchaseQuote memory q = ExitMarket.PurchaseQuote(
            a,
            seller,
            address(hostile),
            id,
            address(hv),
            1,
            address(hostile),
            9960 * U,
            0,
            address(0),
            0,
            0,
            block.timestamp + 60,
            bytes32(uint256(1)),
            0
        );
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(AKEY, hm.hashQuote(q));
        hostile.arm(address(hm), abi.encodeCall(hm.withdraw, (id, 10000 * U)), false);
        vm.prank(seller);
        hm.accept(q, abi.encodePacked(r, s, v));
        require(hostile.attempted());
        require(!hostile.callbackSucceeded());
        (address who,,,, uint256 credit,,) = hm.positions(id);
        require(who == address(hostile));
        eq(credit, 10000 * U);
    }

    function testP1FeeOnTransferRevertsEverything() public {
        HostileToken hostile = new HostileToken();
        TestWithdrawalVault hv = new TestWithdrawalVault(hostile);
        ExitMarket hm = new ExitMarket(hv);
        hostile.mint(seller, 10000 * U);
        hostile.mint(a, 10000 * U);
        vm.prank(seller);
        hostile.approve(address(hm), type(uint256).max);
        vm.prank(a);
        hostile.approve(address(hm), type(uint256).max);
        vm.prank(seller);
        uint256 id = hm.originate(10000 * U, false);
        ExitMarket.PurchaseQuote memory q = ExitMarket.PurchaseQuote(
            a,
            seller,
            a,
            id,
            address(hv),
            1,
            address(hostile),
            9960 * U,
            0,
            address(0),
            0,
            0,
            block.timestamp + 60,
            bytes32(uint256(1)),
            0
        );
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(AKEY, hm.hashQuote(q));
        hostile.arm(address(0), hex"", true);
        vm.expectRevert(ExitMarket.InexactTransfer.selector);
        vm.prank(seller);
        hm.accept(q, abi.encodePacked(r, s, v));
        (address who,,,,,,) = hm.positions(id);
        require(who == seller);
        eq(hostile.balanceOf(a), 10000 * U);
        require(!hm.unavailable(a, q.nonce));
    }

    function testOfferKeyRegistryRotationRevocationAuthority() public {
        OfferKeyRegistry registry = new OfferKeyRegistry();
        bytes32 req = keccak256("request");
        bytes32 key = keccak256("key");
        vm.prank(seller);
        registry.register(req, key, 1, block.timestamp + 60);
        vm.expectRevert(OfferKeyRegistry.InvalidKey.selector);
        vm.prank(seller);
        registry.register(req, key, 1, block.timestamp + 60);
        vm.prank(b);
        registry.revoke(req);
        (bytes32 existing, uint256 version,) = registry.keys(seller, req);
        require(existing == key);
        eq(version, 1);
        vm.prank(seller);
        registry.revoke(req);
        (existing, version,) = registry.keys(seller, req);
        require(existing == 0);
        eq(version, 2);
        vm.expectRevert(OfferKeyRegistry.InvalidKey.selector);
        vm.prank(seller);
        registry.register(req, key, 2, block.timestamp + 60);
    }

    function testFuzzP1ExactSale(uint96 rawAmount, uint96 rawPrice, bool adverse) public {
        uint256 amount = 100 + uint256(rawAmount) % (50000 * U);
        uint256 price = 1 + uint256(rawPrice) % (50000 * U);
        vm.prank(seller);
        uint256 id = market.originate(amount, adverse);
        uint256 beforeSeller = token.balanceOf(seller);
        uint256 beforeMaker = token.balanceOf(a);
        accept(quote(id, a, b, price, 1), AKEY);
        eq(token.balanceOf(seller) - beforeSeller, price);
        eq(beforeMaker - token.balanceOf(a), price);
        require(owner(id) == b);
        vm.warp(block.timestamp + 120);
        market.collect(id);
        uint256 payout = adverse ? amount - amount * 3 / 100 : amount;
        vm.prank(b);
        market.withdraw(id, payout);
        eq(vault.totalLiability(), 0);
        eq(market.totalCash(), 0);
    }
}
