// @ts-check

import { ethers } from "ethers";
import Gun from "gun";
import SEA from "gun/sea.js";
import { StealthChain } from "../features/stealth/StealthChain.js";
import { ProofChain } from "../features/proof/ProofChain.js";
import { STEALTH_ANNOUNCER_ABI } from "../constants/abis.js";
import {
  PROOF_OF_INTEGRITY_ADDRESS,
  STEALTH_ANNOUNCER_ADDRESS,
  getAddressesForChain,
  isLocalEnvironment,
} from "../constants/abis.js";
import { LOCAL_CONFIG } from "../config/local.js";
import { encrypt, decrypt } from '../utils/encryption.js';
import { 
  generateRandomId, 
  getContractAddresses,
  getSigner as getCommonSigner 
} from '../utils/common.js';

/**
 * @typedef {import('gun').IGunChain<any, any, any, any>} IGunChain
 * @typedef {import('gun').IGunInstance} IGunInstance
 * @typedef {import('gun').IGun} IGun
 * @typedef {import('gun').GunOptions} GunOptions
 * @typedef {import('gun').GunSchema} GunSchema
 * @typedef {import('gun').GunHookCallbackCreate} GunHookCallbackCreate
 * @typedef {import('gun').GunHookCallbackOpt} GunHookCallbackOpt
 */

/**
 * @typedef {Object} GunMethods
 * @property {(path: string) => IGunInstance} get - Get method
 * @property {(data: any) => IGunInstance} put - Put method
 * @property {(data: any) => IGunInstance} set - Set method
 * @property {() => IGunInstance} map - Map method
 * @property {() => IGunInstance} back - Back method
 * @property {() => IGunInstance} off - Off method
 * @property {{
 *   (event: "create", callback: GunHookCallbackCreate): void;
 *   (event: "opt", callback: GunHookCallbackOpt): void;
 *   (event: string, callback: Function): IGunInstance;
 * }} on - On method
 * @property {(callback: (data: any, key: string) => void) => IGunInstance} once - Once method
 */

/**
 * @typedef {Object} GunBase
 * @property {Object} state - Gun state
 * @property {IGunChain & IGunInstance} chain - Gun chain
 * @property {Object} SEA - Gun SEA
 * @property {(message: string, signature: string) => Promise<string>} verifySignature - Verify signature method
 * @property {Object} _ - Gun internal properties
 * @property {Object} user - Gun user instance
 * @property {Object} opt - Gun options
 */

/**
 * @typedef {GunBase & GunMethods & {
 *   (options?: GunOptions): IGunInstance;
 *   new (options?: GunOptions): IGunInstance;
 * }} GunExtended
 */

/**
 * @typedef {Object} StealthMethodsBase
 * @property {function(this: IGunInstance, string, string, Object): Promise<any>} generateStealthAddress
 * @property {function(this: IGunInstance, string, string, string, string, Object): Promise<{stealthAddress: string, senderPublicKey: string, spendingPublicKey: string, timestamp: number, source: string}>} announceStealthPayment
 * @property {function(this: IGunInstance, string, Object): Promise<Array<any>>} getStealthPayments
 * @property {function(this: IGunInstance, string, string, string, string): Promise<any>} recoverStealthFunds
 * @property {function(this: IGunInstance, string): Promise<any>} publishStealthKeys
 * @property {function(this: IGunInstance, string, ...any[]): Promise<any>} stealth
 * @property {function(this: IGunInstance, function(any): void): any} monitorStealthEvents
 */

/**
 * @typedef {Object} ExtendedSigner
 * @property {string} address - Ethereum address
 * @property {string} privateKey - Private key
 * @property {function(string): Promise<string>} signMessage - Signs a message
 * @property {function(): Promise<string>} getAddress - Gets the signer address
 * @property {Object} provider - Provider instance
 */

