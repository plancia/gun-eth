// @ts-nocheck

import { ethers } from "ethers";
import { getSigner } from "../gun-eth.js";
import { addresses } from "../contracts/addresses.js";
import bubbleRegistry_abi from "../contracts/bubbleChain/bubbleRegistry_abi.json";

/**
 * @typedef {Object} BubbleProviderOptions
 * @property {string} rpcUrl - RPC URL for the provider
 * @property {string} chain - Chain name (e.g. 'localhost', 'optimismSepolia')
 * @property {Object} gun - Gun instance
 * @property {Object} keypair - Keypair for encryption
 * @property {string} keypair.epub - Public encryption key
 * @property {string} keypair.epriv - Private encryption key
 * @property {string} [contractAddress] - Optional custom contract address
 * @property {Object} [contractAbi] - Optional custom contract ABI
 * @property {Object} mogu - Mogu instance
 */

/**
 * @typedef {Object} BubbleDetails
 * @property {string} id - Bubble ID
 * @property {string} name - Bubble name
 * @property {string} owner - Owner's Ethereum address
 * @property {boolean} isPrivate - Whether the bubble is private
 * @property {number} createdAt - Creation timestamp
 */

/**
 * @typedef {Object} FileMetadata
 * @property {string} name - File name
 * @property {string} owner - File owner
 * @property {string} filePath - File path
 * @property {number} created - Creation timestamp
 * @property {number} updated - Last update timestamp
 * @property {number} size - File size in bytes
 * @property {Object} encryptionInfo - Encryption info
 * @property {string} encryptionInfo.ownerEpub - Owner's public key
 * @property {string} encryptionInfo.ownerAddress - Owner's address
 */

/**
 * @typedef {Object} DeleteResult
 * @property {boolean} success - Whether deletion was successful
 * @property {string} [message] - Optional status message
 */

/**
 * @typedef {Object} DeleteBubbleResult
 * @property {boolean} success - Whether deletion was successful
 * @property {string} [message] - Optional status message
 */

/**
 * Base class for bubble storage providers
 */
export class BubbleBaseProvider {
  /**
   * Creates a new bubble provider instance
   * @param {BubbleProviderOptions} options - Provider configuration options
   */
  constructor(options) {
    const { rpcUrl, gun, keypair, chain = "polygon" } = options;

    if (!rpcUrl) throw new Error("RPC URL required");
    if (!chain) throw new Error("Chain name required");
    if (!gun) throw new Error("Gun instance required");
    if (!keypair || !keypair.epub || !keypair.epriv) {
      throw new Error("Valid keypair required");
    }

    this.provider = new ethers.JsonRpcProvider(rpcUrl);

    // Use custom contract address and ABI if provided, otherwise use defaults
    const contracts = addresses[chain];
    const contractAddr = contracts?.BubbleRegistry;
    const abi = bubbleRegistry_abi;

    if (!contractAddr) {
      throw new Error(`No contract address found for chain: ${chain}`);
    }

    /** @type {BubbleRegistryContract} */
    this.contract = new ethers.Contract(contractAddr, abi, this.provider);

    // Initialize Gun and keypair in base class
    this.gun = gun;
    this.keypair = keypair;
    this.bubbleRoot = this.gun.get("bubbles");

    // Key cache
    this.keyPairs = new Map();
  }

  /**
   * Verifies request signature
   * @param {string} address - Ethereum address of the requester
   * @param {string} message - Message that was signed
   * @param {string} signature - Signature of the message
   * @returns {Promise<boolean>} - Whether the signature is valid
   */
  async verifyRequest(address, message, signature) {
    try {
      const recoveredAddress = ethers.verifyMessage(message, signature);
      return recoveredAddress.toLowerCase() === address.toLowerCase();
    } catch (error) {
      return false;
    }
  }

  /**
   * Manages user keys
   * @param {string} address - Ethereum address of the user
   * @returns {Promise<Object>} - Key pair of the user
   */
  async getUserKeyPair(address) {
    const normalizedAddress = address.toLowerCase();
    let pair = this.keyPairs.get(normalizedAddress);

    if (!pair) {
      pair = await SEA.pair();
      this.keyPairs.set(normalizedAddress, pair);
    }

    return pair;
  }

