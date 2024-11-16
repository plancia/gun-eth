// =============================================
// IMPORTS AND GLOBAL VARIABLES
// =============================================
import Gun from "gun";
import SEA from "gun/sea.js";
import { ethers } from "ethers";
import { PROOF_OF_INTEGRITY_ABI, PROOF_OF_INTEGRITY_ADDRESS } from "../abis/abis.js";
import { LOCAL_CONFIG } from "../config/local.js";

let PROOF_CONTRACT_ADDRESS;
let rpcUrl = "";
let privateKey = "";

export const MESSAGE_TO_SIGN = "Access GunDB with Ethereum";

// =============================================
// UTILITY FUNCTIONS
// =============================================
/**
 * Generates a random node ID for GunDB
 * @returns {string} A random hexadecimal string
 */
function generateRandomId() {
  return ethers.hexlify(ethers.randomBytes(32)).slice(2);
}

/**
 * Generates a password from a signature.
 * @param {string} signature - The signature to derive the password from.
 * @returns {string|null} The generated password or null if generation fails.
 */
export function generatePassword(signature) {
  try {
    const hexSignature = ethers.hexlify(signature);
    const hash = ethers.keccak256(hexSignature);
    console.log("Generated password:", hash);
    return hash;
  } catch (error) {
    console.error("Error generating password:", error);
    return null;
  }
}

/**
 * Converts a Gun private key to an Ethereum account.
 * @param {string} gunPrivateKey - The Gun private key in base64url format.
 * @returns {Object} An object containing the Ethereum account and public key.
 */
export function gunToEthAccount(gunPrivateKey) {
  // Function to convert base64url to hex
  const base64UrlToHex = (base64url) => {
    const padding = "=".repeat((4 - (base64url.length % 4)) % 4);
    const base64 = base64url.replace(/-/g, "+").replace(/_/g, "/") + padding;
    const binary = atob(base64);
    return Array.from(binary, (char) =>
      char.charCodeAt(0).toString(16).padStart(2, "0")
    ).join("");
  };

  // Convert Gun private key to hex format
  const hexPrivateKey = "0x" + base64UrlToHex(gunPrivateKey);

  // Create an Ethereum wallet from the private key
  const wallet = new ethers.Wallet(hexPrivateKey);

  // Get the public address (public key)
  const publicKey = wallet.address;

  return {
    account: wallet,
    publicKey: publicKey,
    privateKey: hexPrivateKey,
  };
}

/**
 * Gets an Ethereum signer based on current configuration
 * @returns {Promise<ethers.Signer>} The configured signer
 * @throws {Error} If no valid provider is found
 */
const getSigner = async () => {
  if (rpcUrl && privateKey) {
    // Standalone mode with local provider
    const provider = new ethers.JsonRpcProvider(rpcUrl, {
      chainId: LOCAL_CONFIG.CHAIN_ID,
      name: "localhost"
    });
    return new ethers.Wallet(privateKey, provider);
  } else if (
    typeof window !== "undefined" &&
    typeof window.ethereum !== "undefined"
  ) {
    // Browser mode
    await window.ethereum.request({ method: "eth_requestAccounts" });
    const provider = new ethers.BrowserProvider(window.ethereum);
    return provider.getSigner();
  } else {
    throw new Error("No valid Ethereum provider found");
  }
};

// =============================================
// BASIC GUN-ETH CHAIN METHODS
// =============================================

// Set the message to sign
Gun.chain.MESSAGE_TO_SIGN = MESSAGE_TO_SIGN;

/**
 * Sets standalone configuration for Gun.
 * @param {string} newRpcUrl - The new RPC URL.
 * @param {string} newPrivateKey - The new private key.
 * @returns {Gun} The Gun instance for chaining.
 */
Gun.chain.setSigner = function (newRpcUrl, newPrivateKey) {
  rpcUrl = newRpcUrl;
  privateKey = newPrivateKey;
  console.log("Standalone configuration set");
  return this;
};

/**
 * Verifies an Ethereum signature.
 * @param {string} message - The original message that was signed.
 * @param {string} signature - The signature to verify.
 * @returns {Promise<string|null>} The recovered address or null if verification fails.
 */
Gun.chain.verifySignature = async function (message, signature) {
  try {
    const recoveredAddress = ethers.verifyMessage(message, signature);
    return recoveredAddress;
  } catch (error) {
    console.error("Error verifying signature:", error);
    return null;
  }
};