/**
 * @typedef {Object} BaseMethods
 * @property {string} MESSAGE_TO_SIGN
 * @property {function} setSigner
 * @property {function} getSigner
 * @property {function} verifySignature
 * @property {function} generatePassword
 * @property {function} createSignature
 * @property {function} createAndStoreEncryptedPair
 * @property {function} getAndDecryptPair
 * @property {function} ethToGunAccount
 * @property {function} gunToEthAccount
 * @property {function} getAddressesForChain
 */

/**
 * @typedef {StealthMethodsBase & IGunInstance} StealthMethods
 */

/**
 * @typedef {Object} ExtendedGunBase
 * @property {Object} state - Gun state
 * @property {IGunChain & IGunInstance} chain - Gun chain
 * @property {Object} SEA - Gun SEA
 * @property {(path: string) => any} get - Get method
 * @property {(data: any) => void} put - Put method
 * @property {(data: any) => void} set - Set method
 * @property {() => any} map - Map method
 * @property {(event: string, callback: Function) => any} on - On method
 * @property {(callback: (data: any, key: string) => void) => void} once - Once method
 * @property {(message: string, signature: string) => Promise<string>} verifySignature - Verify signature method
 * @property {Object} _ - Gun internal properties
 * @property {Object} user - Gun user instance
 * @property {Object} opt - Gun options
 */

/**
 * @typedef {ExtendedGunBase & IGun} ExtendedGun
 */

/**
 * @typedef {ExtendedGun & IGunInstance} FullGunInstance
 */

/**
 * @typedef {Object} GunHookCallbacks
 * @property {function} create - Create callback
 * @property {function} put - Put callback
 * @property {function} get - Get callback
 * @property {function} opt - Opt callback
 */

const MESSAGE_TO_SIGN = "Access GunDB with Ethereum";

let contractAddresses = {
  PROOF_OF_INTEGRITY_ADDRESS,
  STEALTH_ANNOUNCER_ADDRESS,
};

let rpcUrl = "";
let privateKey = "";
let testSigner = null;

// =============================================
// INITIALIZATION
// =============================================

async function initializeTextEncoder() {
  if (typeof window === "undefined") {
    const util = await import("util");
    global.TextEncoder = util.TextEncoder;
    global.TextDecoder = util.TextDecoder;
  }
}

async function initialize(chain = 'localhost') {
  await initializeTextEncoder();
  contractAddresses = isLocalEnvironment ? 
    getContractAddresses(chain) : 
    getContractAddresses(chain);
  return contractAddresses;
}

// =============================================
// UTILITY FUNCTIONS
// =============================================

/**
 * @param {string} newRpcUrl
 * @param {string} newPrivateKey
 */
function setSigner(newRpcUrl, newPrivateKey) {
  rpcUrl = newRpcUrl;
  privateKey = newPrivateKey;
  console.log("Standalone configuration set");
}

async function getSigner(chain = 'localhost') {
  if (testSigner) {
    return testSigner;
  }
  return getCommonSigner(chain);
}

/**
 * @param {ethers.BytesLike} signature
 */
