// @ts-check

import { ethers } from "ethers";
import Gun from "gun/gun";
import "gun/sea.js";
import "gun/lib/then.js";
import "gun/lib/load.js";
import "gun/lib/open.js";
import "gun/lib/radix.js";
import "gun/lib/radisk.js";
import "gun/lib/store.js";
import "gun/lib/rindexed.js";
import {
  encrypt,
  decrypt,
  encryptWithPassword,
  decryptWithPassword,
} from "./utils/encryption.js";
import {
  generateRandomId,
  getSigner as getCommonSigner,
  setSigner as setCommonSigner,
  verifySignature,
  generatePassword,
  MESSAGE_TO_SIGN,
} from "./utils/common.js";
import { StealthChain } from "./features/StealthChain.js";

const SEA = Gun.SEA;
let gun = null;

class SignerManager {
  static instance = null;
  static provider = null;
  static signer = null;
  static rpcUrl = "";
  static privateKey = "";

  static getInstance() {
    if (!SignerManager.instance) {
      SignerManager.instance = new SignerManager();
    }
    return SignerManager.instance;
  }

  static async getSigner() {
    if (SignerManager.signer) {
      return SignerManager.signer;
    }

    if (SignerManager.rpcUrl !== "" && SignerManager.privateKey !== "") {
      SignerManager.provider = new ethers.JsonRpcProvider(SignerManager.rpcUrl);
      const wallet = new ethers.Wallet(
        SignerManager.privateKey,
        SignerManager.provider
      );
      SignerManager.signer = wallet;
      return SignerManager.signer;
    }

    // @ts-ignore
    if (typeof window !== "undefined" && window?.ethereum) {
      // @ts-ignore
      /** @type {WindowWithEthereum} */
      const windowWithEthereum = window;
      await windowWithEthereum.ethereum?.request({
        method: "eth_requestAccounts",
      });
      const browserProvider = new ethers.BrowserProvider(
        windowWithEthereum.ethereum
      );
      const signer = await browserProvider.getSigner();

      // Creiamo un wrapper attorno al signer per gestire l'indirizzo
      SignerManager.signer = {
        ...signer,
        address: await signer.getAddress(),
        signMessage: async (message) => {
          return signer.signMessage(message);
        },
      };

      return SignerManager.signer;
    }

    throw new Error("No valid Ethereum provider found. Call setSigner first.");
  }

  static setSigner(newRpcUrl, newPrivateKey) {
    SignerManager.rpcUrl = newRpcUrl;
    SignerManager.privateKey = newPrivateKey;
    SignerManager.provider = new ethers.JsonRpcProvider(newRpcUrl);
    const wallet = new ethers.Wallet(newPrivateKey, SignerManager.provider);
    SignerManager.signer = wallet;
    console.log("Signer configured with address:", wallet.address);
    return SignerManager.instance;
  }
}

/**
 * @param {string} newRpcUrl
 * @param {string} newPrivateKey
 */
export function setSigner(newRpcUrl, newPrivateKey) {
  return setCommonSigner(newRpcUrl, newPrivateKey);
}

export async function getSigner() {
  return getCommonSigner();
}

/**
 * Converte una chiave privata Gun in formato Ethereum
 * @param {string} gunPrivateKey - Chiave privata in formato Gun
 * @returns {Promise<string>} Chiave privata in formato Ethereum
 */
async function convertToEthAddress(gunPrivateKey) {
  const base64UrlToHex = (base64url) => {
    try {
      const padding = "=".repeat((4 - (base64url.length % 4)) % 4);
      const base64 = base64url.replace(/-/g, "+").replace(/_/g, "/") + padding;
      const binary = atob(base64);
      const hex = Array.from(binary, (char) =>
        char.charCodeAt(0).toString(16).padStart(2, "0")
      ).join("");

      if (hex.length !== 64) {
        throw new Error("Lunghezza chiave privata non valida");
      }
      return hex;
    } catch (error) {
      console.error("Errore nella conversione base64Url to hex:", error);
      throw new Error("Impossibile convertire la chiave privata");
    }
  };

  const hexPrivateKey = "0x" + base64UrlToHex(gunPrivateKey);
  return hexPrivateKey;
}

