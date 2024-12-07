// @ts-check

import { Contract, Interface } from "ethers";
import { generateRandomId, getContractAddresses, getSigner } from "../../utils/common.js";
import { PROOF_OF_INTEGRITY_ABI } from "../../constants/abis.js";
import Gun from "gun";
import { ethers } from 'ethers';

/**
 * Result of proof verification
 * @typedef {Object} ProofResult
 * @property {boolean} isValid - Whether the data is valid
 * @property {number} timestamp - Verification timestamp
 * @property {string} updater - Address of last update
 */

/**
 * Latest record
 * @typedef {Object} LatestRecord
 * @property {string} contentHash - Content hash
 * @property {number} timestamp - Last update timestamp
 * @property {string} updater - Address of last updater
 */

/**
 * Callback for proof operations
 * @typedef {Object} ProofCallback
 * @property {boolean} [ok] - Whether operation was successful
 * @property {string} [message] - Success/error message
 * @property {string} [err] - Error message
 * @property {number} [timestamp] - Operation timestamp
 * @property {string} [updater] - Updater address
 * @property {LatestRecord} [latestRecord] - Latest record
 * @property {string} [nodeId] - Created node ID
 * @property {string} [txHash] - Transaction hash
 */

/**
 * Options for proof transactions
 * @typedef {Object} ProofOptions
 * @property {number} [gasLimit] - Gas limit for transaction
 * @property {number} [gasPrice] - Gas price
 */

/** 
 * Extended Gun with additional methods
 * @typedef {import('gun').IGun & { get: (path: string) => any }} ExtendedGun 
 */

/**
 * Extended transaction with additional methods
 * @typedef {import('ethers').ContractTransaction & { wait: () => Promise<any>, hash: string }} ExtendedTransaction 
 */

/**
 * Configuration for ProofChain
 * @typedef {Object} ProofChainConfig
 * @property {string} [contractAddress] - Address of deployed ProofOfIntegrity contract
 * @property {string} [abi] - ABI of the contract (optional, defaults to PROOF_OF_INTEGRITY_ABI)
 */

/**
 * Class for handling blockchain proof of integrity
 * @class
 */
export class ProofChain {
  /**
   * Creates a new ProofChain instance
   * @param {Gun} gun - Gun instance
   * @param {ProofChainConfig} [config] - Optional configuration
   */
  constructor(gun, config = {}) {
    /** @type {ExtendedGun} */
    this.gun = /** @type {ExtendedGun} */ (gun);
    this.contractAddress = config.contractAddress;
    this.contractAbi = config.abi || PROOF_OF_INTEGRITY_ABI;
  }

  /**
   * Gets contract instance for the specified chain
   * @param {string} chain - Chain identifier
   * @returns {Promise<Contract>} Contract instance
   */
  async getContract(chain) {
    const signer = await getSigner(chain);
    const address = this.contractAddress || getContractAddresses(chain).PROOF_OF_INTEGRITY_ADDRESS;
    
    return new ethers.Contract(
      address,
      this.contractAbi,
      signer
    );
  }

  /**
   * Converts an ID to bytes32
   * @param {ethers.BytesLike} id - ID to convert
   * @returns {string} ID converted to bytes32
   */
  convertToBytes32(id) {
    if (typeof id === "string") {
      // If id is already in hex format with 0x
      if (id.startsWith("0x")) {
        return ethers.zeroPadValue(id, 32);
      }
      // If it's a hex string without 0x, add 0x
      if (/^[0-9a-fA-F]{64}$/.test(id)) {
        return ethers.zeroPadValue(`0x${id}`, 32);
      }
      // Otherwise encode string as UTF8 and calculate keccak256
      return ethers.keccak256(ethers.toUtf8Bytes(id));
    }
    // If already BytesLike, ensure correct length
    return ethers.zeroPadValue(id, 32);
  }

  /**
   * Verifies data on-chain
   * @param {string} chain - Chain identifier
   * @param {string} nodeId - Node ID to verify
   * @param {string} contentHash - Content hash to verify
   * @returns {Promise<ProofResult>} Verification result
   */
  async verifyOnChain(chain, nodeId, contentHash) {
    try {
      const contract = await this.getContract(chain);
      const nodeIdBytes = this.convertToBytes32(nodeId);
      
      // If no contentHash, get latest record
      if (!contentHash) {
        const record = await this.getLatestRecord(chain, nodeId);
        contentHash = record.contentHash;
      }

      // Ensure contentHash is in correct format
      const contentHashBytes = typeof contentHash === "string" && contentHash.startsWith("0x") 
        ? ethers.zeroPadValue(contentHash, 32)
        : ethers.zeroPadValue(`0x${contentHash}`, 32);

      const [isValid, timestamp, updater] = await contract.verifyData(
        nodeIdBytes,
        contentHashBytes
      );
      
      return { isValid, timestamp: Number(timestamp), updater };
    } catch (error) {
      console.error("Error verifying data:", error);
      throw error;
    }
  }