  /**
   * Verifies bubble access
   * @param {string} bubbleId - ID of the bubble
   * @param {string} userAddress - Ethereum address of the user
   * @returns {Promise<boolean>} - Whether the user has access to the bubble
   */
  async verifyBubbleAccess(bubbleId, userAddress) {
    console.log("\n=== Checking bubble access ===");
    console.log("Bubble ID:", bubbleId);
    console.log("User Address:", userAddress);

    const hasAccess = await this.contract.hasAccess(bubbleId, userAddress);
    console.log("Access check result:", hasAccess);

    if (!hasAccess) {
      console.error("Access denied");
      throw new Error("No access to bubble");
    }

    console.log("Access verified successfully");
    return true;
  }

  /**
   * Verifies bubble ownership
   * @param {string} bubbleId - ID of the bubble
   * @param {string} ownerAddress - Ethereum address of the owner
   * @returns {Promise<boolean>} - Whether the user is the owner of the bubble
   */
  async verifyBubbleOwnership(bubbleId, ownerAddress) {
    console.log("\n=== Verifying bubble ownership ===");
    console.log("Bubble ID:", bubbleId);
    console.log("Owner address:", ownerAddress);

    console.log("Getting bubble data from contract...");
    const bubbleData = await this.contract.getBubbleDetails(bubbleId);
    const onChainOwner = bubbleData[1]; // owner is the second returned element

    console.log("On-chain owner:", onChainOwner);
    console.log("Expected owner:", ownerAddress);

    if (onChainOwner.toLowerCase() !== ownerAddress.toLowerCase()) {
      throw new Error("Not bubble owner");
    }

    console.log("Ownership verified successfully");
    return true;
  }

  /**
   * Grants on-chain access to a target address
   * @param {string} bubbleId - ID of the bubble
   * @param {string} targetAddress - Ethereum address to grant access to
   * @returns {Promise<void>}
   */
  async grantOnChainAccess(bubbleId, targetAddress) {
    console.log("\n=== Starting grantOnChainAccess ===");
    console.log("Getting signer...");
    const signer = await getSigner();
    console.log("Signer obtained");

    console.log("Connecting contract with signer...");
    const contractWithSigner = this.contract.connect(signer);
    console.log("Contract connected");

    console.log("Sending grantAccess transaction...");
    console.log("Bubble ID:", bubbleId);
    console.log("Target Address:", targetAddress);

    const tx = await contractWithSigner.grantAccess(bubbleId, targetAddress);
    console.log("Transaction sent:", tx.hash);

    console.log("Waiting for transaction confirmation...");
    await tx.wait();
    console.log("Transaction confirmed:", tx.hash);

    console.log("=== grantOnChainAccess completed successfully ===");
  }

  /**
   * Puts data into GunDB
   * @param {string} path - Path in GunDB
   * @param {Object} data - Data to put
   * @param {number} [maxRetries=3] - Maximum number of retries
   * @returns {Promise<void>}
   */
  async putGunData(path, data, maxRetries = 3) {
    let retries = 0;
    while (retries < maxRetries) {
      try {
        await new Promise((resolve, reject) => {
          this.gun.get(path).put(data, (ack) => {
            if (ack.err) reject(new Error(ack.err));
            else resolve();
          });
        });
        return;
      } catch (error) {
        retries++;
        if (retries === maxRetries) throw error;
        await new Promise((resolve) => setTimeout(resolve, 1000));
      }
    }
  }

  /**
   * Gets a node from GunDB
   * @typedef {Object} GunNode
   * @property {Object} data - Data of the node (if any)
   * @property {string} err - Error message if any
   * @property {any} content - Content of the node
   * @param {string} path - Path in GunDB
   * @param {number} [maxRetries=3] - Maximum number of retries
   * @returns {Promise<GunNode>} - Node data
   */
  async getGunNode(path, maxRetries = 3) {
    let retries = 0;
    let node = null;

    while (retries < maxRetries) {
      try {
        node = await new Promise((resolve, reject) => {
          const timeoutId = setTimeout(() => {
            reject(new Error("Gun node fetch timeout"));
          }, 5000);

          this.gun.get(path).once((data) => {
            clearTimeout(timeoutId);
            resolve(data);
          });
        });

        if (node) break;
        retries++;
        await new Promise((resolve) => setTimeout(resolve, 1000));
      } catch (error) {
        console.error(`Gun node fetch attempt ${retries + 1} failed:`, error);
        retries++;
        if (retries === maxRetries) throw error;
        await new Promise((resolve) => setTimeout(resolve, 1000));
      }
    }

    return node;
  }

