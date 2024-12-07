// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "./BubbleRegistry.sol";

contract BubbleProxy {
    BubbleRegistry public registry;
    
    // Mapping da proxy address a owner address
    mapping(address => address) public proxyOwners;
    
    // Mapping da proxy address a permessi per bubble
    mapping(address => mapping(bytes32 => bool)) public proxyPermissions;
    
    event ProxyRegistered(address indexed proxy, address indexed owner);
    event ProxyPermissionGranted(address indexed proxy, bytes32 indexed bubbleId);
    event ProxyPermissionRevoked(address indexed proxy, bytes32 indexed bubbleId);

    constructor(address _registry) {
        registry = BubbleRegistry(_registry);
    }

    /**
     * Registra un proxy per un owner
     */
    function registerProxy(address proxy) external {
        require(proxyOwners[proxy] == address(0), "Proxy already registered");
        proxyOwners[proxy] = msg.sender;
        emit ProxyRegistered(proxy, msg.sender);
    }

    /**
     * Concede permessi a un proxy per una bubble
     */
    function grantProxyPermission(address proxy, bytes32 bubbleId) external {
        require(proxyOwners[proxy] == msg.sender, "Not proxy owner");
        require(registry.hasAccess(bubbleId, msg.sender), "No access to bubble");
        
        proxyPermissions[proxy][bubbleId] = true;
        emit ProxyPermissionGranted(proxy, bubbleId);
    }

    /**
     * Revoca permessi a un proxy
     */
    function revokeProxyPermission(address proxy, bytes32 bubbleId) external {
        require(proxyOwners[proxy] == msg.sender, "Not proxy owner");
        
        proxyPermissions[proxy][bubbleId] = false;
        emit ProxyPermissionRevoked(proxy, bubbleId);
    }

    /**
     * Verifica se un proxy ha accesso
     */
    function proxyHasAccess(address proxy, bytes32 bubbleId) public view returns (bool) {
        address owner = proxyOwners[proxy];
        return owner != address(0) && 
               proxyPermissions[proxy][bubbleId] &&
               registry.hasAccess(bubbleId, owner);
    }

    /**
     * Permette a un proxy di operare per conto dell'owner
     */
    function proxyAccess(bytes32 bubbleId) external view returns (bool) {
        return proxyHasAccess(msg.sender, bubbleId);
    }
} 