function generatePassword(signature) {
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
 * @param {string | Uint8Array} message
 * @param {ethers.SignatureLike} signature
 */
async function verifySignature(message, signature) {
  try {
    const recoveredAddress = ethers.verifyMessage(message, signature);
    return recoveredAddress;
  } catch (error) {
    console.error("Error verifying signature:", error);
    return null;
  }
}

/**
 * @param {string} gunPrivateKey
 */
async function gunToEthAccount(gunPrivateKey) {
  const base64UrlToHex = (/** @type {string} */ base64url) => {
    const padding = "=".repeat((4 - (base64url.length % 4)) % 4);
    const base64 = base64url.replace(/-/g, "+").replace(/_/g, "/") + padding;
    const binary = atob(base64);
    return Array.from(binary, (char) =>
      char.charCodeAt(0).toString(16).padStart(2, "0")
    ).join("");
  };

  const hexPrivateKey = "0x" + base64UrlToHex(gunPrivateKey);
  const wallet = new ethers.Wallet(hexPrivateKey);
  
  // Genera nuove coppie di chiavi SEA
  const pair = await SEA.pair();
  const v_pair = await SEA.pair();
  const s_pair = await SEA.pair();

  // Genera password e cifra le coppie
  const signature = await wallet.signMessage(MESSAGE_TO_SIGN);
  const password = generatePassword(signature);
  
  const encryptedPair = await encrypt(pair, password);
  const encryptedV_pair = await encrypt(v_pair, password);
  const encryptedS_pair = await encrypt(s_pair, password);

  // Genera gli account di viewing e spending
  const viewingAccount = await gunToEthAccount(v_pair.priv);
  const spendingAccount = await gunToEthAccount(s_pair.priv);

  return {
    account: wallet,
    publicKey: wallet.address,
    privateKey: hexPrivateKey,
    pair: pair,
    v_pair: v_pair,
    s_pair: s_pair,
    ethAddress: wallet.address,
    ethPrivateKey: hexPrivateKey,
    env_pair: encryptedPair,
    env_v_pair: encryptedV_pair,
    env_s_pair: encryptedS_pair,
    publicKeys: {
      viewingPublicKey: v_pair.epub,
      spendingPublicKey: spendingAccount.publicKey,
      ethViewingAddress: viewingAccount.publicKey,
    }
  };
}

/**
 * @param {string} encryptedPair
 * @param {any} password
 */
async function decryptPair(encryptedPair, password) {
  try {
    const keypair = {
      epriv: password,
      epub: password
    };
    return await decrypt(encryptedPair, keypair);
  } catch (error) {
    console.error("Error decrypting key pair:", error);
    return null;
  }
}

/**
 * @param {string} encryptedPair
 * @param {any} password
 */
function decryptPairFromPassword(encryptedPair, password) {
  const encryptionKeypair = {
    epriv: password,
    epub: password
  };
  return decrypt(encryptedPair, encryptionKeypair);
}

async function ethToGunAccount() {
  const signer = /** @type {ExtendedSigner} */ (await getSigner());
  const signature = await signer.signMessage(MESSAGE_TO_SIGN);
  const password = generatePassword(signature);
  
  const pair = await SEA.pair();
  const v_pair = await SEA.pair();
  const s_pair = await SEA.pair();

  const encryptedPair = await encrypt(pair, password);
  const encryptedV_pair = await encrypt(v_pair, password);
  const encryptedS_pair = await encrypt(s_pair, password);

  const viewingAccount = await gunToEthAccount(v_pair.priv);
  const spendingAccount = await gunToEthAccount(s_pair.priv);

  return {
    pair: pair,
    v_pair: v_pair,
    s_pair: s_pair,
    ethAddress: signer.address,
    ethPrivateKey: signer.privateKey,
    env_pair: encryptedPair,
    env_v_pair: encryptedV_pair,
    env_s_pair: encryptedS_pair,
    publicKeys: {
      viewingPublicKey: v_pair.epub,
      spendingPublicKey: spendingAccount.publicKey,
      ethViewingAddress: viewingAccount.publicKey,
    },
  };
}

/**
 * @param {any} address
 */
async function createAndStoreEncryptedPair(address) {
  const gun = this;
  try {
    const { pair, v_pair, s_pair, publicKeys } = await ethToGunAccount();
    gun.get("gun-eth")
      .get("users")
      .get(address)
      .put({
        pair,
        v_pair,
        s_pair,
        publicKeys
      });

    console.log("Encrypted pairs and public keys stored for:", address);
  } catch (error) {
    console.error("Error creating and storing encrypted pair:", error);
    throw error;
  }
}

/**
 * @param {any} address
 * @param {any} signature
 */
async function getAndDecryptPair(address, signature) {
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

    const password = generatePassword(signature);
    const decryptedPair = await decrypt(encryptedData, {
      epriv: password,
      epub: password
    });

    console.log(decryptedPair);
    return decryptedPair;
  } catch (error) {
    console.error("Error retrieving and decrypting pair:", error);
    return null;
  }
}

