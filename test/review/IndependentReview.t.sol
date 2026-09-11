// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;

import {ExitMarketTest} from "../ExitMarket.t.sol";
import {ExitMarket} from "../../contracts/ExitMarket.sol";

/// @notice Reviewer-authored regression probes; not a claim of comprehensive audit.
contract IndependentReviewTest is ExitMarketTest {
    function testReviewEveryEconomicFieldIsAuthenticated() public {
        uint256 id = originate(false);
        uint256 secondId = originate(false);
        for (uint256 field; field < 15; field++) {
            ExitMarket.PurchaseQuote memory q = quote(id, a, a, 9960 * U, 7);
            bytes memory sig = signature(q, AKEY);
            if (field == 0) q.maker = b;
            if (field == 1) q.seller = b;
            if (field == 2) q.buyer = b;
            if (field == 3) q.source = address(0x123);
            if (field == 4) q.sourceVersion = 2;
            if (field == 5) q.paymentToken = address(0x456);
            if (field == 6) q.netPayment++;
            if (field == 7) q.feeAmount = U;
            if (field == 8) q.ownershipEpoch++;
            if (field == 9) q.depletion++;
            if (field == 10) q.deadline++;
            if (field == 11) q.nonce = bytes32(uint256(8));
            if (field == 12) q.underwritingHash = keccak256("changed document");
            if (field == 13) q.claimId = secondId;
            if (field == 14) q.feeRecipient = b;
            uint256 sellerBefore = token.balanceOf(seller);
            vm.expectRevert();
            vm.prank(seller);
            market.accept(q, sig);
            require(owner(id) == seller, "mutated quote changed owner");
            eq(token.balanceOf(seller), sellerBefore);
            require(!market.unavailable(a, bytes32(uint256(7))), "revert consumed original quote");
        }
    }

    function testReviewQuoteCannotReplayOnAnotherMarket() public {
        uint256 id = originate(false);
        ExitMarket.PurchaseQuote memory q = quote(id, a, a, 9960 * U, 1);
        bytes memory sig = signature(q, AKEY);
        ExitMarket second = new ExitMarket(vault);
        vm.startPrank(seller);
        token.approve(address(second), type(uint256).max);
        second.originate(10000 * U, false);
        vm.stopPrank();
        vm.expectRevert(ExitMarket.InvalidSignature.selector);
        vm.prank(seller);
        second.accept(q, sig);
        (address secondOwner,,,,,,) = second.positions(id);
        require(secondOwner == seller);
    }

    function testReviewNonceConsumedAcrossClaimsAndMakerIsolation() public {
        uint256 id = originate(false);
        uint256 secondId = originate(false);
        accept(quote(id, a, a, 9960 * U, 1), AKEY);
        ExitMarket.PurchaseQuote memory reused = quote(secondId, a, a, 9960 * U, 1);
        bytes memory sig = signature(reused, AKEY);
        vm.expectRevert(ExitMarket.UnavailableQuote.selector);
        vm.prank(seller);
        market.accept(reused, sig);
        require(owner(secondId) == seller);
        // Maker A's used identity does not consume maker B's same nonce.
        accept(quote(secondId, b, b, 9960 * U, 1), BKEY);
        require(owner(secondId) == b);
    }

    function testReviewRecoveryAddedBetweenSigningAndSaleStaysInBundle() public {
        uint256 id = originate(false);
        ExitMarket.PurchaseQuote memory q = quote(id, a, a, 9960 * U, 1);
        bytes memory sig = signature(q, AKEY);
        vm.startPrank(b);
        token.approve(address(vault), 77 * U);
        vault.fundRecovery(1, 77 * U);
        vm.stopPrank();
        market.collect(id); // Early recovery is available even before first scheduled installment.
        eq(cash(id), 77 * U);
        vm.prank(seller);
        market.accept(q, sig);
        vm.expectRevert(ExitMarket.Unauthorized.selector);
        vm.prank(seller);
        market.withdraw(id, 77 * U);
        vm.prank(a);
        market.withdraw(id, 77 * U);
        vm.warp(block.timestamp + 120);
        market.collect(id);
        vm.prank(a);
        market.withdraw(id, 10000 * U);
        require(owner(id) == a, "exhaustion erased future owner");
        eq(vault.totalLiability(), 0);
    }

    function testReviewDustDoesNotBecomeRecognizedCash() public {
        uint256 id = originate(false);
        vm.prank(b);
        token.transfer(address(market), 19 * U);
        vm.prank(b);
        token.transfer(address(vault), 23 * U);
        vm.warp(block.timestamp + 120);
        market.collect(id);
        eq(cash(id), 10000 * U);
        eq(market.totalCash(), 10000 * U);
        vm.prank(seller);
        market.withdraw(id, 10000 * U);
        eq(token.balanceOf(address(market)), 19 * U);
        eq(token.balanceOf(address(vault)), 23 * U);
        eq(market.totalCash(), 0);
        eq(vault.totalLiability(), 0);
    }
}