/**
 * Generates a password from a signature.
 * @param {string} signature - The signature to derive the password from.
 * @returns {string|null} The generated password or null if generation fails.
 */
Gun.chain.generatePassword = function (signature) {
  return generatePassword(signature);
};

/**
 * Creates an Ethereum signature for a given message.
 * @param {string} message - The message to sign.
 * @returns {Promise<string|null>} The signature or null if signing fails.
 */
Gun.chain.createSignature = async function (message) {
  try {
    // Check if message matches MESSAGE_TO_SIGN
    if (message !== MESSAGE_TO_SIGN) {
      throw new Error("Invalid message, valid message is: " + MESSAGE_TO_SIGN);
    }
    const signer = await getSigner();
    const signature = await signer.signMessage(message);
    console.log("Signature created:", signature);
    return signature;
  } catch (error) {
    console.error("Error creating signature:", error);
    return null;
  }
};

// =============================================
// KEY PAIR MANAGEMENT
// =============================================
/**
 * Creates and stores an encrypted key pair for a given address.
 * @param {string} address - The Ethereum address to associate with the key pair.
 * @param {string} signature - The signature to use for encryption.
 * @returns {Promise<void>}
 */
Gun.chain.createAndStoreEncryptedPair = async function (address, signature) {
  try {
    const gun = this;
    const pair = await SEA.pair();
    const v_pair = await SEA.pair();
    const s_pair = await SEA.pair();
    const password = generatePassword(signature);

    // Save original SEA pairs
    const encryptedPair = await SEA.encrypt(JSON.stringify(pair), password);
    const encryptedV_pair = await SEA.encrypt(JSON.stringify(v_pair), password);
    const encryptedS_pair = await SEA.encrypt(JSON.stringify(s_pair), password);

    // Convert only to get Ethereum addresses
    const viewingAccount = gunToEthAccount(v_pair.priv);
    const spendingAccount = gunToEthAccount(s_pair.priv);

    await gun.get("gun-eth").get("users").get(address).put({
      pair: encryptedPair,
      v_pair: encryptedV_pair,
      s_pair: encryptedS_pair,
      publicKeys: {
        viewingPublicKey: v_pair.epub, // Use SEA encryption public key
        viewingPublicKey: v_pair.epub, // Use SEA encryption public key
        spendingPublicKey: spendingAccount.publicKey, // Use Ethereum address
        ethViewingAddress: viewingAccount.publicKey // Also save Ethereum address
      }
    });

    console.log("Encrypted pairs and public keys stored for:", address);
  } catch (error) {
    console.error("Error creating and storing encrypted pair:", error);
    throw error;
  }
};

/**
 * Retrieves and decrypts a stored key pair for a given address.
 * @param {string} address - The Ethereum address associated with the key pair.
 * @param {string} signature - The signature to use for decryption.
 * @returns {Promise<Object|null>} The decrypted key pair or null if retrieval fails.
 */
Gun.chain.getAndDecryptPair = async function (address, signature) {
  try {
    const gun = this;
    const encryptedData = await gun
      .get("gun-eth")
      .get("users")
      .get(address)
      .get("pair")
      .then();
    if (!encryptedData) {
      throw new Error("No encrypted data found for this address");
    }
    const decryptedPair = await SEA.decrypt(encryptedData, signature);
    console.log(decryptedPair);
    return decryptedPair;
  } catch (error) {
    console.error("Error retrieving and decrypting pair:", error);
    return null;
  }
};

// =============================================
// PROOF OF INTEGRITY
// =============================================
/**
 * Proof of Integrity
 * @param {string} chain - The blockchain to use (e.g., "optimismSepolia").
 * @param {string} nodeId - The ID of the node to verify or write.
 * @param {Object} data - The data to write (if writing).
 * @param {Function} callback - Callback function to handle the result.
 * @returns {Gun} The Gun instance for chaining.
 */