/**
 * Crea una firma utilizzando il signer corrente
 * @param {string} message - Messaggio da firmare
 * @returns {Promise<string>} Firma generata
 */
async function createSignature(message) {
  const signer = /** @type {ExtendedSigner} */ (await getSigner());
  return signer.signMessage(message);
}

// =============================================
// GUN EXTENSIONS
// =============================================

/**
 * @param {{ chain: any; }} Gun
 */
function extendGunWithStealth(Gun) {
  /** @type {StealthMethodsBase} */
  const stealthMethods = {
    stealth: async function(method, ...args) {
      const stealth = new StealthChain(/** @type {GunExtended} */ (/** @type {unknown} */ (this))),
            methods = {
              generate: stealth.generateStealthAddress.bind(stealth),
              announce: stealth.announceStealthPayment.bind(stealth),
              getPayments: stealth.getStealthPayments.bind(stealth),
              recover: stealth.recoverStealthFunds.bind(stealth),
              publish: stealth.publishStealthKeys.bind(stealth)
            };
      
      if (!(method in methods)) {
        throw new Error(`Unknown stealth method: ${method}`);
      }
      
      return methods[method](...args);
    },

    generateStealthAddress: async function(recipientAddress, signature, options = {}) {
      const stealth = new StealthChain(/** @type {GunExtended} */ (/** @type {unknown} */ (this)));
      return stealth.generateStealthAddress(recipientAddress, signature, options);
    },

    announceStealthPayment: async function(stealthAddress, senderPublicKey, spendingPublicKey, signature, options = {}) {
      const stealth = new StealthChain(/** @type {GunExtended} */ (/** @type {unknown} */ (this)));
      return stealth.announceStealthPayment(stealthAddress, senderPublicKey, spendingPublicKey, signature, options);
    },

    getStealthPayments: async function(signature, options = {}) {
      const stealth = new StealthChain(/** @type {GunExtended} */ (/** @type {unknown} */ (this)));
      return stealth.getStealthPayments(signature, options);
    },

    recoverStealthFunds: async function(stealthAddress, senderPublicKey, signature, spendingPublicKey) {
      const stealth = new StealthChain(/** @type {GunExtended} */ (/** @type {unknown} */ (this)));
      return stealth.recoverStealthFunds(stealthAddress, senderPublicKey, signature, spendingPublicKey);
    },

    publishStealthKeys: async function(signature) {
      const stealth = new StealthChain(/** @type {GunExtended} */ (/** @type {unknown} */ (this)));
      return stealth.publishStealthKeys(signature);
    },

    monitorStealthEvents: function(callback) {
      const stealth = new StealthChain(/** @type {GunExtended} */ (/** @type {unknown} */ (this))),
            gun = /** @type {GunExtended} */ (/** @type {unknown} */ (this));
      
      const chain = gun.get('gun-eth')
        .get('stealth-payments')
        .map()
        .on((payment, id) => {
          if(payment) {
            callback({
              type: 'offChain',
              event: 'announcement',
              data: { ...payment, id }
            });
          }
        });

      (async () => {
        try {
          const signer = /** @type {ExtendedSigner} */ (await getSigner()),
                chainConfig = getContractAddresses('localhost'),
                contract = new ethers.Contract(
                  chainConfig.STEALTH_ANNOUNCER_ADDRESS,
                  STEALTH_ANNOUNCER_ABI,
                  signer
                );

          contract.on('PaymentAnnounced', function(sender, recipient, stealthAddress, event) {
            callback({
              type: 'onChain',
              event: 'PaymentAnnounced',
              data: {
                sender: sender,
                recipient: recipient,
                stealthAddress: stealthAddress,
                blockNumber: event.blockNumber,
                transactionHash: event.transactionHash
              }
            });
          });
        } catch(error) {
          console.warn('Failed to setup on-chain event monitoring:', error);
        }
      })();

      return chain;
    }
  };

  Object.assign(Gun.chain, stealthMethods);
}

