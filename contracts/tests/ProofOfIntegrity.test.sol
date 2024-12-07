// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "hardhat/console.sol";
import "./utils/Test.sol";
import "../ProofOfIntegrity.sol";

contract ProofOfIntegrityTest is Test {
    ProofOfIntegrity private proof;
    bytes32 private nodeId;
    bytes32 private contentHash;

    function setUp() public {
        proof = new ProofOfIntegrity();
        nodeId = keccak256(bytes("test-node"));
        contentHash = keccak256(bytes("test-content"));
    }

    function testUpdateData() public {
        proof.updateData(nodeId, contentHash);
        
        (bytes32 storedHash, uint256 timestamp, address updater) = proof.getLatestRecord(nodeId);
        
        assertEq(storedHash, contentHash);
        assertEq(updater, address(this));
        assertTrue(timestamp > 0);
    }

    function testVerifyData() public {
        proof.updateData(nodeId, contentHash);
        
        (bool isValid, uint256 timestamp, address updater) = proof.verifyData(nodeId, contentHash);
        
        assertTrue(isValid);
        assertTrue(timestamp > 0);
        assertEq(updater, address(this));
    }

    function testBatchUpdateData() public {
        bytes32[] memory nodeIds = new bytes32[](2);
        nodeIds[0] = keccak256("node1");
        nodeIds[1] = keccak256("node2");

        bytes32[] memory contentHashes = new bytes32[](2);
        contentHashes[0] = keccak256("content1");
        contentHashes[1] = keccak256("content2");

        proof.batchUpdateData(nodeIds, contentHashes);

        (bytes32 hash1, , ) = proof.getLatestRecord(nodeIds[0]);
        (bytes32 hash2, , ) = proof.getLatestRecord(nodeIds[1]);

        assertEq(hash1, contentHashes[0]);
        assertEq(hash2, contentHashes[1]);
    }
} 