Gun.chain.proof = function (chain, nodeId, data, callback) {
  console.log("Proof plugin called with:", { chain, nodeId, data });

  if (typeof callback !== "function") {
    console.error("Callback must be a function");
    return this;
  }

  const gun = this;

  // Seleziona l'indirizzo basato sulla catena
  if (chain === "optimismSepolia" || chain === "localhost") {
    PROOF_CONTRACT_ADDRESS = process.env.NODE_ENV === 'development'
      ? LOCAL_CONFIG.PROOF_OF_INTEGRITY_ADDRESS
      : PROOF_OF_INTEGRITY_ADDRESS;
      
    console.log("Using contract address:", PROOF_CONTRACT_ADDRESS);
    
    if (!PROOF_CONTRACT_ADDRESS) {
      callback({ err: "Contract address not found. Did you deploy the contract?" });
      return this;
    }
  } else {
    callback({ err: "Chain not supported" });
    return this;
  }

  // Funzione per verificare on-chain
  const verifyOnChain = async (nodeId, contentHash) => {
    console.log("Verifying on chain:", { nodeId, contentHash });
    const signer = await getSigner();
    const contract = new ethers.Contract(
      PROOF_CONTRACT_ADDRESS,
      PROOF_OF_INTEGRITY_ABI,
      signer
    );
    const [isValid, timestamp, updater] = await contract.verifyData(
      ethers.toUtf8Bytes(nodeId),
      contentHash
    );
    console.log("Verification result:", { isValid, timestamp, updater });
    return { isValid, timestamp, updater };
  };

  // Funzione per scrivere on-chain
  const writeOnChain = async (nodeId, contentHash) => {
    console.log("Writing on chain:", { nodeId, contentHash });
    const signer = await getSigner();
    const contract = new ethers.Contract(
      PROOF_CONTRACT_ADDRESS,
      PROOF_OF_INTEGRITY_ABI,
      signer
    );
    const tx = await contract.updateData(
      ethers.toUtf8Bytes(nodeId),
      contentHash
    );
    console.log("Transaction sent:", tx.hash);
    const receipt = await tx.wait();
    console.log("Transaction confirmed:", receipt);
    return tx;
  };

  // Funzione per ottenere l'ultimo record
  const getLatestRecord = async (nodeId) => {
    const signer = await getSigner();
    const contract = new ethers.Contract(
      PROOF_CONTRACT_ADDRESS,
      PROOF_OF_INTEGRITY_ABI,
      signer
    );
    const [contentHash, timestamp, updater] = await contract.getLatestRecord(
      ethers.toUtf8Bytes(nodeId)
    );
    console.log("Latest record from blockchain:", {
      nodeId,
      contentHash,
      timestamp,
      updater,
    });
    return { contentHash, timestamp, updater };
  };

  
  if (nodeId && !data) {
    // Case 1: User passes only node
    gun.get(nodeId).once(async (existingData) => {
      if (!existingData) {
        if (callback) callback({ err: "Node not found in GunDB" });
        return;
      }

      console.log("existingData", existingData);

      // Use stored contentHash instead of recalculating
      const contentHash = existingData._contentHash;
      console.log("contentHash", contentHash);

      if (!contentHash) {
        if (callback) callback({ err: "No content hash found for this node" });
        return;
      }

      try {
        const { isValid, timestamp, updater } = await verifyOnChain(
          nodeId,
          contentHash
        );
        const latestRecord = await getLatestRecord(nodeId);

        if (isValid) {
          if (callback)
            callback({
              ok: true,
              message: "Data verified on blockchain",
              timestamp,
              updater,
              latestRecord,
            });
        } else {
          if (callback)
            callback({
              ok: false,
              message: "Data not verified on blockchain",
              latestRecord,
            });
        }
      } catch (error) {
        if (callback) callback({ err: error.message });
      }
    });
  } else if (data && !nodeId) {
    // Case 2: User passes only text (data)
    const newNodeId = generateRandomId();
    const dataString = JSON.stringify(data);
    const contentHash = ethers.keccak256(ethers.toUtf8Bytes(dataString));

    gun
      .get(newNodeId)
      .put({ ...data, _contentHash: contentHash }, async (ack) => {
        console.log("ack", ack);
        if (ack.err) {
          if (callback) callback({ err: "Error saving data to GunDB" });
          return;
        }

        try {
          const tx = await writeOnChain(newNodeId, contentHash);
          if (callback)
            callback({
              ok: true,
              message: "Data written to GunDB and blockchain",
              nodeId: newNodeId,
              txHash: tx.hash,
            });
        } catch (error) {
          if (callback) callback({ err: error.message });
        }
      });
  } else {
    if (callback)
      callback({
        err: "Invalid input. Provide either nodeId or data, not both.",
      });
  }

  return gun;
};

// =============================================
// STEALTH ADDRESS CORE FUNCTIONS
// =============================================
/**
 * Converts a Gun private key to an Ethereum account.
 * @param {string} gunPrivateKey - The Gun private key in base64url format.
 * @returns {Object} An object containing the Ethereum account and public key.
 */
