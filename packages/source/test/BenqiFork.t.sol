// SPDX-License-Identifier: MIT
pragma solidity 0.8.30;
import {BenqiClaimAccount,IStakedAvax} from "../BenqiClaimAccount.sol";
interface Vm {
 function createSelectFork(string calldata,uint256) external returns(uint256);
 function deal(address,uint256) external;
 function prank(address) external;
 function warp(uint256) external;
 function expectRevert(bytes calldata) external;
 function load(address,bytes32) external view returns(bytes32);
}
interface ISource is IStakedAvax {
 function cooldownPeriod() external view returns(uint256);
 function redeemPeriod() external view returns(uint256);
 function getRoleMember(bytes32,uint256) external view returns(address);
 function accrueRewards() external payable;
 function getPaginatedUnlockRequests(address,uint256,uint256) external view returns(Request[] memory,uint256[] memory);
 struct Request {uint256 shareAmount;uint256 startedAt;}
}
contract BenqiForkTest {
 Vm constant vm=Vm(address(uint160(uint256(keccak256("hevm cheat code")))));
 ISource constant source=ISource(0x2b2C81e08f1Af8835a78Bb2A90AE924ACE0eA4bE);
 uint256 constant BLOCK=95031281;
 address constant seller=address(0x1111);
 address constant buyer=address(0x2222);
 BenqiClaimAccount account;
 uint256 started;
 function setUp() public {
  vm.createSelectFork("https://api.avax.network/ext/bc/C/rpc",BLOCK);
  require(address(uint160(uint256(vm.load(address(source),0x360894a13ba1a3210667c828492db98dca3e2076cc3735a920a3ca505d382bbc))))==0xB791C7A42FD0D10F90DEaa906a8735f79719FA53,"implementation changed");
  require(source.cooldownPeriod()==15 days && source.redeemPeriod()==2 days,"timing mismatch");
  account=new BenqiClaimAccount(address(source),seller);
  vm.deal(seller,10 ether);vm.prank(seller);account.originate{value:1 ether}();started=block.timestamp;
  require(source.getUnlockRequestCount(address(account))==1,"missing request");
  require(source.getUnlockRequestCount(seller)==0,"EOA wrongly owns request");
 }
 function testOriginationTransferCancellationAndReturnedShares() public {
  vm.prank(seller);account.transferOwnership(buyer);
  vm.expectRevert(abi.encodeWithSelector(BenqiClaimAccount.Unauthorized.selector));vm.prank(seller);account.cancel();
  vm.prank(buyer);account.cancel();
  require(source.getUnlockRequestCount(address(account))==0,"cancel failed");
  uint256 recovered=source.balanceOf(address(account));require(recovered>0,"no returned shares");
  vm.expectRevert(abi.encodeWithSelector(BenqiClaimAccount.Unauthorized.selector));vm.prank(seller);account.withdrawShares();
  vm.prank(buyer);account.withdrawShares();require(source.balanceOf(buyer)==recovered,"wrong share owner");
 }
 function testMissedWindowRecoveryFollowsNewOwner() public {
  vm.prank(seller);account.transferOwnership(buyer);
  vm.warp(started+17 days+1);account.recoverOverdue();
  require(source.getUnlockRequestCount(address(account))==0,"overdue request retained");
  uint256 recovered=source.balanceOf(address(account));require(recovered>0,"missing recovery");
  vm.prank(buyer);account.withdrawShares();require(source.balanceOf(buyer)==recovered,"recovery diverted");
 }
 function testWholeRequestRedemptionWithSimulatedOperatorRateUpdate() public {
  vm.prank(seller);account.transferOwnership(buyer);
  // The fork cannot receive future operator transactions. Explicitly simulate only rate publication,
  // with one wei of rewards and no forced source liquidity. This is not a live BENQI time accelerator.
  vm.warp(started+15 days);
  address operator=source.getRoleMember(keccak256("ROLE_ACCRUE_REWARDS"),0);
  vm.deal(operator,operator.balance+1);vm.prank(operator);source.accrueRewards{value:1}();
  vm.warp(started+15 days+1);account.collect();
  require(source.getUnlockRequestCount(address(account))==0,"request not consumed");
  uint256 cash=address(account).balance;require(cash>0,"missing native cash");
  vm.expectRevert(abi.encodeWithSelector(BenqiClaimAccount.Unauthorized.selector));vm.prank(seller);account.withdrawCash();
  vm.prank(buyer);account.withdrawCash();require(buyer.balance==cash,"wrong cash owner");
 }
}
