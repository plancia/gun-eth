// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "hardhat/console.sol";
import "./utils/Test.sol";
import "../BubbleProxy.sol";
import "../BubbleRegistry.sol";

contract BubbleProxyTest is Test {
    BubbleRegistry private registry;
    BubbleProxy private proxy;
    address private alice;
    address private bob;
    address private proxyAddress;

    function setUp() public {
        registry = new BubbleRegistry();
        proxy = new BubbleProxy(address(registry));
        alice = address(1);
        bob = address(2);
        proxyAddress = address(3);
    }

    function testRegisterProxy() public {
        vm.startPrank(alice);
        
        proxy.registerProxy(proxyAddress);
        assertEq(proxy.proxyOwners(proxyAddress), alice);
        
        vm.stopPrank();
    }

    function testGrantProxyPermission() public {
        vm.startPrank(alice);
        
        bytes32 bubbleId = registry.createBubble("Test Bubble", true);
        proxy.registerProxy(proxyAddress);
        proxy.grantProxyPermission(proxyAddress, bubbleId);
        
        assertTrue(proxy.proxyHasAccess(proxyAddress, bubbleId));
        
        vm.stopPrank();
    }

    function testRevokeProxyPermission() public {
        vm.startPrank(alice);
        
        bytes32 bubbleId = registry.createBubble("Test Bubble", true);
        proxy.registerProxy(proxyAddress);
        proxy.grantProxyPermission(proxyAddress, bubbleId);
        proxy.revokeProxyPermission(proxyAddress, bubbleId);
        
        assertFalse(proxy.proxyHasAccess(proxyAddress, bubbleId));
        
        vm.stopPrank();
    }

    function testProxyAccess() public {
        vm.startPrank(alice);
        bytes32 bubbleId = registry.createBubble("Test Bubble", true);
        proxy.registerProxy(proxyAddress);
        proxy.grantProxyPermission(proxyAddress, bubbleId);
        vm.stopPrank();

        vm.startPrank(proxyAddress);
        assertTrue(proxy.proxyAccess(bubbleId));
        vm.stopPrank();
    }
} 