// @ts-check

import { ethers } from "ethers";
import { 
  generatePassword,
  MESSAGE_TO_SIGN,
  verifySignature,
  getContractAddresses,
  getSigner
} from "../../core/gun-eth.js";
import { STEALTH_ANNOUNCER_ABI } from "../../constants/abis.js";
import SEA from 'gun/sea.js';
import { decrypt ,deriveSharedKey} from "../../utils/encryption.js";

/** 
 * Extended Gun with additional methods
 * @typedef {import('gun').IGun & { 
 *   get: (path: string) => any,
 *   verifySignature: (message: string, signature: string) => Promise<string>,
 *   put: (data: any) => void,
 *   set: (data: any) => void,
 *   map: () => any,
 *   once: (callback: (data: any, key: string) => void) => void
 * }} ExtendedGun 
 */

/**
 * @typedef {Object} StealthAddressResult
 * @property {string} stealthPrivateKey - The private key of the stealth address
 * @property {string} stealthAddress - The stealth address
 * @property {ethers.Wallet} wallet - The stealth wallet
 */

/**
 * @typedef {Object} StealthAddressGenerationResult
 * @property {string} stealthAddress - The generated stealth address
 * @property {string} senderPublicKey - The public key of the sender
 * @property {string} spendingPublicKey - The spending public key of the recipient
 */

/**
 * @typedef {Object} StealthPaymentOptions
 * @property {boolean} [onChain] - If true, announce on-chain, otherwise off-chain
 * @property {string} [chain] - The chain to announce on (if onChain=true)
 */

/**
 * @typedef {Object} StealthPaymentResult
 * @property {ethers.Wallet} wallet - The recovered wallet
 * @property {string} address - The recovered address
 */

/**
 * @typedef {Object} PublicKeysResult
 * @property {string} viewingPublicKey - The viewing public key
 * @property {string} spendingPublicKey - The spending public key
 */

/**
 * Configuration for StealthChain
 * @typedef {Object} StealthChainConfig
 * @property {string} [contractAddress] - Address of deployed StealthAnnouncer contract
 * @property {string} [abi] - ABI of the contract (optional, defaults to STEALTH_ANNOUNCER_ABI)
 */

export class StealthChain {
  /** @type {ExtendedGun} */
  gun;
  /** @type {string | undefined} */
  contractAddress;
  /** @type {any} */
  contractAbi;

  /**
   * Creates a new StealthChain instance
   * @param {ExtendedGun} gun - Gun instance
   * @param {StealthChainConfig} [config] - Optional configuration
   */
  constructor(gun, config = {}) {
    this.gun = gun;
    this.contractAddress = config.contractAddress;
    this.contractAbi = config.abi || STEALTH_ANNOUNCER_ABI;
  }

  /**
   * Gets contract instance for the specified chain
   * @param {string} chain - Chain identifier
   * @returns {Promise<ethers.Contract>} Contract instance
   */
  async getContract(chain) {
    const signer = await getSigner();
    const address = this.contractAddress || getContractAddresses(chain).STEALTH_ANNOUNCER_ADDRESS;
    
    return new ethers.Contract(
      address,
      this.contractAbi,
      signer
    );
  }

