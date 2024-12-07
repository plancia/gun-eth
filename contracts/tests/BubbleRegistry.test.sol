// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "hardhat/console.sol";
import "./utils/Test.sol";
import "../BubbleRegistry.sol";

contract BubbleRegistryTest is Test {
    BubbleRegistry private registry;
    address private alice;
    address private bob;

    function setUp() public {
        registry = new BubbleRegistry();
        alice = address(1);
        bob = address(2);
    }

    function testCreateBubble() public {
        vm.startPrank(alice);
        
        bytes32 bubbleId = registry.createBubble("Test Bubble", true);
        
        (string memory name, address owner, uint256 createdAt, bool isPrivate) = registry.getBubbleDetails(bubbleId);
        
        assertEq(name, "Test Bubble");
        assertEq(owner, alice);
        assertTrue(createdAt > 0);
        assertTrue(isPrivate);
        assertTrue(registry.hasAccess(bubbleId, alice));
        
        vm.stopPrank();
    }

    function testGrantAccess() public {
        vm.startPrank(alice);
        bytes32 bubbleId = registry.createBubble("Test Bubble", true);
        
        registry.grantAccess(bubbleId, bob);
        assertTrue(registry.hasAccess(bubbleId, bob));
        
        vm.stopPrank();
    }

    function testRevokeAccess() public {
        vm.startPrank(alice);
        bytes32 bubbleId = registry.createBubble("Test Bubble", true);
        
        registry.grantAccess(bubbleId, bob);
        registry.revokeAccess(bubbleId, bob);
        assertFalse(registry.hasAccess(bubbleId, bob));
        
        vm.stopPrank();
    }

    function testPublicBubbleAccess() public {
        vm.startPrank(alice);
        bytes32 bubbleId = registry.createBubble("Public Bubble", false);
        vm.stopPrank();

        assertTrue(registry.hasAccess(bubbleId, bob));
    }

    function testDeleteBubble() public {
        vm.startPrank(alice);
        bytes32 bubbleId = registry.createBubble("Test Bubble", true);
        
        registry.deleteBubble(bubbleId);
        
        (string memory name, address owner, uint256 createdAt, bool isPrivate) = registry.getBubbleDetails(bubbleId);
        assertEq(owner, address(0));
        
        vm.stopPrank();
    }
} 