// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "hardhat/console.sol";

contract Test {
    address constant VM_ADDRESS = address(bytes20(uint160(uint256(keccak256("hevm cheat code")))));
    
    Vm public constant vm = Vm(VM_ADDRESS);
    
    function assertTrue(bool condition) internal pure {
        require(condition, "Assertion failed");
    }
    
    function assertFalse(bool condition) internal pure {
        require(!condition, "Assertion failed");
    }
    
    function assertEq(uint a, uint b) internal pure {
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
}

interface Vm {
    function startPrank(address) external;
    function stopPrank() external;
    function deal(address, uint256) external;
    function expectRevert(bytes calldata) external;
    function expectEmit(bool, bool, bool, bool) external;
} 