/**
 * Converte un account Gun in un account Ethereum
 * @param {Object} gunKeyPair - Coppia di chiavi Gun
 * @param {string} password - Password per la crittografia delle chiavi
 * @returns {Promise<Object>} Account convertito
 */
export async function gunToEthAccount(gunKeyPair, password) {
  try {
    const hexPrivateKey = await convertToEthAddress(gunKeyPair.epriv);

    if (!ethers.isHexString(hexPrivateKey, 32)) {
      throw new Error("Chiave privata non valida dopo la conversione");
    }

    const internalWallet = new ethers.Wallet(hexPrivateKey);

    const [v_pair, s_pair] = await Promise.all([SEA.pair(), SEA.pair()]);

    if (!v_pair || !s_pair) {
      throw new Error("Impossibile generare le coppie di chiavi stealth");
    }

    // hash the password

    const [encryptedPair, encryptedV_pair, encryptedS_pair] = await Promise.all(
      [
        encryptWithPassword(gunKeyPair, password),
        encryptWithPassword(v_pair, password),
        encryptWithPassword(s_pair, password),
      ]
    );

    return {
      pub: gunKeyPair.pub,
      internalWalletAddress: internalWallet.address,
      internalWalletPk: hexPrivateKey,
      pair: gunKeyPair,
      v_pair,
      s_pair,
      viewingPublicKey: v_pair.epub,
      spendingPublicKey: s_pair.epub,
      env_pair: encryptedPair,
      env_v_pair: encryptedV_pair,
      env_s_pair: encryptedS_pair,
    };
  } catch (error) {
    console.error("Errore in gunToEthAccount:", error);
    throw error;
  }
}

/**
 * Crea un account Gun da un account Ethereum
 * @param {boolean} [isSecondary] - Flag per indicare se è un account secondario
 * @returns {Promise<Object>} Account creato
 */

export async function ethToGunAccount(isSecondary = false) {
  try {
    // Se è un account secondario, creiamo solo il wallet base
    if (isSecondary) {
      const randomBytes = ethers.randomBytes(32);
      if (!randomBytes || randomBytes.length !== 32) {
        throw new Error("Generazione bytes casuali fallita");
      }
      const wallet = new ethers.Wallet(ethers.hexlify(randomBytes));
      return {
        publicKey: wallet.address,
        address: wallet.address,
      };
    }

    // Otteniamo il signer e la firma
    const signer = await getSigner();
    const signature = await signer.signMessage(MESSAGE_TO_SIGN);
    const password = await generatePassword(signature);

    // Generiamo le coppie di chiavi per stealth paymentseth
    const [pair, v_pair, s_pair] = await Promise.all([
      SEA.pair(),
      SEA.pair(),
      SEA.pair(),
    ]);

    if (!pair || !v_pair || !s_pair) {
      throw new Error("Impossibile generare le coppie di chiavi stealth");
    }

    const [encryptedPair, encryptedV_pair, encryptedS_pair] = await Promise.all(
      [
        encryptWithPassword(pair, password),
        encryptWithPassword(v_pair, password),
        encryptWithPassword(s_pair, password),
      ]
    );

    const hexPrivateKey = await convertToEthAddress(pair.epriv);

    if (!ethers.isHexString(hexPrivateKey, 32)) {
      throw new Error("Chiave privata non valida dopo la conversione");
    }

    const internalWallet = new ethers.Wallet(hexPrivateKey);

    return {
      pub: pair.pub,
      internalWalletAddress: internalWallet.address,
      internalWalletPk: hexPrivateKey,
      pair: pair,
      v_pair,
      s_pair,
      viewingPublicKey: v_pair.epub,
      spendingPublicKey: s_pair.epub,
      env_pair: encryptedPair,
      env_v_pair: encryptedV_pair,
      env_s_pair: encryptedS_pair,
    };
  } catch (error) {
    console.error("Errore in ethToGunAccount:", error);
    throw error;
  }
}