Gun.chain.gunToEthAccount = function (gunPrivateKey) {
  return gunToEthAccount(gunPrivateKey);
};

/**
 * Utility function to generate stealth address
 * @param {string} sharedSecret - The shared secret
 * @param {string} spendingPublicKey - The spending public key
 * @returns {Object} The stealth address and private key
 */
function deriveStealthAddress(sharedSecret, spendingPublicKey) {
  try {
    // Convert shared secret to bytes
    const sharedSecretBytes = Buffer.from(sharedSecret, 'base64');
    
    // Generate stealth private key using shared secret and spending public key
    const stealthPrivateKey = ethers.keccak256(
      ethers.concat([
        sharedSecretBytes,
        ethers.getBytes(spendingPublicKey)
      ])
    );
    
    // Create stealth wallet
    const stealthWallet = new ethers.Wallet(stealthPrivateKey);

    console.log("Debug deriveStealthAddress:", {
      sharedSecretHex: ethers.hexlify(sharedSecretBytes),
      spendingPublicKey,
      stealthPrivateKey,
      stealthAddress: stealthWallet.address
    });

    return {
      stealthPrivateKey,
      stealthAddress: stealthWallet.address,
      wallet: stealthWallet
    };
  } catch (error) {
    console.error("Error in deriveStealthAddress:", error);
    throw error;
  }
}

/**
 * Generate a stealth key and related key pairs
 * @param {string} recipientAddress - The recipient's Ethereum address
 * @param {string} signature - The sender's signature to access their keys
 * @returns {Promise<Object>} Object containing stealth addresses and keys
 */
Gun.chain.generateStealthAddress = async function (recipientAddress, signature) {
  try {
    const gun = this;
    
    // Get recipient's public keys
    const recipientData = await gun
      .get("gun-eth")
      .get("users")
      .get(recipientAddress)
      .get("publicKeys")
      .then();

    if (!recipientData || !recipientData.viewingPublicKey || !recipientData.spendingPublicKey) {
      throw new Error("Recipient's public keys not found");
    }

    // Get sender's keys
    const senderAddress = await this.verifySignature(MESSAGE_TO_SIGN, signature);
    const password = generatePassword(signature);
    
    const senderData = await gun
      .get("gun-eth")
      .get("users")
      .get(senderAddress)
      .then();

    if (!senderData || !senderData.s_pair) {
      throw new Error("Sender's keys not found");
    }

    // Decrypt sender's spending pair
    let spendingKeyPair;
    try {
      const decryptedData = await SEA.decrypt(senderData.s_pair, password);
      spendingKeyPair = typeof decryptedData === 'string' ? 
        JSON.parse(decryptedData) : 
        decryptedData;
    } catch (error) {
      console.error("Error decrypting spending pair:", error);
      throw new Error("Unable to decrypt spending pair");
    }

    // Generate shared secret using SEA ECDH with encryption public key
    const sharedSecret = await SEA.secret(recipientData.viewingPublicKey, spendingKeyPair);

    if (!sharedSecret) {
      throw new Error("Unable to generate shared secret");
    }

    console.log("Generate shared secret:", sharedSecret);

    const { stealthAddress } = deriveStealthAddress(
      sharedSecret,
      recipientData.spendingPublicKey
    );

    return {
      stealthAddress,
      senderPublicKey: spendingKeyPair.epub, // Use encryption public key
      spendingPublicKey: recipientData.spendingPublicKey
    };

  } catch (error) {
    console.error("Error generating stealth address:", error);
    throw error;
  }
};

/**
 * Publish public keys needed to receive stealth payments
 * @param {string} signature - The signature to authenticate the user
 * @returns {Promise<void>}
 */
Gun.chain.publishStealthKeys = async function (signature) {
  try {
    const gun = this;
    const address = await this.verifySignature(MESSAGE_TO_SIGN, signature);
    const password = generatePassword(signature);

    // Get encrypted key pairs
    const encryptedData = await gun
      .get("gun-eth")
      .get("users")
      .get(address)
      .then();

    if (!encryptedData || !encryptedData.v_pair || !encryptedData.s_pair) {
      throw new Error("Keys not found");
    }

    // Decrypt viewing and spending pairs
    const viewingKeyPair = JSON.parse(
      await SEA.decrypt(encryptedData.v_pair, password)
    );
    const spendingKeyPair = JSON.parse(
      await SEA.decrypt(encryptedData.s_pair, password)
    );

    const viewingAccount = gunToEthAccount(viewingKeyPair.priv);
    const spendingAccount = gunToEthAccount(spendingKeyPair.priv);

    // Publish only public keys
    await gun.get("gun-eth").get("users").get(address).get("publicKeys").put({
      viewingPublicKey: viewingAccount.publicKey,
      spendingPublicKey: spendingAccount.publicKey,
    });

    console.log("Stealth public keys published successfully");
  } catch (error) {
    console.error("Error publishing stealth keys:", error);
    throw error;
  }
};