/**
 * @param {import("gun").IGun} Gun
 */
function extendGun(Gun) {
  /** @type {BaseMethods} */
  const baseMethods = {
    MESSAGE_TO_SIGN,
    setSigner: function(/** @type {string} */ newRpcUrl, /** @type {string} */ newPrivateKey) {
      rpcUrl = newRpcUrl;
      privateKey = newPrivateKey;
      console.log("Signer configuration set");
      return this;
    },
    getSigner,
    verifySignature,
    generatePassword,
    createSignature,
    createAndStoreEncryptedPair,
    getAndDecryptPair,
    ethToGunAccount,
    gunToEthAccount,
    getAddressesForChain
  };

  Object.assign(Gun.chain, baseMethods);

  // Extend with proof functionality
  ProofChain.extendGun(Gun);

  // Extend with stealth functionality
  extendGunWithStealth(Gun);

  // Add retry mechanism
  const methods = [
    'stealth', 
    'generateStealthAddress', 
    'announceStealthPayment', 
    'getStealthPayments', 
    'recoverStealthFunds', 
    'publishStealthKeys',
    'createAndStoreEncryptedPair',
    'getAndDecryptPair',
    'ethToGunAccount',
    'gunToEthAccount',
    'createSignature',
    'setSigner'
  ];
  
  methods.forEach(method => {
    const original = Gun.chain[method];
    if (original) {
      Gun.chain[method] = async function(/** @type {any} */ ...args) {
        const maxRetries = 3;
        let lastError;

        for(let i = 0; i < maxRetries; i++) {
          try {
            return await original.apply(this, args);
          } catch(error) {
            console.warn(`Attempt ${i + 1}/${maxRetries} failed:`, error);
            lastError = error;
            await new Promise(resolve => setTimeout(resolve, 1000 * Math.pow(2, i)));
          }
        }

        throw lastError;
      };
    }
  });
}

/**
 * Inizializza Gun con le estensioni e le opzioni specificate
 * @param {string} chain - Chain da utilizzare
 * @param {Object} [options] - Opzioni di configurazione per Gun
 * @returns {Promise<IGunInstance>} Istanza di Gun configurata
 */
async function initializeGun(chain = 'localhost', options = {}) {
  await initialize(chain);
  extendGun(Gun);
  const gun = /** @type {IGunInstance} */ (Gun(options));
  return gun;
}

/**
 * Classe principale per l'integrazione di Gun con Ethereum
 */
export class GunEth {
  static keypair = null;
  static v_keypair = null;
  static s_keypair = null;

  static async init(chain = 'localhost') {
    await initialize(chain);
    return this;
  }

  // Metodi statici
  static generateRandomId = generateRandomId;
  static generatePassword = generatePassword;
  static getSigner = getSigner;
  static verifySignature = verifySignature;
  static MESSAGE_TO_SIGN = MESSAGE_TO_SIGN;
  static getContractAddresses = getContractAddresses;
  static extendGun = extendGun;
  static initializeGun = initializeGun;
  static setSigner = setSigner;
  static gunToEthAccount = gunToEthAccount;
  static decryptPair = decryptPair;
  static decryptPairFromPassword = decryptPairFromPassword;
  static ethToGunAccount = ethToGunAccount;
  static createAndStoreEncryptedPair = createAndStoreEncryptedPair;
  static getAndDecryptPair = getAndDecryptPair;
  static createSignature = createSignature;
  static LOCAL_CONFIG = LOCAL_CONFIG;
  static contractAddresses = contractAddresses;
}

// Esporto le funzioni necessarie
export {
  MESSAGE_TO_SIGN,
  generateRandomId,
  getContractAddresses,
  getSigner,
  generatePassword,
  verifySignature,
  initializeGun,
  extendGun,
  createSignature,
  setSigner,
  gunToEthAccount,
  decryptPair,
  decryptPairFromPassword,
  ethToGunAccount,
  createAndStoreEncryptedPair,
  getAndDecryptPair
};
