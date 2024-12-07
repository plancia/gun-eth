// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "hardhat/console.sol";

contract Test {
    // Cheatcode address per Hardhat
    Vm internal constant vm = Vm(0x7109709ECfa91a80626fF3989D68f67F5b1DD12D);

    // Funzioni di asserzione
    function assertTrue(bool condition) internal pure {
        require(condition, "Assertion failed");
    }

    function assertFalse(bool condition) internal pure {
        require(!condition, "Assertion failed");
    }

    function assertEq(uint256 a, uint256 b) internal pure {
        require(a == b, "Values not equal");
    }

    function assertEq(address a, address b) internal pure {
        require(a == b, "Addresses not equal");
    }

    function assertEq(bytes32 a, bytes32 b) internal pure {
        require(a == b, "Bytes32 not equal");
    }

    function assertEq(string memory a, string memory b) internal pure {
        require(keccak256(bytes(a)) == keccak256(bytes(b)), "Strings not equal");
    }

    // Funzioni di test setup
    function setUp() public virtual {}
}

interface Vm {
    // Funzioni di manipolazione stato
    function prank(address) external;
    function startPrank(address) external;
    function stopPrank() external;
    function deal(address who, uint256 amount) external;
    function warp(uint256) external;
    function roll(uint256) external;
    function expectRevert() external;
    function expectRevert(bytes calldata) external;
    function expectEmit(bool, bool, bool, bool) external;
    
    // Funzioni di storage
    function load(address,bytes32) external returns (bytes32);
    function store(address,bytes32,bytes32) external;
    
    // Funzioni di snapshot
    function snapshot() external returns (uint256);
    function revertTo(uint256) external returns (bool);
} 