  /**
   * Derives a stealth address from shared secret and spending public key
   * @param {string} sharedSecret - The shared secret
   * @param {string} spendingPublicKey - The spending public key
   * @returns {StealthAddressResult} The derived stealth address details
   */
  deriveStealthAddress(sharedSecret, spendingPublicKey) {
    try {
      // Base64 to hex conversion function
      const base64ToHex = (base64) => {
        // Remove everything after the dot (if present)
        const cleanBase64 = base64.split('.')[0];
        // Remove 0x prefix if present
        const withoutPrefix = cleanBase64.replace('0x', '');
        // Convert from base64 to hex
        const raw = atob(withoutPrefix.replace(/-/g, '+').replace(/_/g, '/'));
        let hex = '';
        for (let i = 0; i < raw.length; i++) {
          const hexByte = raw.charCodeAt(i).toString(16);
          hex += hexByte.length === 2 ? hexByte : '0' + hexByte;
        }
        return '0x' + hex;
      };

      console.log("Input values:", {
        sharedSecret,
        spendingPublicKey
      });

      // Convert both values to hex
      const sharedSecretHex = base64ToHex(sharedSecret);
      const spendingPublicKeyHex = base64ToHex(spendingPublicKey);

      console.log("Converted values:", {
        sharedSecretHex,
        spendingPublicKeyHex
      });

      // Generate stealth private key
      const stealthPrivateKey = ethers.keccak256(
        ethers.concat([
          ethers.getBytes(sharedSecretHex),
          ethers.getBytes(spendingPublicKeyHex)
        ])
      );
      
      // Create stealth wallet
      const stealthWallet = new ethers.Wallet(stealthPrivateKey);

      console.log("Generated stealth values:", {
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
   * Generates a stealth address for a recipient
   * @param {string} recipientAddress - The recipient's address
   * @param {string} signature - The signature
   * @param {Object} options - Additional options
   * @returns {Promise<StealthAddressGenerationResult>} The generated stealth address details
   */
  async generateStealthAddress(recipientAddress, signature, options = {}) {
    try {
      console.log("\nGenerating stealth address...");
      
      // Get recipient's public keys
      const recipientData = await this.gun
        .get("gun-eth")
        .get("users")
        .get(recipientAddress)
        .get("publicKeys")
        .then();

      if (!recipientData?.viewingPublicKey || !recipientData?.spendingPublicKey) {
        throw new Error("Recipient's public keys not found");
      }

      console.log("Retrieved recipient keys:", {
        viewing: recipientData.viewingPublicKey.slice(0, 20) + "...",
        spending: recipientData.spendingPublicKey.slice(0, 20) + "..."
      });

      // Get sender's keys
      const senderAddress = await this.gun.verifySignature(MESSAGE_TO_SIGN, signature);
      const password = generatePassword(signature);
      
      const senderData = await this.gun
        .get("gun-eth")
        .get("users")
        .get(senderAddress)
        .then();

      if (!senderData?.s_pair) {
        throw new Error("Sender's keys not found");
      }

      // Decrypt sender's spending pair
      let spendingKeyPair;
      try {
        const decryptedData = await decrypt(senderData.s_pair, password);
        spendingKeyPair = typeof decryptedData === 'string' ? 
          JSON.parse(decryptedData) : 
          decryptedData;
      } catch (error) {
        console.error("Error decrypting spending pair:", error);
        throw new Error("Unable to decrypt spending pair");
      }

      // Generate shared secret using SEA ECDH
      const sharedSecret = await deriveSharedKey(recipientData.viewingPublicKey, spendingKeyPair)

      if (!sharedSecret) {
        throw new Error("Unable to generate shared secret");
      }

      console.log("Generated shared secret");

      // Derive stealth address
      const { stealthAddress } = this.deriveStealthAddress(
        sharedSecret,
        recipientData.spendingPublicKey
      );

      return {
        stealthAddress,
        senderPublicKey: spendingKeyPair.epub,
        spendingPublicKey: recipientData.spendingPublicKey
      };

    } catch (error) {
      console.error("Error generating stealth address:", error);
      throw error;
    }
  }

  /**
   * Announces a stealth payment on-chain or off-chain
   * @param {string} stealthAddress - The stealth address of the recipient
   * @param {string} senderPublicKey - The sender's public key
   * @param {string} spendingPublicKey - The recipient's spending public key
   * @param {string} signature - The sender's signature
   * @param {StealthPaymentOptions} options - Additional options
   * @returns {Promise<void>}
   */
  async announceStealthPayment(stealthAddress, senderPublicKey, spendingPublicKey, signature, options = {}) {
    try {
      const senderAddress = await verifySignature(MESSAGE_TO_SIGN, signature);

      if (options.onChain) {
        const contract = await this.getContract(options.chain);

        // Get dev fee
        const devFee = await contract.devFee();
        console.log("Dev fee:", devFee.toString());
        
        // Execute transaction with correct value
        const tx = await contract.announcePayment(
          senderPublicKey,
          spendingPublicKey,
          stealthAddress,
          { value: devFee }
        );
        
        await tx.wait();
        console.log("Payment announced on-chain, tx:", tx.hash);
      } else {
        this.gun
          .get("gun-eth")
          .get("stealth-payments")
          .set({
            stealthAddress,
            senderAddress,
            senderPublicKey,
            spendingPublicKey,
            timestamp: Date.now(),
          });
      }
    } catch (error) {
      console.error("Error announcing stealth payment:", error);
      throw error;
    }
  }

  /**
   * Retrieves stealth payments
   * @param {string} signature - The signature
   * @param {Object} options - Additional options
   * @returns {Promise<Array>} The list of stealth payments
   */
  async getStealthPayments(signature, options = {}) {
    try {
      const payments = [];

      // Set default options
      const defaultOptions = {
        source: 'both',
        chain: 'localhost'  // Default to localhost
      };
      options = { ...defaultOptions, ...options };

      if (options.source === 'onChain' || options.source === 'both') {
        const contract = await this.getContract(options.chain);
        
        const totalAnnouncements = await contract.getAnnouncementsCount();
        const totalCount = Number(totalAnnouncements.toString());
        
        if (totalCount > 0) {
          const batchSize = 100;
          const lastIndex = totalCount - 1;
          
          for(let i = 0; i <= lastIndex; i += batchSize) {
            const toIndex = Math.min(i + batchSize - 1, lastIndex);
            const batch = await contract.getAnnouncementsInRange(i, toIndex);
            
            for(const announcement of batch) {
              try {
                // Verify announcement is valid
                if (!announcement || !announcement.stealthAddress) continue;

                // Format announcement
                const formattedAnnouncement = {
                  stealthAddress: announcement.stealthAddress,
                  senderPublicKey: announcement.senderPublicKey,
                  spendingPublicKey: announcement.spendingPublicKey,
                  timestamp: Number(announcement.timestamp || 0)
                };

                // Try to recover funds
                try {
                  const recoveredWallet = await this.recoverStealthFunds(
                    formattedAnnouncement.stealthAddress,
                    formattedAnnouncement.senderPublicKey,
                    signature,
                    formattedAnnouncement.spendingPublicKey
                  );
                  
                  // If recovery succeeds, add announcement
                  payments.push({
                    ...formattedAnnouncement,
                    source: 'onChain',
                    wallet: recoveredWallet
                  });
                } catch (e) {
                  // If recovery fails, announcement wasn't for this user
                  console.log(`Skipping announcement: ${e.message}`);
                  continue;
                }

              } catch (e) {
                console.log(`Error processing announcement: ${e.message}`);
                continue;
              }
            }
          }
        }
      }

      if (options.source === 'offChain' || options.source === 'both') {
        const offChainPayments = await new Promise((resolve) => {
          const p = [];
          this.gun
            .get("gun-eth")
            .get("stealth-payments")
            .map()
            .once((payment, id) => {
              if (payment?.stealthAddress) {
                p.push({ ...payment, id, source: 'offChain' });
              }
            });
          setTimeout(() => resolve(p), 2000);
        });
        
        // Filter and process off-chain payments
        for (const payment of offChainPayments) {
          try {
            const recoveredWallet = await this.recoverStealthFunds(
              payment.stealthAddress,
              payment.senderPublicKey,
              signature,
              payment.spendingPublicKey
            );
            payments.push({
              ...payment,
              wallet: recoveredWallet
            });
          } catch (e) {
            console.log(`Skipping off-chain payment: ${e.message}`);
            continue;
          }
        }
      }

      return payments;
    } catch (error) {
      console.error("Error retrieving stealth payments:", error);
      throw error;
    }
  }

  /**
   * Recovers stealth funds
   * @param {string} stealthAddress - The stealth address
   * @param {string} senderPublicKey - The sender's public key
   * @param {string} signature - The signature
   * @param {string} spendingPublicKey - The spending public key
   * @returns {Promise<StealthPaymentResult>} The recovered funds details
   */
  async recoverStealthFunds(stealthAddress, senderPublicKey, signature, spendingPublicKey) {
    try {
      const gun = this.gun;
      const password = generatePassword(signature);

      // Get own key pairs
      const myAddress = await verifySignature(MESSAGE_TO_SIGN, signature);
      const encryptedData = await gun
        .get("gun-eth")
        .get("users")
        .get(myAddress)
        .then();

      if (!encryptedData?.v_pair) {
        throw new Error("Keys not found");
      }

      // Decrypt viewing pair
      let viewingKeyPair;
      try {
        const decryptedViewingData = await decrypt(encryptedData.v_pair, password);
        viewingKeyPair = typeof decryptedViewingData === 'string' ? 
          JSON.parse(decryptedViewingData) : 
          decryptedViewingData;
      } catch (error) {
        throw new Error("Unable to decrypt keys");
      }

      // Generate shared secret using SEA ECDH
      const sharedSecret = await SEA.secret(senderPublicKey, viewingKeyPair);

      if (!sharedSecret) {
        throw new Error("Unable to generate shared secret");
      }

      const { wallet, stealthAddress: recoveredAddress } =  this.deriveStealthAddress(
        sharedSecret,
        spendingPublicKey
      );

      // Verify address matches
      if (recoveredAddress.toLowerCase() !== stealthAddress.toLowerCase()) {
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
  }

  /**
   * Publishes user's stealth keys
   * @param {string} signature - The signature
   * @returns {Promise<PublicKeysResult>} The published public keys
   */
  async publishStealthKeys(signature) {
    try {
      // Verifica la firma
      const signer = await getSigner();
      if (!signer) {
        throw new Error("No signer available");
      }
      const address = await signer.getAddress();
      
      const recoveredAddress = await verifySignature(MESSAGE_TO_SIGN, signature);
      if (!recoveredAddress || recoveredAddress.toLowerCase() !== address.toLowerCase()) {
        throw new Error("Invalid signature");
      }

      // Genera la password dal signature
      const password = generatePassword(signature);
      if (!password) {
        throw new Error("No encryption key.");
      }

      // Genera key pairs
      const viewingKeyPair = await SEA.pair();
      const spendingKeyPair = await SEA.pair();

      // Encrypt key pairs
      const encryptedViewingPair = await SEA.encrypt(JSON.stringify(viewingKeyPair), password);
      const encryptedSpendingPair = await SEA.encrypt(JSON.stringify(spendingKeyPair), password);

      // Save public keys and encrypted pairs
      await this.gun.get('gun-eth')
        .get('users')
        .get(address)
        .put({
          publicKeys: {
            viewingPublicKey: viewingKeyPair.epub,
            spendingPublicKey: spendingKeyPair.epub
          },
          v_pair: encryptedViewingPair,
          s_pair: encryptedSpendingPair
        });

      return {
        viewingPublicKey: viewingKeyPair.epub,
        spendingPublicKey: spendingKeyPair.epub
      };
    } catch (error) {
      console.error("Error publishing stealth keys:", error);
      throw error;
    }
  }
} 