// =============================================
// STEALTH PAYMENT FUNCTIONS
// =============================================
/**
 * Recover funds from a stealth address
 * @param {string} stealthAddress - The stealth address to recover funds from
 * @param {string} senderPublicKey - The sender's public key used to generate the address
 * @param {string} signature - The signature to decrypt private keys
 * @returns {Promise<Object>} Object containing wallet to access funds
 */
Gun.chain.recoverStealthFunds = async function (
  stealthAddress,
  senderPublicKey,
  signature,
  spendingPublicKey
) {
  try {
    const gun = this;
    const password = generatePassword(signature);

    // Get own key pairs
    const myAddress = await this.verifySignature(MESSAGE_TO_SIGN, signature);
    const encryptedData = await gun
      .get("gun-eth")
      .get("users")
      .get(myAddress)
      .then();

    if (!encryptedData || !encryptedData.v_pair || !encryptedData.s_pair) {
      throw new Error("Keys not found");
    }

    // Decrypt viewing and spending pairs
    let viewingKeyPair;
    try {
      const decryptedViewingData = await SEA.decrypt(encryptedData.v_pair, password);
      viewingKeyPair = typeof decryptedViewingData === 'string' ? 
        JSON.parse(decryptedViewingData) : 
        decryptedViewingData;
    } catch (error) {
      console.error("Error decrypting keys:", error);
      throw new Error("Unable to decrypt keys");
    }

    // Generate shared secret using SEA ECDH
    const sharedSecret = await SEA.secret(senderPublicKey, viewingKeyPair);

    if (!sharedSecret) {
      throw new Error("Unable to generate shared secret");
    }

    console.log("Recover shared secret:", sharedSecret);

    const { wallet, stealthAddress: recoveredAddress } = deriveStealthAddress(
      sharedSecret,
      spendingPublicKey
    );

    // Verify address matches
    if (recoveredAddress.toLowerCase() !== stealthAddress.toLowerCase()) {
      console.error("Mismatch:", {
        recovered: recoveredAddress,
        expected: stealthAddress,
        sharedSecret
      });
      throw new Error("Recovered stealth address does not match");
    }

    return {
      wallet,
      address: recoveredAddress,
    };
  } catch (error) {
    console.error("Error recovering stealth funds:", error);
    throw error;
  }
};

/**
 * Announce a stealth payment
 * @param {string} stealthAddress - The generated stealth address
 * @param {string} senderPublicKey - The sender's public key
 * @param {string} spendingPublicKey - The spending public key
 * @param {string} signature - The sender's signature
 * @returns {Promise<void>}
 */
Gun.chain.announceStealthPayment = async function (
  stealthAddress,
  senderPublicKey,
  spendingPublicKey,
  signature,
  options = { onChain: false }
) {
  try {
    const gun = this;
    const senderAddress = await this.verifySignature(MESSAGE_TO_SIGN, signature);

    if (options.onChain) {
      // On-chain announcement
      const signer = await getSigner();
      const contractAddress = process.env.NODE_ENV === 'development' 
        ? LOCAL_CONFIG.STEALTH_ANNOUNCER_ADDRESS 
        : STEALTH_ANNOUNCER_ADDRESS;

      console.log("Using contract address:", contractAddress);

      const contract = new ethers.Contract(
        contractAddress,
        STEALTH_ANNOUNCER_ABI,
        signer
      );

      // Get dev fee from contract
      const devFee = await contract.devFee();
      console.log("Dev fee:", devFee.toString());

      // Call contract
      const tx = await contract.announcePayment(
        senderPublicKey,
        spendingPublicKey,
        stealthAddress,
        { value: devFee }
      );
      
      console.log("Transaction sent:", tx.hash);
      const receipt = await tx.wait();
      console.log("Transaction confirmed:", receipt.hash);
      
      console.log("Stealth payment announced on-chain (dev fee paid)");
    } else {
      // Off-chain announcement (GunDB)
      await gun
        .get("gun-eth")
        .get("stealth-payments")
        .set({
          stealthAddress,
          senderAddress,
          senderPublicKey,
          spendingPublicKey,
          timestamp: Date.now(),
        });
      console.log("Stealth payment announced off-chain");
    }
  } catch (error) {
    console.error("Error announcing stealth payment:", error);
    console.error("Error details:", error.stack);
    throw error;
  }
};