  /**
   * Writes data on-chain
   * @param {string} chain - Chain identifier
   * @param {string} nodeId - Node ID to write
   * @param {string} contentHash - Content hash to write
   * @param {Object} options - Transaction options
   * @returns {Promise<ExtendedTransaction>} Resulting transaction
   */
  async writeOnChain(chain, nodeId, contentHash, options = {}) {
    try {
      const nodeIdBytes = this.convertToBytes32(nodeId);
      const contentHashBytes = typeof contentHash === "string" && contentHash.startsWith("0x") 
        ? ethers.zeroPadValue(contentHash, 32)
        : ethers.zeroPadValue(`0x${contentHash}`, 32);

      const contract = await this.getContract(chain);
      const tx = await contract.updateData(nodeIdBytes, contentHashBytes, options);
      return tx;
    } catch (error) {
      console.error("Error writing to chain:", error);
      throw error;
    }
  }

  /**
   * Gets the latest record
   * @param {string} chain - Chain name
   * @param {ethers.BytesLike} nodeId - Node ID
   * @returns {Promise<LatestRecord>} Latest record
   */
  async getLatestRecord(chain, nodeId) {
    const contract = await this.getContract(chain);
    const nodeIdBytes = this.convertToBytes32(nodeId);
    const [contentHash, timestamp, updater] = await contract.getLatestRecord(
      nodeIdBytes
    );
    return { contentHash, timestamp, updater };
  }

  /**
   * Verifies or writes data with proof of integrity
   * @param {string} chain - Chain name
   * @param {string} nodeId - Node ID (for verification)
   * @param {object} data - Data to write
   * @param {function} callback - Callback function
   * @param {object} options - Transaction options
   * @returns {Promise<this>} Current instance
   */
  async proof(chain, nodeId, data, callback, options = {}) {
    try {
      if (!data) {
        // Verify
        const result = await this.verifyOnChain(chain, nodeId, null);
        const latestRecord = await this.getLatestRecord(chain, nodeId);
        
        callback({ 
          ok: result.isValid, 
          ...result,
          latestRecord: {
            contentHash: latestRecord.contentHash,
            timestamp: Number(latestRecord.timestamp),
            updater: latestRecord.updater
          }
        });
        
        // Verify current data in GunDB
        this.gun.get(nodeId).once((gunData) => {
          if (gunData) {
            console.log("\n🔄 Re-analyzing current data state...");
            const currentData = { ...gunData };
            delete currentData._;
            const storedHash = currentData._contentHash;
            delete currentData._contentHash;
            
            const currentDataString = JSON.stringify(currentData);
            const currentHash = ethers.keccak256(ethers.toUtf8Bytes(currentDataString));
            
            console.log("Current data state:", currentData);
            console.log("Calculated new hash:", currentHash);
            console.log("Original stored hash:", storedHash);
            
            if (currentHash !== storedHash) {
              console.log("\n⚠️ WARNING: Data has been tampered!");
            } else {
              console.log("\n✅ Data integrity check passed: No tampering detected");
            }
          }
        });
        
        return this;
      }

      // Calculate content hash
      const dataString = JSON.stringify(data);
      const contentHash = ethers.keccak256(ethers.toUtf8Bytes(dataString));

      // If no nodeId, generate a new one
      if (!nodeId) {
        nodeId = generateRandomId();
      }

      // Save data to GUN
      data._contentHash = contentHash;
      this.gun.get(nodeId).put(data);

      // Write hash to blockchain
      const tx = await this.writeOnChain(chain, nodeId, contentHash, options);
      await tx.wait();

      callback({
        ok: true,
        nodeId,
        txHash: tx.hash
      });

    } catch (error) {
      callback({ err: error.message });
    }

    return this;
  }

  /**
   * Extends Gun with proof methods
   * @param {typeof Gun} Gun - Gun constructor
   */
  static extendGun(Gun) {
    // @ts-ignore
    Gun.chain.proof = function (
      /** @type {string} */ chain,
      /** @type {string} */ nodeId,
      /** @type {any} */ data,
      /** @type {Function} */ callback,
      /** @type {ProofChainConfig & any} */ options
    ) {
      // @ts-ignore
      const proofChain = new ProofChain(this, options);
      return proofChain.proof(chain, nodeId, data, callback, options);
    };
  }
}