  /**
   * Handles bubble creation
   * @param {Object} params - Parameters for bubble creation
   * @param {string} params.name - Name of the bubble
   * @param {boolean} params.isPrivate - Whether the bubble is private
   * @param {string} params.userAddress - Ethereum address of the user
   * @returns {Promise<BubbleDetails>} - Metadata of the created bubble
   */
  async handleCreateBubble(params) {
    const { name, isPrivate, userAddress } = params;

    if (!name || typeof isPrivate !== "boolean" || !userAddress) {
      throw new Error("Invalid parameters for bubble creation");
    }

    try {
      console.log("Starting bubble creation...");
      console.log("Parameters:", params);

      const signer = await getSigner();
      const contractWithSigner = this.contract.connect(signer);
      const tx = await contractWithSigner.createBubble(name, isPrivate);
      const receipt = await tx.wait();

      const event = receipt.logs.find((log) => {
        try {
          const parsedLog = this.contract.interface.parseLog(log);
          return parsedLog.name === "BubbleCreated";
        } catch (e) {
          return false;
        }
      });

      if (!event) {
        throw new Error("Bubble creation event not found");
      }

      const parsedEvent = this.contract.interface.parseLog(event);
      const bubbleId = parsedEvent.args[0];

      const metadata = {
        id: bubbleId,
        name,
        owner: userAddress,
        isPrivate,
        createdAt: Date.now(),
      };

      await this.putGunData(`bubbles/${bubbleId}`, metadata);

      return metadata;
    } catch (error) {
      console.error("Error creating bubble:", error);
      throw error;
    }
  }

  /**
   * Handles granting permission to a bubble
   * @param {string} bubbleId - ID of the bubble
   * @param {string} targetAddress - Ethereum address of the target user
   * @param {string} granterAddress - Ethereum address of the granter
   * @param {Object} options - Additional options
   * @param {string} options.granteeEpub - Public encryption key of the grantee
   * @returns {Promise<Object>} - Result of the permission grant
   */
  async handleGrantPermission(
    bubbleId,
    targetAddress,
    granterAddress,
    options
  ) {
    try {
      if (!options?.granteeEpub) {
        throw new Error("Grantee epub key is required");
      }

      await this.verifyBubbleOwnership(bubbleId, granterAddress);
      await this.grantOnChainAccess(bubbleId, targetAddress);

      return { success: true };
    } catch (error) {
      console.error("Error in handleGrantPermission:", error);
      throw error;
    }
  }

  /**
   * Handles file upload to a bubble
   * @abstract
   * @param {string} bubbleId - ID of the bubble
   * @param {string} fileName - Name of the file
   * @param {string} content - File content
   * @param {string} userAddress - Ethereum address of the uploader
   * @returns {Promise<FileMetadata>} - Metadata of the uploaded file
   */
  async handleFileUpload(bubbleId, fileName, content, userAddress) {
    throw new Error("handleFileUpload must be implemented");
  }

  /**
   * Handles file deletion from a bubble
   * @abstract
   * @param {string} bubbleId - ID of the bubble
   * @param {string} fileName - Name of the file
   * @param {string} userAddress - Ethereum address of the user
   * @returns {Promise<DeleteResult>} - Result of the deletion
   */
  async handleDeleteFile(bubbleId, fileName, userAddress) {
    throw new Error("handleDeleteFile must be implemented");
  }

  /**
   * Handles file download from a bubble
   * @abstract
   * @param {string} bubbleId - ID of the bubble
   * @param {string} fileName - Name of the file
   * @param {string} userAddress - Ethereum address of the user
   * @returns {Promise<{content: any, metadata: Object}>} - File content and metadata
   */
  async handleFileDownload(bubbleId, fileName, userAddress) {
    throw new Error("handleFileDownload must be implemented");
  }

  /**
   * Handles bubble deletion
   * @abstract
   * @param {string} bubbleId - ID of the bubble
   * @param {string} userAddress - Ethereum address of the user
   * @returns {Promise<DeleteBubbleResult>} - Result of the deletion
   */
  async handleDeleteBubble(bubbleId, userAddress) {
    throw new Error("handleDeleteBubble must be implemented");
  }
}