// =============================================
// STEALTH METHODS
// =============================================

/**
 * Estende Gun con i metodi stealth
 * @param {import("gun").IGun} Gun
 */
export function extendGunWithStealth(Gun) {
  const stealthMethods = {
    async generateStealthAddress(receiverViewingKey, receiverSpendingKey) {
      const stealth = new StealthChain();
      return stealth.generateStealthAddress(
        receiverViewingKey,
        receiverSpendingKey
      );
    },

    async deriveStealthAddress(
      sharedSecret,
      receiverSpendingKey,
      senderEphemeralKey,
      receiverViewingKey
    ) {
      const stealth = new StealthChain();
      return stealth.deriveStealthAddress(
        sharedSecret,
        receiverSpendingKey,
        senderEphemeralKey,
        receiverViewingKey
      );
    },

    async announceStealthPayment(
      stealthAddress,
      senderEphemeralKey,
      receiverViewingKey,
      receiverSpendingKey
    ) {
      const stealth = new StealthChain();
      return stealth.createStealthAnnouncement(
        stealthAddress,
        senderEphemeralKey,
        receiverViewingKey,
        receiverSpendingKey
      );
    },

    async recoverStealthFunds(
      stealthAddress,
      senderPublicKey,
      signature,
      spendingPublicKey
    ) {
      const stealth = new StealthChain();
      return stealth.createRecoveryData(
        stealthAddress,
        senderPublicKey,
        signature,
        spendingPublicKey
      );
    },
  };

  Object.assign(Gun.chain, stealthMethods);
}

// =============================================
// GUN EXTENSIONS
// =============================================

/**
 * @param {import("gun").IGun} Gun
 */
function extendGun(Gun) {
  const baseMethods = {
    MESSAGE_TO_SIGN,
    setSigner,
    getSigner,
    verifySignature,
    generatePassword,
    gunToEthAccount,
    ethToGunAccount,
    encryptWithPassword,
    decryptWithPassword,
    encrypt,
    decrypt,
    createSignature,
    convertToEthAddress,
  };

  Object.assign(Gun.chain, baseMethods);
  extendGunWithStealth(Gun);
}

/**
 * Inizializza Gun con le estensioni e le opzioni specificate
 * @param {Object} options - Opzioni di configurazione per Gun
 * @returns {import("gun").IGunInstance}
 */
function initializeGun(options = {}) {
  if (!Gun.SEA) {
    console.warn("Gun.SEA non disponibile, ricarico le estensioni...");
    require("gun/sea");
  }

  extendGun(Gun);
  gun = new Gun(options);

  if (!gun || typeof gun.user !== "function") {
    throw new Error("Inizializzazione Gun fallita: user API non disponibile");
  }

  return gun;
}

/**
 * Crea una firma utilizzando il signer configurato
 * @param {string} message - Messaggio da firmare
 * @returns {Promise<string>} Firma generata
 */
async function createSignature(message) {
  try {
    if (!message) {
      throw new Error("Messaggio da firmare non valido");
    }

    const signer = await getSigner();
    const signature = await signer.signMessage(message);

    if (!signature || typeof signature !== "string") {
      throw new Error("Firma non valida");
    }

    return signature;
  } catch (error) {
    console.error("Errore nella creazione della firma:", error);
    throw error;
  }
}

export {
  MESSAGE_TO_SIGN,
  generateRandomId,
  generatePassword,
  verifySignature,
  initializeGun,
  extendGun,
  encrypt,
  decrypt,
  encryptWithPassword,
  decryptWithPassword,
  createSignature,
  convertToEthAddress,
};
