// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "hardhat/console.sol";
import "./utils/Test.sol";
import "../StealthAnnouncer.sol";

contract StealthAnnouncerTest is Test {
    StealthAnnouncer private announcer;
    address private dev;
    address private user;

    function setUp() public {
        dev = address(1);
        user = address(2);
        announcer = new StealthAnnouncer(dev);
    }

    function testAnnouncePayment() public {
        vm.startPrank(user);
        vm.deal(user, 1 ether);

        string memory senderPubKey = "senderKey";
        string memory spendingPubKey = "spendingKey";
        address stealthAddr = address(3);

        announcer.announcePayment{value: announcer.devFee()}(
            senderPubKey,
            spendingPubKey,
            stealthAddr
        );

        assertEq(announcer.getAnnouncementsCount(), 1);

        StealthAnnouncer.StealthAnnouncement[] memory announcements = 
            announcer.getAnnouncementsInRange(0, 0);
        
        assertEq(announcements[0].senderPublicKey, senderPubKey);
        assertEq(announcements[0].spendingPublicKey, spendingPubKey);
        assertEq(announcements[0].stealthAddress, stealthAddr);
        
        vm.stopPrank();
    }

    function testUpdateDevFee() public {
        vm.startPrank(dev);
        
        uint256 newFee = 200000000000000;
        announcer.updateDevFee(newFee);
        assertEq(announcer.devFee(), newFee);
        
        vm.stopPrank();
    }

    function testUpdateDevAddress() public {
        vm.startPrank(dev);
        
        address newDev = address(4);
        announcer.updateDevAddress(newDev);
        assertEq(announcer.devAddress(), newDev);
        
        vm.stopPrank();
    }

    function testWithdrawStuckETH() public {
        vm.startPrank(user);
        vm.deal(user, 1 ether);

        announcer.announcePayment{value: announcer.devFee()}(
            "key1", "key2", address(3)
        );
        vm.stopPrank();

        vm.startPrank(dev);
        uint256 initialBalance = dev.balance;
        announcer.withdrawStuckETH();
        assertTrue(dev.balance > initialBalance);
        vm.stopPrank();
    }
} 