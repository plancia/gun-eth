// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

contract StealthAnnouncer {
    // Fee collector address
    address public devAddress;
    
    // Fee amount in wei
    uint256 private _devFee = 100000000000000;

    // Getter function for devFee
    function devFee() public view returns (uint256) {
        return _devFee;
    }

    // Eventi
    event StealthPaymentAnnounced(
        string senderPublicKey,    // Chiave pubblica SEA del sender
        string spendingPublicKey,  // Chiave pubblica di spesa
        address stealthAddress,    // Indirizzo stealth generato
        uint256 timestamp         // Timestamp dell'annuncio
    );

    event DevFeeUpdated(uint256 newFee);
    event DevAddressUpdated(address newAddress);

    // Struttura per memorizzare gli annunci
    struct StealthAnnouncement {
        string senderPublicKey;
        string spendingPublicKey;
        address stealthAddress;
        uint256 timestamp;
    }

    // Array di tutti gli annunci invece di un mapping per recipient
    StealthAnnouncement[] public announcements;

    constructor(address _devAddress) {
        devAddress = _devAddress;
    }

    modifier onlyDev() {
        require(msg.sender == devAddress, "Only dev can call this function");
        _;
    }

    // Funzione per annunciare un pagamento stealth
    function announcePayment(
        string memory senderPublicKey,
        string memory spendingPublicKey,
        address stealthAddress
    ) external payable {
        require(msg.value >= _devFee, "Insufficient fee");
        
        announcements.push(StealthAnnouncement({
            senderPublicKey: senderPublicKey,
            spendingPublicKey: spendingPublicKey,
            stealthAddress: stealthAddress,
            timestamp: block.timestamp
        }));

        emit StealthPaymentAnnounced(
            senderPublicKey,
            spendingPublicKey,
            stealthAddress,
            block.timestamp
        );
    }

    // Funzione per recuperare gli annunci in un range
    function getAnnouncementsInRange(uint256 fromIndex, uint256 toIndex) 
        external 
        view 
        returns (StealthAnnouncement[] memory) 
    {
        require(toIndex >= fromIndex, "Invalid range");
        require(toIndex < announcements.length, "Index out of bounds");
        
        uint256 size = toIndex - fromIndex + 1;
        StealthAnnouncement[] memory result = new StealthAnnouncement[](size);
        
        for(uint256 i = 0; i < size; i++) {
            result[i] = announcements[fromIndex + i];
        }
        
        return result;
    }

    // Funzione per ottenere il numero totale di annunci
    function getAnnouncementsCount() external view returns (uint256) {
        return announcements.length;
    }

    // Funzioni admin per il dev
    function updateDevFee(uint256 _newFee) external onlyDev {
        _devFee = _newFee;
        emit DevFeeUpdated(_newFee);
    }

    function updateDevAddress(address _newAddress) external onlyDev {
        devAddress = _newAddress;
        emit DevAddressUpdated(_newAddress);
    }

    // Funzione per ritirare eventuali ETH bloccati nel contratto
    function withdrawStuckETH() external onlyDev {
        (bool sent, ) = devAddress.call{value: address(this).balance}("");
        require(sent, "Failed to withdraw");
    }
} 