// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;
import {ExitMarket} from "../contracts/ExitMarket.sol";
import {TestWithdrawalVault} from "../contracts/TestWithdrawalVault.sol";
import {TestUSDC} from "../contracts/TestUSDC.sol";
import {Vm} from "./ExitMarket.t.sol";

/// @dev Stateful independent ledger: every action is executable; no catch-all revert swallowing.
contract LifecycleHandler {
    Vm constant vm = Vm(address(uint160(uint256(keccak256("hevm cheat code")))));
    TestUSDC public token;
    TestWithdrawalVault public vault;
    ExitMarket public market;
    address[3] public actors;
    uint256[3] private actorKeys = [uint256(0xAA), uint256(0xBB), uint256(0xCC)];
    uint256[3] public expectedBalances;
    uint256 public modelOwner;
    uint256 public modelCash;
    uint256 public modelWithdrawn;
    uint256 public modelRecovery;
    uint256 public successfulSales;
    uint256 public successfulCollections;
    uint256 public successfulWithdrawals;
    uint256 private nonce;
    uint256 constant U = 1e6;
    uint256 public started;

    constructor() {
        token = new TestUSDC();
        vault = new TestWithdrawalVault(token);
        market = new ExitMarket(vault);
        for (uint256 i; i < 3; i++) {
            actors[i] = vm.addr(actorKeys[i]);
            vm.startPrank(actors[i]);
            token.faucet();
            token.approve(address(market), type(uint256).max);
            token.approve(address(vault), type(uint256).max);
            vm.stopPrank();
            expectedBalances[i] = 100000 * U;
        }
        started = block.timestamp;
        vm.prank(actors[0]);
        market.originate(10000 * U, false);
        expectedBalances[0] -= 10000 * U;
        // Prove all meaningful transitions are reachable before random action sequences.
        sell(1, 9960 * U - 1);
        advanceAndCollect(60);
        withdraw(4000 * U - 1);
    }

    function sell(uint256 rawBuyer, uint256 rawPrice) public {
        uint256 buyer = rawBuyer % 3;
        if (buyer == modelOwner) buyer = (buyer + 1) % 3;
        uint256 available = expectedBalances[buyer];
        if (available == 0) return;
        uint256 price = 1 + rawPrice % (available > 20000 * U ? 20000 * U : available);
        (,, uint256 epoch, uint256 depletion,,,) = market.positions(1);
        ExitMarket.PurchaseQuote memory q = ExitMarket.PurchaseQuote(
            actors[buyer],
            actors[modelOwner],
            actors[buyer],
            1,
            address(vault),
            1,
            address(token),
            price,
            0,
            address(0),
            epoch,
            depletion,
            block.timestamp + 60,
            bytes32(++nonce),
            0
        );
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(actorKeys[buyer], market.hashQuote(q));
        vm.prank(actors[modelOwner]);
        market.accept(q, abi.encodePacked(r, s, v));
        expectedBalances[buyer] -= price;
        expectedBalances[modelOwner] += price;
        modelOwner = buyer;
        successfulSales++;
    }

    function advanceAndCollect(uint256 secondsForward) public {
        vm.warp(block.timestamp + secondsForward % 121);
        uint256 vested = block.timestamp >= started + 120 ? 10000 * U : block.timestamp >= started + 60 ? 4000 * U : 0;
        uint256 expected = vested + modelRecovery - modelCash - modelWithdrawn;
        uint256 amount = market.collect(1);
        require(amount == expected, "source credit differs from independent schedule");
        modelCash += expected;
        if (amount != 0) successfulCollections++;
    }

    function withdraw(uint256 rawAmount) public {
        if (modelCash == 0) return;
        uint256 amount = 1 + rawAmount % modelCash;
        vm.prank(actors[modelOwner]);
        market.withdraw(1, amount);
        modelCash -= amount;
        modelWithdrawn += amount;
        expectedBalances[modelOwner] += amount;
        successfulWithdrawals++;
    }

    function recovery(uint256 rawFunder, uint256 rawAmount) public {
        uint256 funder = rawFunder % 3;
        uint256 available = expectedBalances[funder];
        if (available == 0) return;
        uint256 amount = 1 + rawAmount % (available > 100 * U ? 100 * U : available);
        vm.prank(actors[funder]);
        vault.fundRecovery(1, amount);
        modelRecovery += amount;
        expectedBalances[funder] -= amount;
    }

    function cancel(uint256 actor, uint256 value) public {
        vm.prank(actors[actor % 3]);
        market.cancel(keccak256(abi.encode("cancel-only", value)));
    }
}

contract ExitInvariantTest {
    LifecycleHandler public handler;
    address[] private targets;

    function setUp() public {
        handler = new LifecycleHandler();
        targets.push(address(handler));
    }

    function targetContracts() public view returns (address[] memory) {
        return targets;
    }

    function invariantP1P5ConservationAndIndependentBalances() public view {
        TestUSDC token = handler.token();
        ExitMarket market = handler.market();
        TestWithdrawalVault vault = handler.vault();
        for (uint256 i; i < 3; i++) {
            require(token.balanceOf(handler.actors(i)) == handler.expectedBalances(i), "actor ledger mismatch");
        }
        require(token.balanceOf(address(market)) == handler.modelCash(), "market backing");
        require(market.totalCash() == handler.modelCash(), "market liabilities");
        require(token.balanceOf(address(vault)) == vault.totalLiability(), "source backing");
        require(
            vault.totalLiability() + handler.modelCash() + handler.modelWithdrawn()
                == 10000 * 1e6 + handler.modelRecovery(),
            "economic conservation"
        );
    }

    function invariantP2P3P7OwnershipAndResiduals() public view {
        (address owner,, uint256 epoch, uint256 depletion, uint256 cash, uint256 withdrawn,) =
            handler.market().positions(1);
        require(owner == handler.actors(handler.modelOwner()), "owner mismatch");
        require(epoch == handler.successfulSales(), "epoch mismatch");
        require(depletion == handler.modelWithdrawn() && withdrawn == depletion, "depletion mismatch");
        require(cash == handler.modelCash(), "cash mismatch");
        require(
            handler.successfulSales() > 0 && handler.successfulCollections() > 0 && handler.successfulWithdrawals() > 0,
            "vacuous campaign"
        );
    }
}