/**
 * Get all stealth payments for an address
 * @param {string} signature - The signature to authenticate the user
 * @returns {Promise<Array>} List of stealth payments
 */
Gun.chain.getStealthPayments = async function (signature, options = { source: 'both' }) {
  try {
    const payments = [];

    if (options.source === 'onChain' || options.source === 'both') {
      // Get on-chain payments
      const signer = await getSigner();
      const contractAddress = process.env.NODE_ENV === 'development' 
        ? LOCAL_CONFIG.STEALTH_ANNOUNCER_ADDRESS 
        : STEALTH_ANNOUNCER_ADDRESS;

      const contract = new ethers.Contract(
        contractAddress,
        STEALTH_ANNOUNCER_ABI,
        signer
      );
      
      try {
        // Get total number of announcements
        const totalAnnouncements = await contract.getAnnouncementsCount();
        const totalCount = Number(totalAnnouncements.toString());
        console.log("Total on-chain announcements:", totalCount);
        
        if (totalCount > 0) {
          // Get announcements in batches of 100
          const batchSize = 100;
          const lastIndex = totalCount - 1;
          
          for(let i = 0; i <= lastIndex; i += batchSize) {
            const toIndex = Math.min(i + batchSize - 1, lastIndex);
            const batch = await contract.getAnnouncementsInRange(i, toIndex);
            
            // For each announcement, try to decrypt
            for(const announcement of batch) {
              try {
                // Verify announcement is valid
                if (!announcement || !announcement.stealthAddress || 
                    !announcement.senderPublicKey || !announcement.spendingPublicKey) {
                  console.log("Invalid announcement:", announcement);
                  continue;
                }

                // Try to recover funds to verify if announcement is for us
                const recoveredWallet = await this.recoverStealthFunds(
                  announcement.stealthAddress,
                  announcement.senderPublicKey,
                  signature,
                  announcement.spendingPublicKey
                );
                
                // If no errors thrown, announcement is for us
                payments.push({
                  stealthAddress: announcement.stealthAddress,
                  senderPublicKey: announcement.senderPublicKey,
                  spendingPublicKey: announcement.spendingPublicKey,
                  timestamp: Number(announcement.timestamp),
                  source: 'onChain',
                  wallet: recoveredWallet
                });

              } catch (e) {
                // Not for us, continue
                console.log(`Announcement not for us: ${announcement.stealthAddress}`);
                continue;
              }
            }
          }
        }
      } catch (error) {
        console.error("Error retrieving on-chain announcements:", error);
      }
    }

    if (options.source === 'offChain' || options.source === 'both') {
      // Get off-chain payments
      const gun = this;
      const offChainPayments = await new Promise((resolve) => {
        const p = [];
        gun
          .get("gun-eth")
          .get("stealth-payments")
          .get(recipientAddress)
          .map()
          .once((payment, id) => {
            if (payment?.stealthAddress) {
              p.push({ ...payment, id, source: 'offChain' });
            }
          });
        setTimeout(() => resolve(p), 2000);
      });
      
      payments.push(...offChainPayments);
    }

    console.log(`Found ${payments.length} stealth payments`);
    return payments;
  } catch (error) {
    console.error("Error retrieving stealth payments:", error);
    throw error;
  }
};

/**
 * Clean up old stealth payments
 * @param {string} recipientAddress - The recipient's address
 * @returns {Promise<void>}
 */
Gun.chain.cleanStealthPayments = async function(recipientAddress) {
  try {
    const gun = this;
    const payments = await gun
      .get("gun-eth")
      .get("stealth-payments")
      .get(recipientAddress)
      .map()
      .once()
      .then();

    // Remove empty or invalid nodes
    if (payments) {
      Object.keys(payments).forEach(async (key) => {
        const payment = payments[key];
        if (!payment || !payment.stealthAddress || !payment.senderPublicKey || !payment.spendingPublicKey) {
          await gun
            .get("gun-eth")
            .get("stealth-payments")
            .get(recipientAddress)
            .get(key)
            .put(null);
        }
      });
    }
  } catch (error) {
    console.error("Error cleaning stealth payments:", error);
  }
};

// =============================================
// EXPORTS
// =============================================
export default Gun;
