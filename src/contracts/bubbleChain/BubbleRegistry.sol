// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

contract BubbleRegistry {
    struct Bubble {
        string name;
        address owner;
        uint256 createdAt;
        bool isPrivate;
        mapping(address => bool) hasAccess;
    }

    // Mapping from bubble ID to Bubble
    mapping(bytes32 => Bubble) public bubbles;

    // Events
    event BubbleCreated(
        bytes32 indexed bubbleId,
        string name,
        address indexed owner,
        bool isPrivate
    );

    event AccessGranted(
        bytes32 indexed bubbleId,
        address indexed user,
        address indexed grantor
    );

    event AccessRevoked(
        bytes32 indexed bubbleId,
        address indexed user,
        address indexed revoker
    );

    event BubbleDeleted(bytes32 indexed bubbleId);

    /**
     * Crea una nuova bolla
     */
    function createBubble(
        string memory name,
        bool isPrivate
    ) external returns (bytes32) {
        bytes32 bubbleId = keccak256(
            abi.encodePacked(name, msg.sender, block.timestamp)
        );

        require(bubbles[bubbleId].createdAt == 0, "Bubble already exists");

        Bubble storage bubble = bubbles[bubbleId];
        bubble.name = name;
        bubble.owner = msg.sender;
        bubble.createdAt = block.timestamp;
        bubble.isPrivate = isPrivate;
        bubble.hasAccess[msg.sender] = true;

        emit BubbleCreated(bubbleId, name, msg.sender, isPrivate);

        return bubbleId;
    }

    /**
     * Concede l'accesso a un utente
     */
    function grantAccess(bytes32 bubbleId, address user) external {
        require(bubbles[bubbleId].owner == msg.sender, "Not bubble owner");
        require(!bubbles[bubbleId].hasAccess[user], "User already has access");

        bubbles[bubbleId].hasAccess[user] = true;
        emit AccessGranted(bubbleId, user, msg.sender);
    }

    /**
     * Revoca l'accesso a un utente
     */
    function revokeAccess(bytes32 bubbleId, address user) external {
        require(bubbles[bubbleId].owner == msg.sender, "Not bubble owner");
        require(user != msg.sender, "Cannot revoke owner access");
        require(bubbles[bubbleId].hasAccess[user], "User has no access");

        bubbles[bubbleId].hasAccess[user] = false;
        emit AccessRevoked(bubbleId, user, msg.sender);
    }

    /**
     * Verifica se un utente ha accesso
     */
    function hasAccess(
        bytes32 bubbleId,
        address user
    ) external view returns (bool) {
        if (!bubbles[bubbleId].isPrivate) return true;
        return bubbles[bubbleId].hasAccess[user];
    }

    /**
     * Ottiene i dettagli di una bolla
     */
    function getBubbleDetails(
        bytes32 bubbleId
    )
        external
        view
        returns (
            string memory name,
            address owner,
            uint256 createdAt,
            bool isPrivate
        )
    {
        Bubble storage bubble = bubbles[bubbleId];
        return (bubble.name, bubble.owner, bubble.createdAt, bubble.isPrivate);
    }

    function deleteBubble(bytes32 bubbleId) external {
        require(bubbles[bubbleId].owner == msg.sender, "Not bubble owner");
        delete bubbles[bubbleId];
        emit BubbleDeleted(bubbleId);
    }
}
